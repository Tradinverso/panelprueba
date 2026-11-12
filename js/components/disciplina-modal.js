// Desglose de la puntuación de disciplina. Lo abren el Dashboard (la del
// propio alumno) y Mis Alumnos (la de cada uno).

import { openModal } from './modal.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Anillo con la puntuación dentro. `size` en px.
export function anilloDisciplina(res, size = 44) {
  const r = 15.9155;                       // circunferencia = 100
  const v = res.score == null ? 0 : res.score;
  return `
    <span class="disc-ring disc-${res.nivel.id}" style="width:${size}px;height:${size}px;">
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle class="disc-ring-bg" cx="18" cy="18" r="${r}"></circle>
        <circle class="disc-ring-fg" cx="18" cy="18" r="${r}" stroke-dasharray="${v} ${100 - v}" transform="rotate(-90 18 18)"></circle>
      </svg>
      <b>${res.score == null ? '–' : res.score}</b>
    </span>`;
}

export function openDisciplinaModal(res, nombre = '') {
  const de = nombre ? ` de ${esc(nombre)}` : '';
  if (res.score == null) {
    openModal({
      title: `Disciplina${de}`,
      body: `<div class="disc"><p class="disc-nota">${res.faltaMarcar
        ? 'Faltan trades con el plan y la sensación apuntados. Sin eso no hay disciplina que medir.'
        : `Hacen falta 10 trades para calcularla. Faltan ${res.falta}.`}</p></div>`,
      actions: [{ label: 'Cerrar', onClick: c => c() }],
    });
    return;
  }
  // La parte que más puntos deja por el camino es por donde empezar.
  const validas = res.partes.filter(p => !p.sinDatos);
  const peor = [...validas].sort((a, b) => (b.max - b.pts) - (a.max - a.pts))[0];
  const filas = res.partes.map(p => `
    <div class="disc-row${p.sinDatos ? ' sin' : ''}">
      <div class="disc-row-top">
        <span class="disc-row-name">${esc(p.label)}</span>
        <span class="disc-row-pts">${p.sinDatos ? 'sin datos' : `<b>${p.pts}</b> de ${p.max}`}</span>
      </div>
      <div class="disc-bar"><i class="${p.sinDatos ? '' : p.ratio >= 0.8 ? 'ok' : p.ratio >= 0.5 ? 'mid' : 'low'}" style="width:${p.sinDatos ? 0 : Math.max(3, p.ratio * 100)}%"></i></div>
      <div class="disc-row-det${p.id === 'resultado' ? ' pnl-value' : ''}">${esc(p.detalle)}</div>
    </div>`).join('');
  openModal({
    title: `Disciplina${de}`,
    body: `
      <div class="disc">
        <div class="disc-head">
          ${anilloDisciplina(res, 84)}
          <div>
            <div class="disc-nivel disc-txt-${res.nivel.id}">${esc(res.nivel.label)}</div>
            <div class="disc-nota">${res.score} de 100 · ${esc(res.ventana)}, ${res.n} trades</div>
            <div class="disc-nota">Mide cómo se ejecuta, no cuánto se gana.</div>
          </div>
        </div>
        ${filas}
        ${peor && peor.max - peor.pts >= 3 ? `<div class="disc-tip"><b>Por dónde empezar:</b> ${esc(peor.label.toLowerCase())}. ${esc(peor.consejo)}</div>` : ''}
        ${res.reescalada ? '<div class="disc-nota">Las partes sin datos no cuentan: el resto se ajusta a 100.</div>' : ''}
      </div>`,
    actions: [{ label: 'Cerrar', onClick: c => c() }],
  });
}
