// Pop-up "Diario del día": los dos protocolos de Tradinverso alrededor de la
// sesión, con los trades en medio.
//   1 · Diario inverso      antes de empezar: hoy no haré · hoy mejoraré ·
//                           si pasa X haré Y · mi regla de hoy · cómo llego
//   2 · Trades              los del día, que aparecen solos al registrarlos
//   3 · Diario del trader   al cerrar: ¿he respetado mi plan? · qué he hecho
//                           bien · dónde me he saboteado · qué quiero mejorar
// Se abre desde Psicotrading → Reflexiones (calendario y tarjeta de hoy), desde
// la columna Hoy, desde el Dashboard y desde el Calendario.

import { state } from '../state.js';
import { router } from '../router.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { attachDictation } from '../utils/dictation.js';
import { periodStats } from '../utils/period-stats.js';
import { fmtPct } from '../utils/number-format-es.js';
import { reglaDelDia } from '../utils/reglas-del-dia.js';
import { STRATEGIES } from '../utils/strategy-config.js';
import { PROTOCOLOS_FIJOS } from '../utils/protocolos-fijos.js';
import {
  ESTADOS, CUMPLIDO, SIN_OPERAR, etiqueta, hoy, diaDe, estadoDia, tradesDe, mejorarPendiente,
  guardarPlan, guardarRevision, marcarSinOperar, borrarDia,
} from '../utils/diario.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fechaLarga(dia) {
  const d = new Date(dia + 'T12:00:00');
  const t = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const hora = ms => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
// Enlace al PDF del protocolo (Psicotrading → Protocolos), si está dado de alta.
function enlaceProtocolo(titulo) {
  const p = PROTOCOLOS_FIJOS.find(x => x.titulo.toLowerCase() === titulo.toLowerCase());
  return p ? `<a class="dia-proto" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Ver el protocolo ↗</a>` : '';
}

const PLAN_VACIO = { noHare: '', mejorare: '', siPasa: '', hare: '', regla: '', estado: '' };
const REV_VACIA = { plan: '', bien: '', sabotaje: '', mejorar: '', leccion: '' };
const hayPlan = p => !!(p.noHare.trim() || p.mejorare.trim() || p.siPasa.trim() || p.hare.trim() || p.regla.trim() || p.estado);
const hayRev = r => !!(r.plan || r.bien.trim() || r.sabotaje.trim() || r.mejorar.trim() || r.leccion.trim());

// `paso`: 'plan' | 'trades' | 'review'. Sin indicar, abre el que toca.
export function openDiarioModal(dia = hoy(), paso = null) {
  const e = estadoDia(dia);
  let actual = paso || (!e.plan && dia >= hoy() ? 'plan' : !e.review && tradesDe(dia).length ? 'review' : !e.plan && !e.review ? 'plan' : 'review');
  let borrar = false;
  // Borrador de lo que se está escribiendo (sobrevive a cambiar de paso)
  const d0 = diaDe(dia);
  const plan = { ...PLAN_VACIO, ...(d0.plan || {}) };
  const review = { ...REV_VACIA, ...(d0.review || {}) };
  let notas = d0.content;

  openModal({ title: fechaLarga(dia), meta: dia === hoy() ? 'Diario de hoy' : 'Diario del día', size: 'lg', body: '<div class="dia" id="diaRoot"></div>', actions: [] });
  const root = document.getElementById('diaRoot');
  if (!root) return;

  const chips = (grupo, lista, valor) => `<div class="pill-group dia-chips" data-grupo="${grupo}">${lista.map(x => {
    const id = Array.isArray(x) ? x[0] : (x.id ?? x), label = Array.isArray(x) ? x[1] : (x.label ?? x);
    return `<button type="button" class="pill ${String(valor) === String(id) ? 'active' : ''} ${x.tono || ''}" data-v="${esc(id)}">${esc(label)}</button>`;
  }).join('')}</div>`;
  const linea = (id, clave, attr, valor, etiqueta, ayuda, placeholder, max = 400) => `
    <label class="dia-q" for="${id}">${etiqueta}${ayuda ? ` <small>${ayuda}</small>` : ''}</label>
    <div class="dia-field"><textarea class="form-textarea" id="${id}" data-${attr}="${clave}" rows="2" maxlength="${max}" placeholder="${esc(placeholder)}">${esc(valor)}</textarea></div>`;

  function leer() {
    root.querySelectorAll('[data-plan]').forEach(i => { plan[i.dataset.plan] = i.value; });
    root.querySelectorAll('[data-rev]').forEach(i => { review[i.dataset.rev] = i.value; });
    const n = root.querySelector('[data-notas]'); if (n) notas = n.value;
  }

  function pintar() {
    const est = estadoDia(dia);
    const ts = tradesDe(dia);
    const st = periodStats(state.trades, state.cuentas, dia, dia);
    const guardado = diaDe(dia);
    const pasoBtn = (id, n, titulo, sub, hecho) => `
      <button type="button" class="dia-step ${actual === id ? 'on' : ''} ${hecho ? 'done' : ''}" data-paso="${id}">
        <span class="dia-step-n">${hecho ? '✓' : n}</span>
        <span><b>${titulo}</b><small>${sub}</small></span>
      </button>`;
    const color = v => v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted)';

    let cuerpo = '';
    if (actual === 'plan') {
      const ayer = mejorarPendiente(dia);
      const sello = guardado.plan
        ? `<div class="dia-sello ${guardado.plan.antes ? 'ok' : ''}">${guardado.plan.antes ? '✓ Escrito antes de operar' : 'Apuntado con el día ya empezado'} · ${hora(guardado.plan.at)}</div>` : '';
      cuerpo = `
        <div class="dia-cab"><div><b>Diario inverso</b><span>Antes de empezar el día</span></div>${enlaceProtocolo('Diario Inverso')}</div>
        ${linea('diaNoHare', 'noHare', 'plan', plan.noHare, 'Hoy no haré…', '', 'Lo que hoy no voy a hacer, pase lo que pase.')}
        ${linea('diaMejorare', 'mejorare', 'plan', plan.mejorare, 'Hoy mejoraré…', '', 'Una sola cosa.')}
        ${ayer && !plan.mejorare.trim() ? `<div class="dia-ayer">Al cerrar el ${ayer.dia.split('-').reverse().join('/')} escribiste: «${esc(ayer.texto)}» <button type="button" class="dia-link" data-acc="usar-ayer">Usarlo</button></div>` : ''}
        <div class="dia-q">Si pasa X, haré Y</div>
        <div class="dia-grid2 dia-si">
          <div class="dia-field"><textarea class="form-textarea" data-plan="siPasa" rows="2" maxlength="300" placeholder="Si pasa…" aria-label="Si pasa">${esc(plan.siPasa)}</textarea></div>
          <div class="dia-field"><textarea class="form-textarea" data-plan="hare" rows="2" maxlength="300" placeholder="…haré" aria-label="Haré">${esc(plan.hare)}</textarea></div>
        </div>
        <label class="dia-q" for="diaRegla">Mi regla de hoy</label>
        <div class="dia-row"><input class="form-input" id="diaRegla" data-plan="regla" maxlength="200" value="${esc(plan.regla)}" placeholder="Una sola. La que más te cuesta cumplir.">
          <button type="button" class="btn" data-acc="regla">Usar la regla del día</button></div>
        <div class="dia-q">¿Cómo llego hoy?</div>
        ${chips('estado', ESTADOS, plan.estado)}
        ${sello}
        <div class="dia-foot"><span class="dia-hint">Dos minutos antes de abrir la plataforma.</span>
          <button type="button" class="btn primary" data-acc="guardar-plan">Guardar diario inverso</button></div>`;
    } else if (actual === 'trades') {
      cuerpo = ts.length ? `
        <div class="dia-trades">
          ${ts.map(t => `
            <div class="dia-trade">
              <span class="dia-t-hora">${esc(t.open_str || '–')}</span>
              <span class="dia-t-que"><b>${esc((STRATEGIES[t.sheet] && STRATEGIES[t.sheet].label) || t.sheet)}</b> ${esc(t.pair || '')} · ${esc(String(t.setup || '').toUpperCase())}</span>
              <span class="dia-t-plan">${t.plan_followed === true ? '<span style="color:var(--green)">✓ plan</span>' : t.plan_followed === false ? '<span style="color:var(--red)">✗ fuera</span>' : ''}</span>
              <span class="dia-t-sens">${esc(t.sensacion || '')}</span>
              <span class="res-pill res-${esc(t.result)}">${esc(t.result)}</span>
              <span class="dia-t-pnl pnl-value" style="color:${color(t.pnl_pct)}">${fmtPct(t.pnl_pct, 2)}</span>
            </div>`).join('')}
        </div>
        <div class="dia-foot"><span class="dia-hint">Los trades que registras aparecen aquí solos.</span>
          ${dia === hoy() ? `<button type="button" class="btn" data-acc="nuevo">+ Nuevo trade</button>` : ''}
          <button type="button" class="btn primary" data-paso="review">Cerrar el día →</button></div>`
        : `<div class="dia-vacio">${dia === hoy() ? 'Hoy todavía no has registrado ningún trade.' : 'Ese día no hay trades registrados.'}<br><small>Los trades que registras aparecen aquí solos.</small></div>
        <div class="dia-sinop">
          ${guardado.sinOperar
            ? `<div class="dia-sinop-ok"><b>✓ Día sin operar</b>${etiqueta(SIN_OPERAR, guardado.sinOperar.motivo) ? ' · ' + esc(etiqueta(SIN_OPERAR, guardado.sinOperar.motivo)) : ''} <button type="button" class="dia-link" data-acc="quitar-sinop">Quitar</button></div>`
            : `<div class="dia-q">¿No operas ${dia === hoy() ? 'hoy' : 'ese día'}? Apúntalo: no operar también es seguir el plan.</div>
               <div class="pill-group dia-sinop-chips">${SIN_OPERAR.map(([id, l]) => `<button type="button" class="pill" data-sinop="${id}">${l}</button>`).join('')}</div>`}
        </div>
        <div class="dia-foot"><span></span>${dia === hoy() ? `<button type="button" class="btn" data-acc="nuevo">+ Nuevo trade</button>` : ''}<button type="button" class="btn primary" data-paso="review">Cerrar el día →</button></div>`;
    } else {
      const p = guardado.plan;
      const recuerdo = p ? [
        p.noHare && `<b>No haría:</b> ${esc(p.noHare)}`,
        p.mejorare && `<b>Mejoraría:</b> ${esc(p.mejorare)}`,
        (p.siPasa || p.hare) && `<b>Si pasa</b> ${esc(p.siPasa || '…')}, <b>haré</b> ${esc(p.hare || '…')}`,
        p.regla && `<b>Regla:</b> ${esc(p.regla)}`,
      ].filter(Boolean) : [];
      cuerpo = `
        <div class="dia-cab"><div><b>Diario del trader</b><span>Al cerrar el día</span></div>${enlaceProtocolo('Diario del Trader')}</div>
        ${recuerdo.length ? `<div class="dia-recuerda"><div class="dia-recuerda-t">Esta mañana escribiste</div>${recuerdo.map(x => `<div>${x}</div>`).join('')}</div>` : ''}
        <div class="dia-q">¿He respetado mi plan?</div>
        ${chips('plan', CUMPLIDO, review.plan)}
        ${linea('diaBien', 'bien', 'rev', review.bien, '¿Qué he hecho bien como trader?', '', '', 600)}
        ${linea('diaSabotaje', 'sabotaje', 'rev', review.sabotaje, '¿Dónde me he saboteado hoy?', '', '', 600)}
        ${linea('diaMejorar', 'mejorar', 'rev', review.mejorar, '¿Qué quiero mejorar mañana?', 'te lo recordaré mañana en el diario inverso', '', 600)}
        ${linea('diaLeccion', 'leccion', 'rev', review.leccion, 'La lección de hoy', 'opcional · te volverá otro día', 'Una frase que te dirías mañana.', 300)}
        <details class="dia-notas" ${notas.trim() ? 'open' : ''}><summary>Notas libres</summary>
          <div class="dia-field"><textarea class="form-textarea" data-notas rows="4" placeholder="Lo que quieras añadir sobre el día.">${esc(notas)}</textarea></div></details>
        <div class="dia-foot"><span class="dia-hint">${guardado.review ? `Guardado · ${hora(guardado.review.at)}` : 'Cuatro preguntas al acabar la sesión.'}</span>
          <button type="button" class="btn primary" data-acc="guardar-review">Guardar diario del trader</button></div>`;
    }

    root.innerHTML = `
      <div class="dia-top">
        <div class="dia-steps">
          ${pasoBtn('plan', 1, 'Diario inverso', 'Antes de empezar', est.plan)}
          ${pasoBtn('trades', 2, 'Trades', ts.length ? `${ts.length} registrado${ts.length === 1 ? '' : 's'}` : est.sinOperar ? 'Día sin operar' : 'Salen solos', ts.length > 0 || est.sinOperar)}
          ${pasoBtn('review', 3, 'Diario del trader', 'Al cerrar el día', est.review)}
        </div>
        <div class="dia-res">${st.count
          ? `<b class="pnl-value" style="color:${color(st.pnlSistema)}">${fmtPct(st.pnlSistema, 1)}</b><span>${st.count} trade${st.count === 1 ? '' : 's'} · ${st.tp} TP · ${st.sl} SL${st.be ? ` · ${st.be} BE` : ''}</span>`
          : `<b>–</b><span>sin trades</span>`}</div>
      </div>
      <div class="dia-body">${cuerpo}</div>
      <div class="dia-bottom">
        ${est.algo ? (borrar
          ? `<span>¿Borrar todo el diario de este día? <button type="button" class="btn" data-acc="no-borrar">Cancelar</button> <button type="button" class="btn danger" data-acc="si-borrar">Sí, borrar</button></span>`
          : `<button type="button" class="dia-link" data-acc="borrar">Borrar el diario de este día</button>`) : '<span></span>'}
        <button type="button" class="btn" data-acc="cerrar">Cerrar</button>
      </div>`;
    root.querySelectorAll('textarea').forEach(t => attachDictation(t));
  }

  root.addEventListener('click', e => {
    const chip = e.target.closest('.dia-chips .pill');
    if (chip) {
      leer();
      const g = chip.closest('.dia-chips').dataset.grupo, v = chip.dataset.v;
      const destino = actual === 'plan' ? plan : review;
      destino[g] = destino[g] === v ? '' : v;
      pintar(); return;
    }
    const so = e.target.closest('[data-sinop]');
    if (so) { leer(); marcarSinOperar(dia, so.dataset.sinop); showToast('Día sin operar apuntado'); pintar(); return; }
    const p = e.target.closest('[data-paso]');
    if (p) { leer(); actual = p.dataset.paso; borrar = false; pintar(); return; }
    const a = e.target.closest('[data-acc]');
    if (!a) return;
    const acc = a.dataset.acc;
    leer();
    if (acc === 'cerrar') closeModal();
    else if (acc === 'regla') { plan.regla = reglaDelDia().main; pintar(); }
    else if (acc === 'quitar-sinop') { marcarSinOperar(dia, null); pintar(); }
    else if (acc === 'usar-ayer') { const y = mejorarPendiente(dia); if (y) plan.mejorare = y.texto; pintar(); }
    else if (acc === 'nuevo') { closeModal(); router.go('#/nuevo'); }
    else if (acc === 'borrar') { borrar = true; pintar(); }
    else if (acc === 'no-borrar') { borrar = false; pintar(); }
    else if (acc === 'si-borrar') { borrarDia(dia); closeModal(); showToast('Diario del día borrado'); }
    else if (acc === 'guardar-plan') {
      if (!hayPlan(plan)) { showToast('Escribe al menos una de las frases'); return; }
      guardarPlan(dia, { noHare: plan.noHare.trim(), mejorare: plan.mejorare.trim(), siPasa: plan.siPasa.trim(), hare: plan.hare.trim(), regla: plan.regla.trim(), estado: plan.estado });
      showToast('Diario inverso guardado');
      actual = 'trades'; pintar();
    } else if (acc === 'guardar-review') {
      if (!hayRev(review) && !notas.trim()) { showToast('El diario del trader está vacío'); return; }
      guardarRevision(dia, { plan: review.plan, bien: review.bien.trim(), sabotaje: review.sabotaje.trim(), mejorar: review.mejorar.trim(), leccion: review.leccion.trim() }, notas.trim());
      showToast('Diario del trader guardado');
      pintar();
    }
  });

  pintar();
}
