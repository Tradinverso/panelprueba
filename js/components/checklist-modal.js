// Pop-up del checklist pre-sesión. Se abre desde el botón "Checklist n/5" del
// Dashboard y desde el anillo de la Mesa recogida. El estado se guarda por
// TRAMO (currentChecklistKey): se reactiva a medianoche y en las aperturas de
// Londres y NY, porque hay quien opera dos sesiones.
//
// onChange(): se llama cada vez que cambia un punto (para repintar botón/anillo).

import { storage } from '../storage.js';
import { openModal, closeModal } from './modal.js';
import { CHECKLIST_ITEMS, currentChecklistKey, dailyChecklistKey, checklistProgress } from '../utils/checklist-items.js';

export function openChecklistModal(onChange = () => {}) {
  const tramoKey = currentChecklistKey();
  const dailyKey = dailyChecklistKey();
  const marcado = (it, i) => (it.daily ? storage.getChecklist(dailyKey)[i] : storage.getChecklist(tramoKey)[i]);

  // SIEMPRE se muestran los 5 puntos. Los diarios ("he dormido bien") ya
  // respondidos hoy salen pre-marcados — nunca se ocultan.
  const body = `
    <div class="card-sub" style="margin-bottom:14px;">Complétalo antes de abrir la primera operación. Se reactiva cada día y en las aperturas de Londres y Nueva York.</div>
    <div class="chk-progress"><div class="chk-progress-head"><span>Progreso</span><span id="chkCount"></span></div><div class="chk-progress-bar"><div id="chkBar"></div></div></div>
    <div class="chk-list">
      ${CHECKLIST_ITEMS.map((it, i) => `
        <button type="button" class="chk-row ${marcado(it, i) ? 'on' : ''}" data-chk="${i}" aria-pressed="${marcado(it, i) ? 'true' : 'false'}">
          <span class="chk-box">✓</span>
          <span class="chk-text">${it.text}${it.daily ? ' <small>(una vez al día)</small>' : ''}</span>
        </button>`).join('')}
    </div>
    <div class="chk-tools"><button type="button" class="btn" id="chkAll">Marcar todo</button><button type="button" class="btn" id="chkNone">Desmarcar todo</button></div>`;

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
    if (b) { b.style.width = (p.done / p.total * 100) + '%'; b.classList.toggle('done', p.done === p.total); }
    root.querySelectorAll('[data-chk]').forEach(btn => {
      const i = +btn.dataset.chk;
      const on = !!marcado(CHECKLIST_ITEMS[i], i);
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    onChange(p);
  };
  const setItem = (i, v) => {
    const key = CHECKLIST_ITEMS[i].daily ? dailyKey : tramoKey;
    const d = storage.getChecklist(key);
    d[i] = v;
    storage.setChecklist(key, d);
  };
  root.querySelectorAll('[data-chk]').forEach(btn => btn.addEventListener('click', () => {
    const i = +btn.dataset.chk;
    setItem(i, !marcado(CHECKLIST_ITEMS[i], i));
    paint();
  }));
  root.querySelector('#chkAll').addEventListener('click', () => { CHECKLIST_ITEMS.forEach((_, i) => setItem(i, true)); paint(); });
  root.querySelector('#chkNone').addEventListener('click', () => { CHECKLIST_ITEMS.forEach((_, i) => setItem(i, false)); paint(); });
  paint();
}

export { closeModal };
