// Vista "Plan de trading" — dos recuadros iguales, lado a lado, cada uno con su
// propio scroll (la página no crece):
//   · Izquierda: el DOCUMENTO del plan (enlace de Google Drive/Docs embebido).
//   · Derecha:   el PLAN ESCRITO (Markdown), con modo Leer / Editar.
// Persistencia en users/{uid}/tradingPlan/data vía state.saveTradingPlan
// ({ content, docUrl, updatedAt }; los protocolos propios viven en el mismo doc
// y no se tocan aquí).

import { state } from '../state.js';
import { renderMarkdown } from '../utils/markdown.js';
import { attachDictation } from '../utils/dictation.js';
import { showToast } from '../components/toast.js';

let mode = 'leer';        // 'leer' | 'editar' (recuadro derecho)
let draft = null;         // texto en edición (null = sin tocar → el guardado)
let editingUrl = false;   // recuadro izquierdo: formulario del enlace abierto

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const words = s => (String(s || '').match(/\S+/g) || []).length;

function render(container) {
  const plan = state.tradingPlan || {};
  const saved = plan.content || '';
  const hasUrl = !!plan.docUrl;
  const embed = hasUrl ? embedUrl(plan.docUrl) : null;
  if (!saved.trim() && mode === 'leer') mode = 'editar';   // sin plan aún: directo a escribir
  const text = draft != null ? draft : saved;
  const dirty = draft != null && draft !== saved;

  // ── Recuadro izquierdo: documento ──
  let left;
  if (hasUrl && !editingUrl) {
    left = embed
      ? `<iframe class="plan-frame" src="${esc(embed)}" loading="lazy" allowfullscreen title="Documento del plan"></iframe>
         <div class="plan-note">¿No se ve? El documento debe estar compartido como <strong>“Cualquiera con el enlace”</strong> en Drive.</div>`
      : `<div class="plan-empty">
           <div class="plan-empty-ic">📄</div>
           <div><strong>Documento en un enlace externo</strong></div>
           <div class="plan-empty-sub">Este enlace no se puede mostrar aquí dentro (solo los de Google Drive/Docs).</div>
           <a class="btn primary" href="${esc(plan.docUrl)}" target="_blank" rel="noopener noreferrer">Abrir documento ↗</a>
         </div>`;
  } else {
    left = `
      <div class="plan-empty">
        <div class="plan-empty-ic">📄</div>
        <div><strong>Inserta el documento de tu trading plan</strong></div>
        <div class="plan-empty-sub">Pega el enlace de tu PDF o documento en Google Drive/Docs, compartido como <strong>“Cualquiera con el enlace”</strong>. Se verá aquí dentro, página a página.</div>
        <div class="plan-url-form">
          <input class="form-input" id="planUrl" type="url" placeholder="https://drive.google.com/…  o  https://docs.google.com/…" value="${esc(plan.docUrl || '')}">
          <button class="btn primary" id="planUrlSave" type="button">Insertar</button>
          ${hasUrl ? '<button class="btn" id="planUrlCancel" type="button">Cancelar</button>' : ''}
        </div>
        <div class="form-error" id="planUrlErr" style="display:none;"></div>
      </div>`;
  }

  // ── Recuadro derecho: plan escrito ──
  const right = mode === 'editar'
    ? `<textarea class="plan-text" id="planText" spellcheck="false" placeholder="Escribe aquí tu plan de trading…  (# Título · ## Subtítulo · **negrita** · - lista)">${esc(text)}</textarea>`
    : `<div class="plan-read md-content">${renderMarkdown(saved)}</div>`;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Plan de trading</h1>
        <div class="sub">${plan.updatedAt ? 'Actualizado ' + fmtDate(plan.updatedAt) : 'Tu plan de trading personal'}</div>
      </div>
    </div>
    <div class="plan-two">
      <section class="card plan-box">
        <div class="plan-box-head">
          <div>
            <div class="plan-box-label">Documento del plan</div>
            <div class="plan-box-meta">${hasUrl ? (embed ? 'Google Drive · se ve aquí dentro' : 'Enlace externo') : 'Ningún documento insertado'}</div>
          </div>
          ${hasUrl && !editingUrl ? `<div class="plan-box-actions">
            <a class="btn" href="${esc(plan.docUrl)}" target="_blank" rel="noopener noreferrer">Abrir ↗</a>
            <button class="btn" id="planUrlEdit" type="button">Cambiar</button>
            <button class="btn" id="planUrlRemove" type="button">Quitar</button>
          </div>` : ''}
        </div>
        <div class="plan-box-body plan-doc">${left}</div>
      </section>

      <section class="card plan-box">
        <div class="plan-box-head">
          <div>
            <div class="plan-box-label">Plan escrito</div>
            <div class="plan-box-meta"><span id="planStatus" class="${dirty ? 'dirty' : ''}">${dirty ? 'Cambios sin guardar' : 'Guardado'}</span> · <span id="planWords">${words(text)}</span> palabras</div>
          </div>
          <div class="plan-box-actions">
            <div class="segmented" role="group" aria-label="Modo">
              <button type="button" class="seg-btn ${mode === 'leer' ? 'active' : ''}" data-mode="leer">Leer</button>
              <button type="button" class="seg-btn ${mode === 'editar' ? 'active' : ''}" data-mode="editar">Editar</button>
            </div>
            ${mode === 'editar' ? '<button class="btn primary" id="planSave" type="button">Guardar</button>' : ''}
          </div>
        </div>
        <div class="plan-box-body">${right}</div>
      </section>
    </div>
  `;

  // Documento
  const saveUrl = container.querySelector('#planUrlSave');
  if (saveUrl) saveUrl.addEventListener('click', () => {
    const v = container.querySelector('#planUrl').value.trim();
    const err = container.querySelector('#planUrlErr');
    if (!/^https?:\/\//i.test(v)) {
      err.textContent = 'Pega un enlace completo (empieza por https://).';
      err.style.display = 'block';
      return;
    }
    editingUrl = false;
    state.saveTradingPlan({ docUrl: v, updatedAt: Date.now() });
    showToast('Documento insertado');
    render(container);
  });
  const cancelUrl = container.querySelector('#planUrlCancel');
  if (cancelUrl) cancelUrl.addEventListener('click', () => { editingUrl = false; render(container); });
  const editUrl = container.querySelector('#planUrlEdit');
  if (editUrl) editUrl.addEventListener('click', () => { editingUrl = true; render(container); });
  const rmUrl = container.querySelector('#planUrlRemove');
  if (rmUrl) rmUrl.addEventListener('click', () => {
    editingUrl = false;
    state.saveTradingPlan({ docUrl: '', updatedAt: Date.now() });
    showToast('Documento quitado');
    render(container);
  });

  // Plan escrito
  container.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.mode === mode) return;
    if (b.dataset.mode === 'leer' && draft != null && draft !== saved
        && !confirm('Tienes cambios sin guardar en el plan. ¿Descartarlos?')) return;
    if (b.dataset.mode === 'leer') draft = null;
    mode = b.dataset.mode;
    render(container);
  }));
  const ta = container.querySelector('#planText');
  if (ta) {
    attachDictation(ta);
    ta.addEventListener('input', () => {
      draft = ta.value;
      const st = container.querySelector('#planStatus');
      const isDirty = draft !== saved;
      st.textContent = isDirty ? 'Cambios sin guardar' : 'Guardado';
      st.classList.toggle('dirty', isDirty);
      container.querySelector('#planWords').textContent = words(draft);
    });
  }
  const saveBtn = container.querySelector('#planSave');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const content = ta.value;
    draft = null;
    mode = content.trim() ? 'leer' : 'editar';
    state.saveTradingPlan({ content, updatedAt: Date.now() });   // emite → se repinta
    showToast('Plan guardado');
  });
}

// Convierte un enlace de Google Drive/Docs en su URL embebible (/preview).
// Devuelve null si no se puede embeber (otro dominio, carpeta, etc.).
export function embedUrl(url) {
  let u;
  try { u = new URL(url); } catch (_) { return null; }
  if (u.hostname === 'docs.google.com') {
    const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  }
  if (u.hostname === 'drive.google.com') {
    const m = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
    const id = u.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  }
  return null;
}

// Bloque grande del documento: vista previa embebida si es Drive/Docs,
// o un botón grande para abrirlo en pestaña nueva. `noun` personaliza el texto
// (lo usa Protocolos).
export function docBlock(url, noun = 'plan') {
  const embed = embedUrl(url);
  if (embed) {
    return `
      <div class="card" style="padding:0;overflow:hidden;">
        <div class="card-head" style="padding:14px 16px;">
          <div class="card-title">📄 Documento (${noun})</div>
          <a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir en Drive ↗</a>
        </div>
        <iframe class="plan-embed" src="${esc(embed)}" loading="lazy" allowfullscreen></iframe>
        <div class="plan-embed-note">¿No se ve? El documento debe estar compartido como <strong>“Cualquiera con el enlace”</strong> en Drive.</div>
      </div>`;
  }
  return `
    <a class="card plan-doc-cta" href="${esc(url)}" target="_blank" rel="noopener noreferrer">
      <span class="pd-icon">📄</span>
      <span class="pd-text"><strong>Abrir documento</strong><small>Está en un enlace externo · se abre en una pestaña nueva</small></span>
      <span class="pd-arrow">↗</span>
    </a>`;
}

export function tradingPlanView(container) {
  mode = 'leer';
  draft = null;
  editingUrl = false;
  render(container);
  // Mientras se escribe no se repinta (borraría el textarea a medias).
  return state.on(() => { if (!(mode === 'editar' && draft != null)) render(container); });
}
