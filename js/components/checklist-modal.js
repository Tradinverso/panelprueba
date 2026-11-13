// Pop-up del checklist pre-sesión. Se abre desde el botón "Checklist n/5" del
// Dashboard y desde el anillo de la Mesa recogida. El estado se guarda por
// TRAMO (currentChecklistKey): se reactiva a medianoche y en las aperturas de
// Londres y NY, porque hay quien opera dos sesiones.
//
// Cada alumno puede cambiar los puntos por los suyos ("Editar mi lista"): se
// guardan en su cuenta. Sin lista propia se usa la de Tradinverso.
//
// onChange(): se llama cada vez que cambia un punto (para repintar botón/anillo).

import { storage } from '../storage.js';
import { state } from '../state.js';
import { openModal, closeModal } from './modal.js';
import {
  CHECKLIST_ITEMS, CHECKLIST_MAX, CHECKLIST_TEXTO_MAX, checklistItems, checklistEsPropia, guardarChecklist,
  currentChecklistKey, dailyChecklistKey, checklistProgress,
} from '../utils/checklist-items.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function openChecklistModal(onChange = () => {}) {
  const items = checklistItems();
  const tramoKey = currentChecklistKey();
  const dailyKey = dailyChecklistKey();
  const marcado = (it, i) => (it.daily ? storage.getChecklist(dailyKey)[i] : storage.getChecklist(tramoKey)[i]);

  // SIEMPRE se muestran todos los puntos. Los diarios ("he dormido bien") ya
  // respondidos hoy salen pre-marcados — nunca se ocultan.
  const body = `<div class="chk">
    <div class="card-sub" style="margin-bottom:14px;">Complétalo antes de abrir la primera operación. Se reactiva cada día y en las aperturas de Londres y Nueva York.</div>
    <div class="chk-progress"><div class="chk-progress-head"><span>Progreso</span><span id="chkCount"></span></div><div class="chk-progress-bar"><div id="chkBar"></div></div></div>
    <div class="chk-list">
      ${items.map((it, i) => `
        <button type="button" class="chk-row ${marcado(it, i) ? 'on' : ''}" data-chk="${i}" aria-pressed="${marcado(it, i) ? 'true' : 'false'}">
          <span class="chk-box">✓</span>
          <span class="chk-text">${esc(it.text)}${it.daily ? ' <small>(una vez al día)</small>' : ''}</span>
        </button>`).join('')}
    </div>
    <div class="chk-tools">
      <button type="button" class="btn" id="chkAll">Marcar todo</button><button type="button" class="btn" id="chkNone">Desmarcar todo</button>
      ${state.readOnly ? '' : '<button type="button" class="btn ghost chk-edit-btn" id="chkEdit">Editar mi lista</button>'}
    </div></div>`;

  openModal({
    title: 'Checklist pre-sesión',
    body,
    actions: [{ label: 'Listo', variant: 'primary', onClick: close => close() }],
  });

  const root = document.getElementById('modal-root');
  const paint = () => {
    const p = checklistProgress();
    const c = root.querySelector('#chkCount'); if (c) c.textContent = `${p.done}/${p.total}`;
    const b = root.querySelector('#chkBar');
    if (b) { b.style.width = (p.total ? p.done / p.total * 100 : 0) + '%'; b.classList.toggle('done', p.done === p.total); }
    root.querySelectorAll('[data-chk]').forEach(btn => {
      const i = +btn.dataset.chk;
      const on = !!marcado(items[i], i);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    onChange(p);
  };
  const setItem = (i, v) => {
    const key = items[i].daily ? dailyKey : tramoKey;
    const d = storage.getChecklist(key);
    d[i] = v;
    storage.setChecklist(key, d);
  };
  root.querySelectorAll('[data-chk]').forEach(btn => btn.addEventListener('click', () => {
    const i = +btn.dataset.chk;
    setItem(i, !marcado(items[i], i));
    paint();
  }));
  root.querySelector('#chkAll').addEventListener('click', () => { items.forEach((_, i) => setItem(i, true)); paint(); });
  root.querySelector('#chkNone').addEventListener('click', () => { items.forEach((_, i) => setItem(i, false)); paint(); });
  root.querySelector('#chkEdit')?.addEventListener('click', () => openChecklistEditor(onChange));
  paint();
}

// Editor de la lista: cambiar el texto de cada punto, quitarlo, subirlo,
// añadir otros y decidir si se pregunta en cada sesión o una vez al día.
function openChecklistEditor(onChange) {
  let borrador = checklistItems().map(it => ({ ...it }));
  const volver = () => openChecklistModal(onChange);

  openModal({
    title: 'Mi checklist',
    body: `<div class="chk">
      <div class="card-sub" style="margin-bottom:14px;">Pon los puntos que tú necesitas antes de operar. Se guarda en tu cuenta.</div>
      <div class="chk-edit-list" id="chkEditList"></div>
      <div class="chk-tools">
        <button type="button" class="btn" id="chkAdd">+ Añadir punto</button>
        <button type="button" class="btn ghost" id="chkReset" title="Vuelve a los puntos de Tradinverso">Volver a la de Tradinverso</button>
      </div>
      <div class="chk-edit-msg" id="chkEditMsg"></div></div>`,
    actions: [
      { label: 'Cancelar', onClick: volver },
      { label: 'Guardar', variant: 'primary', onClick: () => {
        leer();
        const validos = borrador.filter(x => x.text.trim());
        if (!validos.length) { aviso('Deja al menos un punto.'); return; }
        // Igual que la de Tradinverso → no se guarda como propia.
        const igual = validos.length === CHECKLIST_ITEMS.length && validos.every((x, i) => x.text.trim() === CHECKLIST_ITEMS[i].text && !!x.daily === CHECKLIST_ITEMS[i].daily);
        guardarChecklist(igual ? null : validos);
        volver();
      } },
    ],
  });

  const root = document.getElementById('modal-root');
  const lista = root.querySelector('#chkEditList');
  const aviso = t => { root.querySelector('#chkEditMsg').textContent = t; };
  // Pasa lo escrito en los campos al borrador antes de repintar o guardar.
  const leer = () => lista.querySelectorAll('[data-fila]').forEach(f => {
    const it = borrador[+f.dataset.fila];
    if (!it) return;
    it.text = f.querySelector('input[type="text"]').value;
    it.daily = f.querySelector('select').value === 'dia';
  });
  const pintar = () => {
    lista.innerHTML = borrador.map((it, i) => `
      <div class="chk-edit-row" data-fila="${i}">
        <button type="button" class="chk-edit-ic" data-subir="${i}" title="Subir" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
        <input type="text" class="form-input" maxlength="${CHECKLIST_TEXTO_MAX}" value="${esc(it.text)}" placeholder="Escribe el punto" aria-label="Punto ${i + 1}">
        <select class="select" title="Cuándo se pregunta" aria-label="Cuándo se pregunta">
          <option value="sesion" ${it.daily ? '' : 'selected'}>Cada sesión</option>
          <option value="dia" ${it.daily ? 'selected' : ''}>Una vez al día</option>
        </select>
        <button type="button" class="chk-edit-ic del" data-quitar="${i}" title="Quitar" aria-label="Quitar">×</button>
      </div>`).join('');
    root.querySelector('#chkAdd').disabled = borrador.length >= CHECKLIST_MAX;
    aviso(borrador.length >= CHECKLIST_MAX ? `Máximo ${CHECKLIST_MAX} puntos.` : '');
  };
  lista.addEventListener('click', e => {
    const subir = e.target.closest('[data-subir]'), quitar = e.target.closest('[data-quitar]');
    if (!subir && !quitar) return;
    leer();
    if (subir) { const i = +subir.dataset.subir; [borrador[i - 1], borrador[i]] = [borrador[i], borrador[i - 1]]; }
    if (quitar) borrador.splice(+quitar.dataset.quitar, 1);
    pintar();
  });
  root.querySelector('#chkAdd').addEventListener('click', () => {
    leer();
    if (borrador.length >= CHECKLIST_MAX) return;
    borrador.push({ id: 'c' + Date.now().toString(36), text: '', daily: false });
    pintar();
    const campos = lista.querySelectorAll('input[type="text"]');
    campos[campos.length - 1]?.focus();
  });
  root.querySelector('#chkReset').addEventListener('click', () => {
    borrador = CHECKLIST_ITEMS.map(it => ({ ...it }));
    pintar();
    aviso(checklistEsPropia() ? 'Puntos de Tradinverso puestos. Pulsa Guardar para dejarlos.' : '');
  });
  pintar();
}

export { closeModal };
