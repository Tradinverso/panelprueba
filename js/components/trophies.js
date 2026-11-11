// Trofeos: el repositorio de certificados que dan las prop firms (fase
// pasada, fondeo, payout). Sección del pop-up de la cuenta.
//
// Guardado: Firestore, no Storage (el proyecto está en el plan gratuito y no
// tiene Storage). El archivo se guarda troceado en base64 — ver sync.js. Para
// que quepa bien, las imágenes se pasan a JPEG de 1800 px como mucho y los PDF
// se aceptan hasta 4 MB. La miniatura (JPEG pequeño) va en los metadatos, así
// la galería no tiene que bajarse los archivos.

import { sync } from '../sync.js';
import { uuid } from '../utils/uuid.js';
import { showToast } from './toast.js';
import { ic } from './icons.js';

export const TROPHY_TYPES = [
  { id: 'fase1', label: 'Fase 1 pasada', corto: 'Fase 1', color: '#3b82f6' },
  { id: 'fase2', label: 'Fase 2 pasada', corto: 'Fase 2', color: '#8b5cf6' },
  { id: 'fondeada', label: 'Fondeada', corto: 'Fondeada', color: '#10b981' },
  { id: 'payout', label: 'Payout', corto: 'Payout', color: '#f59e0b' },
  { id: 'otro', label: 'Otro', corto: 'Otro', color: '#64748b' },
];
const FIRMS = ['Lucid Trading', 'WSFunded', 'Earn2Trade', 'Apex Trader Funding', 'FTMO', 'The Trading Pit', 'Topstep'];
const tipo = id => TROPHY_TYPES.find(t => t.id === id) || TROPHY_TYPES[4];

const MAX_PDF = 4 * 1024 * 1024;
const CHUNK = 900000;                 // caracteres base64 por documento (< 1 MiB)
const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const cache = new Map();              // uid → [metadatos]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Metadatos de los trofeos de una cuenta (para la galería, el backup y los recuentos).
export async function getTrophiesMeta(uid) {
  if (!uid) return [];
  if (!cache.has(uid)) {
    let list = [];
    try { list = await sync.loadTrophies(uid); } catch (e) { console.error('Trofeos: no se pudieron cargar', e); }
    cache.set(uid, Array.isArray(list) ? list : []);
  }
  return cache.get(uid);
}

async function pdfjs() {
  if (!window.pdfjsLib) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS; s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el lector de PDF. Comprueba tu conexión.'));
      document.head.appendChild(s);
    });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  return window.pdfjsLib;
}

const b64ToBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));
function bytesToB64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function lienzo(src, maxW, w, h) {
  const k = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// Archivo elegido → { mime, data (base64), thumb (dataURL), preview (dataURL) }
async function prepararArchivo(file) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_PDF) throw new Error('El PDF pesa más de 4 MB. Expórtalo más ligero o sube una captura.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const lib = await pdfjs();
    const pdf = await lib.getDocument({ data: bytes.slice() }).promise;
    const page = await pdf.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const escala = 420 / vp.width;
    const view = page.getViewport({ scale: escala });
    const c = document.createElement('canvas');
    c.width = Math.round(view.width); c.height = Math.round(view.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: view }).promise;
    const thumb = c.toDataURL('image/jpeg', 0.8);
    return { mime: 'application/pdf', data: bytesToB64(bytes), thumb, preview: thumb, paginas: pdf.numPages };
  }
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) throw new Error('Formato no admitido. Sube una imagen (PNG, JPG, WEBP) o un PDF.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      i.src = url;
    });
    const grande = lienzo(img, 1800, img.naturalWidth, img.naturalHeight).toDataURL('image/jpeg', 0.86);
    const thumb = lienzo(img, 420, img.naturalWidth, img.naturalHeight).toDataURL('image/jpeg', 0.8);
    return { mime: 'image/jpeg', data: grande.split(',')[1], thumb, preview: thumb };
  } finally { URL.revokeObjectURL(url); }
}

const fechaEs = d => { if (!d) return ''; const [y, m, dd] = d.split('-'); return `${dd}/${m}/${y}`; };

// Pinta la sección. `uid` = cuenta cuyos trofeos se ven; `readOnly` = el admin
// mirando a un alumno (ve y abre, pero no sube ni borra).
export async function renderTrophies(host, { uid, readOnly = false, hoy = '' }) {
  let filtro = 'todos';
  let formAbierto = false;
  let archivo = null;               // resultado de prepararArchivo
  let nombreArchivo = '';
  let tipoSel = '';
  let guardando = false;

  host.innerHTML = '<div class="acc-empty">Cargando trofeos…</div>';
  const lista = await getTrophiesMeta(uid);

  function pintar() {
    const orden = [...lista].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));
    const n = id => lista.filter(t => t.type === id).length;
    const visibles = filtro === 'todos' ? orden : orden.filter(t => t.type === filtro);
    host.innerHTML = `
      <div class="tro-top">
        <div class="tro-stats">
          <div class="tro-stat"><b>${lista.length}</b><span>trofeos</span></div>
          <div class="tro-stat"><b>${n('fase1') + n('fase2')}</b><span>fases pasadas</span></div>
          <div class="tro-stat"><b>${n('fondeada')}</b><span>fondeadas</span></div>
          <div class="tro-stat"><b>${n('payout')}</b><span>payouts</span></div>
        </div>
        ${readOnly ? '' : `<button type="button" class="btn primary" data-tro="nuevo">+ Añadir trofeo</button>`}
      </div>

      ${formAbierto ? `
      <div class="acc-card tro-form">
        <div class="acc-card-title">Nuevo trofeo</div>
        <label class="tro-drop ${archivo ? 'has' : ''}" data-tro="drop">
          <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" hidden>
          ${archivo
            ? `<img src="${archivo.preview}" alt="Vista previa"><span>${esc(nombreArchivo)}${archivo.mime === 'application/pdf' ? ` · PDF de ${archivo.paginas} página${archivo.paginas === 1 ? '' : 's'}` : ''}<br><small>Pulsa para cambiar el archivo</small></span>`
            : `<span><b>Arrastra aquí el certificado</b> o pulsa para elegirlo<br><small>Imagen (PNG, JPG, WEBP) o PDF de hasta 4 MB</small></span>`}
        </label>
        <div class="tro-fields">
          <label>Prop firm <span class="required">*</span>
            <input class="form-input" data-f="firm" list="troFirms" placeholder="Lucid Trading, FTMO…" maxlength="60">
            <datalist id="troFirms">${FIRMS.map(f => `<option value="${f}">`).join('')}</datalist>
          </label>
          <label>Cuenta
            <input class="form-input" data-f="account" placeholder="25K · #0257…" maxlength="60">
          </label>
          <label>Fecha
            <input class="form-input" type="date" data-f="date" value="${hoy}">
          </label>
        </div>
        <div class="tro-label">Tipo de logro <span class="required">*</span></div>
        <div class="tro-types">
          ${TROPHY_TYPES.map(t => `<button type="button" class="tro-type ${tipoSel === t.id ? 'on' : ''}" data-type="${t.id}" style="--tc:${t.color}"><span></span>${t.label}</button>`).join('')}
        </div>
        <label class="tro-label">Nota
          <input class="form-input" data-f="note" placeholder="Opcional" maxlength="140">
        </label>
        <div class="acc-err" data-tro="err" hidden></div>
        <div class="acc-actions">
          <button type="button" class="btn" data-tro="cancelar">Cancelar</button>
          <button type="button" class="btn primary" data-tro="guardar" ${guardando ? 'disabled' : ''}>${guardando ? 'Guardando…' : 'Guardar trofeo'}</button>
        </div>
      </div>` : ''}

      ${lista.length ? `
      <div class="tro-filters">
        <button type="button" class="pill ${filtro === 'todos' ? 'active' : ''}" data-filtro="todos">Todos <b>${lista.length}</b></button>
        ${TROPHY_TYPES.map(t => `<button type="button" class="pill ${filtro === t.id ? 'active' : ''}" data-filtro="${t.id}">${t.corto} <b>${n(t.id)}</b></button>`).join('')}
      </div>
      <div class="tro-grid">
        ${visibles.map(t => `
          <button type="button" class="tro-item" data-open="${esc(t.id)}">
            <span class="tro-thumb">${t.thumb ? `<img src="${t.thumb}" alt="">` : ''}${t.mime === 'application/pdf' ? '<i>PDF</i>' : ''}
              <em style="background:${tipo(t.type).color}">${tipo(t.type).corto}</em></span>
            <span class="tro-name">${esc(t.firm)}${t.account ? ' · ' + esc(t.account) : ''}</span>
            <span class="tro-sub">${fechaEs(t.date)}${t.note ? ' · ' + esc(t.note) : ''}</span>
          </button>`).join('') || `<div class="acc-empty">No hay trofeos de este tipo.</div>`}
      </div>` : `
      <div class="acc-card acc-empty tro-empty">
        <div class="tro-cup">${ic('trofeo')}</div>
        <b>Aún no ${readOnly ? 'hay' : 'has subido'} ningún trofeo.</b>
        ${readOnly ? '' : 'Sube aquí los certificados que te dan las prop firms al pasar una fase, al fondearte o al cobrar un payout.'}
      </div>`}
    `;
  }

  const valores = () => Object.fromEntries([...host.querySelectorAll('[data-f]')].map(i => [i.dataset.f, i.value.trim()]));
  let borrador = {};
  const repintarForm = () => {
    borrador = { ...borrador, ...valores() };
    pintar();
    for (const [k, v] of Object.entries(borrador)) { const i = host.querySelector(`[data-f="${k}"]`); if (i && v) i.value = v; }
  };
  const error = msg => { const e = host.querySelector('[data-tro="err"]'); if (e) { e.textContent = msg; e.hidden = !msg; } };

  async function tomarArchivo(file) {
    if (!file) return;
    error('');
    try {
      archivo = await prepararArchivo(file);
      nombreArchivo = file.name;
      repintarForm();
    } catch (e) { error(e.message || String(e)); }
  }

  host.addEventListener('change', e => { if (e.target.matches('.tro-drop input[type=file]')) tomarArchivo(e.target.files[0]); });
  host.addEventListener('dragover', e => { if (e.target.closest('.tro-drop')) { e.preventDefault(); e.target.closest('.tro-drop').classList.add('over'); } });
  host.addEventListener('dragleave', e => { const d = e.target.closest('.tro-drop'); if (d) d.classList.remove('over'); });
  host.addEventListener('drop', e => { if (e.target.closest('.tro-drop')) { e.preventDefault(); tomarArchivo(e.dataTransfer.files[0]); } });

  host.addEventListener('click', async e => {
    const f = e.target.closest('[data-filtro]');
    if (f) { filtro = f.dataset.filtro; repintarForm(); return; }
    const ty = e.target.closest('[data-type]');
    if (ty) { tipoSel = ty.dataset.type; repintarForm(); return; }
    const abrir = e.target.closest('[data-open]');
    if (abrir) { abrirVisor(lista.find(t => t.id === abrir.dataset.open)); return; }
    const a = e.target.closest('[data-tro]');
    if (!a) return;
    const accion = a.dataset.tro;
    if (accion === 'nuevo') { formAbierto = true; archivo = null; nombreArchivo = ''; tipoSel = ''; borrador = {}; pintar(); return; }
    if (accion === 'cancelar') { formAbierto = false; archivo = null; borrador = {}; pintar(); return; }
    if (accion === 'guardar') {
      const v = valores();
      if (!archivo) return error('Falta el archivo del certificado.');
      if (!v.firm) return error('Indica la prop firm.');
      if (!tipoSel) return error('Elige el tipo de logro.');
      const chunks = [];
      for (let i = 0; i < archivo.data.length; i += CHUNK) chunks.push(archivo.data.slice(i, i + CHUNK));
      const meta = {
        id: uuid(), firm: v.firm, account: v.account || '', date: v.date || hoy, type: tipoSel, note: v.note || '',
        mime: archivo.mime, name: nombreArchivo, thumb: archivo.thumb, createdAt: Date.now(),
      };
      guardando = true; repintarForm();
      try {
        await sync.saveTrophy(uid, meta, chunks);
        lista.push({ ...meta, chunks: chunks.length });
        formAbierto = false; archivo = null; borrador = {}; guardando = false;
        pintar();
        showToast('Trofeo guardado');
      } catch (err) {
        guardando = false; repintarForm();
        error('No se pudo guardar: ' + (err.message || err));
      }
    }
  });

  // ── Visor ──
  async function abrirVisor(t) {
    if (!t) return;
    const caja = host.closest('.acc-box') || document.body;
    const v = document.createElement('div');
    v.className = 'tro-viewer';
    v.innerHTML = `
      <div class="tro-viewer-head">
        <div><b>${esc(t.firm)}${t.account ? ' · ' + esc(t.account) : ''}</b>
          <span><em style="background:${tipo(t.type).color}">${tipo(t.type).label}</em> ${fechaEs(t.date)}${t.note ? ' · ' + esc(t.note) : ''}</span></div>
        <div class="tro-viewer-actions">
          ${readOnly ? '' : `<span data-v="confirmar" hidden>¿Eliminar este trofeo? <button type="button" class="btn" data-v="no">Cancelar</button> <button type="button" class="btn danger" data-v="si">Sí, eliminar</button></span>
          <button type="button" class="btn danger" data-v="eliminar">Eliminar</button>`}
          <button type="button" class="acc-x" data-v="cerrar" aria-label="Cerrar el visor">×</button>
        </div>
      </div>
      <div class="tro-viewer-body"><div class="acc-empty">Cargando…</div></div>`;
    caja.appendChild(v);
    const cuerpo = v.querySelector('.tro-viewer-body');
    const cerrar = () => v.remove();
    v.addEventListener('click', async e => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      const acc = b.dataset.v;
      if (acc === 'cerrar') cerrar();
      if (acc === 'eliminar') { v.querySelector('[data-v="confirmar"]').hidden = false; b.hidden = true; }
      if (acc === 'no') { v.querySelector('[data-v="confirmar"]').hidden = true; v.querySelector('[data-v="eliminar"]').hidden = false; }
      if (acc === 'si') {
        try {
          await sync.deleteTrophy(uid, t.id, t.chunks);
          lista.splice(lista.indexOf(t), 1);
          cerrar(); pintar();
          showToast('Trofeo eliminado');
        } catch (err) { showToast('No se pudo eliminar: ' + (err.message || err)); }
      }
    });
    try {
      const data = await sync.loadTrophyFile(uid, t.id, t.chunks || 0);
      if (typeof data !== 'string' || !data) throw new Error('El archivo no está disponible.');
      if (t.mime === 'application/pdf') {
        const lib = await pdfjs();
        const pdf = await lib.getDocument({ data: b64ToBytes(data) }).promise;
        cuerpo.innerHTML = '';
        for (let n = 1; n <= pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const view = page.getViewport({ scale: 1.6 });
          const c = document.createElement('canvas');
          c.width = view.width; c.height = view.height;
          cuerpo.appendChild(c);
          await page.render({ canvasContext: c.getContext('2d'), viewport: view }).promise;
        }
      } else {
        cuerpo.innerHTML = `<img src="data:${t.mime};base64,${data}" alt="Certificado de ${esc(t.firm)}">`;
      }
    } catch (err) {
      cuerpo.innerHTML = `<div class="acc-empty">${t.thumb ? `<img src="${t.thumb}" alt=""><br>` : ''}No se pudo abrir el archivo: ${esc(err.message || err)}</div>`;
    }
  }

  pintar();
}
