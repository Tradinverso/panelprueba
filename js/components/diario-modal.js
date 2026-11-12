// Pop-up "Diario del día": los tres pasos de un día de trading.
//   1 · Plan      antes de operar: sesgo, niveles, una regla y cómo llegas
//   2 · Trades    los del día, que aparecen solos al registrarlos
//   3 · Revisión  al acabar: cuatro toques y tres líneas
// Se abre desde Psicotrading → Reflexiones (calendario y tarjeta de hoy), desde
// la columna Hoy, desde el Dashboard y desde el Calendario.

import { state } from '../state.js';
import { router } from '../router.js';
import { openModal, closeModal } from './modal.js';
import { showToast } from './toast.js';
import { ic } from './icons.js';
import { attachDictation } from '../utils/dictation.js';
import { periodStats } from '../utils/period-stats.js';
import { fmtPct } from '../utils/number-format-es.js';
import { reglaDelDia } from '../utils/reglas-del-dia.js';
import { STRATEGIES } from '../utils/strategy-config.js';
import { POSITIVAS, NEUTRALES, NEGATIVAS } from '../utils/sensaciones.js';
import {
  SESGOS, ESTADOS, CUMPLIDO, ERRORES, etiqueta, hoy, diaDe, estadoDia, tradesDe,
  guardarPlan, guardarRevision, borrarDia,
} from '../utils/diario.js';

const SENSACIONES = [...POSITIVAS, ...NEUTRALES, ...NEGATIVAS];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function fechaLarga(dia) {
  const d = new Date(dia + 'T12:00:00');
  const t = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
const hora = ms => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

// `paso`: 'plan' | 'trades' | 'review'. Sin indicar, abre el que toca.
export function openDiarioModal(dia = hoy(), paso = null) {
  const e = estadoDia(dia);
  let actual = paso || (!e.plan && dia >= hoy() ? 'plan' : !e.review && tradesDe(dia).length ? 'review' : !e.plan && !e.review ? 'plan' : 'review');
  let borrar = false;
  // Borrador de lo que se está escribiendo (sobrevive a cambiar de paso)
  const d0 = diaDe(dia);
  const plan = { sesgo: '', niveles: '', regla: '', estado: '', ...(d0.plan || {}) };
  const review = { plan: '', estado: '', error: '', limites: null, bien: '', mejorar: '', leccion: '', ...(d0.review || {}) };
  let notas = d0.content;

  openModal({ title: fechaLarga(dia), meta: dia === hoy() ? 'Diario de hoy' : 'Diario del día', size: 'lg', body: '<div class="dia" id="diaRoot"></div>', actions: [] });
  const root = document.getElementById('diaRoot');
  if (!root) return;

  const chips = (grupo, lista, valor, extra = '') => `<div class="pill-group dia-chips" data-grupo="${grupo}">${lista.map(x => {
    const id = Array.isArray(x) ? x[0] : (x.id ?? x), label = Array.isArray(x) ? x[1] : (x.label ?? x);
    return `<button type="button" class="pill ${String(valor) === String(id) ? 'active' : ''} ${x.tono || ''}" data-v="${esc(id)}">${esc(label)}</button>`;
  }).join('')}${extra}</div>`;

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
      const sello = guardado.plan
        ? `<div class="dia-sello ${guardado.plan.antes ? 'ok' : ''}">${guardado.plan.antes ? '✓ Plan escrito antes de operar' : 'Plan apuntado con el día ya empezado'} · ${hora(guardado.plan.at)}</div>` : '';
      cuerpo = `
        <div class="dia-q">Sesgo del día</div>
        ${chips('sesgo', SESGOS, plan.sesgo)}
        <label class="dia-q" for="diaNiveles">Niveles y zonas que vigilo</label>
        <div class="dia-field"><textarea class="form-textarea" id="diaNiveles" data-plan="niveles" rows="3" placeholder="EUR/USD: zona 1.0850 de más de 7 días · NQ: máximo de Asia…">${esc(plan.niveles)}</textarea></div>
        <label class="dia-q" for="diaRegla">Mi regla de hoy</label>
        <div class="dia-row"><input class="form-input" id="diaRegla" data-plan="regla" maxlength="200" value="${esc(plan.regla)}" placeholder="Una sola. La que más te cuesta cumplir.">
          <button type="button" class="btn" data-acc="regla">Usar la regla del día</button></div>
        <div class="dia-q">¿Cómo llego hoy?</div>
        ${chips('estado', ESTADOS, plan.estado)}
        ${sello}
        <div class="dia-foot"><span class="dia-hint">Dos minutos antes de abrir la plataforma. Luego «¿seguí el plan?» deja de ser una opinión.</span>
          <button type="button" class="btn primary" data-acc="guardar-plan">Guardar plan</button></div>`;
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
          <button type="button" class="btn primary" data-paso="review">Revisar el día →</button></div>`
        : `<div class="dia-vacio">${dia === hoy() ? 'Hoy todavía no has registrado ningún trade.' : 'Ese día no hay trades registrados.'}<br><small>Los trades que registras aparecen aquí solos.</small></div>
        <div class="dia-foot"><span></span>${dia === hoy() ? `<button type="button" class="btn primary" data-acc="nuevo">+ Nuevo trade</button>` : `<button type="button" class="btn primary" data-paso="review">Revisar el día →</button>`}</div>`;
    } else {
      cuerpo = `
        ${guardado.plan ? `<div class="dia-recuerda"><b>Tu plan era:</b> ${[etiqueta(SESGOS, guardado.plan.sesgo), guardado.plan.regla && `regla «${esc(guardado.plan.regla)}»`].filter(Boolean).join(' · ') || 'sin detalles'}${guardado.plan.niveles ? `<br><span>${esc(guardado.plan.niveles)}</span>` : ''}</div>` : ''}
        <div class="dia-grid2">
          <div><div class="dia-q">¿Seguiste el plan?</div>${chips('plan', CUMPLIDO, review.plan)}</div>
          <div><div class="dia-q">¿Respetaste tus límites?</div>${chips('limites', [[true, 'Sí'], [false, 'No']], review.limites)}</div>
        </div>
        <div class="dia-q">¿Cómo estuviste?</div>
        ${chips('estado', SENSACIONES, review.estado)}
        <div class="dia-q">Error principal</div>
        ${chips('error', ERRORES, review.error)}
        <label class="dia-q" for="diaBien">Qué hice bien</label>
        <div class="dia-field"><textarea class="form-textarea" id="diaBien" data-rev="bien" rows="2" maxlength="600">${esc(review.bien)}</textarea></div>
        <label class="dia-q" for="diaMejorar">Qué mejoro mañana</label>
        <div class="dia-field"><textarea class="form-textarea" id="diaMejorar" data-rev="mejorar" rows="2" maxlength="600">${esc(review.mejorar)}</textarea></div>
        <label class="dia-q" for="diaLeccion">La lección de hoy <small>te volverá otro día, antes de operar</small></label>
        <div class="dia-field"><textarea class="form-textarea" id="diaLeccion" data-rev="leccion" rows="2" maxlength="300" placeholder="Una frase que te dirías mañana.">${esc(review.leccion)}</textarea></div>
        <details class="dia-notas" ${notas.trim() ? 'open' : ''}><summary>Notas libres</summary>
          <div class="dia-field"><textarea class="form-textarea" data-notas rows="4" placeholder="Lo que quieras añadir sobre el día.">${esc(notas)}</textarea></div></details>
        <div class="dia-foot"><span class="dia-hint">${guardado.review ? `Revisión guardada · ${hora(guardado.review.at)}` : 'Cuatro toques y tres líneas.'}</span>
          <button type="button" class="btn primary" data-acc="guardar-review">Guardar revisión</button></div>`;
    }

    root.innerHTML = `
      <div class="dia-top">
        <div class="dia-steps">
          ${pasoBtn('plan', 1, 'Plan', 'Antes de operar', est.plan)}
          ${pasoBtn('trades', 2, 'Trades', ts.length ? `${ts.length} registrado${ts.length === 1 ? '' : 's'}` : 'Salen solos', ts.length > 0)}
          ${pasoBtn('review', 3, 'Revisión', 'Al acabar', est.review)}
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
      if (actual === 'plan') plan[g] = plan[g] === v ? '' : v;
      else if (g === 'limites') review.limites = String(review.limites) === v ? null : v === 'true';
      else review[g] = review[g] === v ? '' : v;
      pintar(); return;
    }
    const p = e.target.closest('[data-paso]');
    if (p) { leer(); actual = p.dataset.paso; borrar = false; pintar(); return; }
    const a = e.target.closest('[data-acc]');
    if (!a) return;
    const acc = a.dataset.acc;
    leer();
    if (acc === 'cerrar') closeModal();
    else if (acc === 'regla') { plan.regla = reglaDelDia().main; pintar(); }
    else if (acc === 'nuevo') { closeModal(); router.go('#/nuevo'); }
    else if (acc === 'borrar') { borrar = true; pintar(); }
    else if (acc === 'no-borrar') { borrar = false; pintar(); }
    else if (acc === 'si-borrar') { borrarDia(dia); closeModal(); showToast('Diario del día borrado'); }
    else if (acc === 'guardar-plan') {
      if (!plan.sesgo && !plan.niveles.trim() && !plan.regla.trim() && !plan.estado) { showToast('Apunta al menos el sesgo o una regla'); return; }
      guardarPlan(dia, { sesgo: plan.sesgo, niveles: plan.niveles.trim(), regla: plan.regla.trim(), estado: plan.estado });
      showToast('Plan del día guardado');
      actual = 'trades'; pintar();
    } else if (acc === 'guardar-review') {
      if (!review.plan && !review.estado && !review.error && review.limites === null && !review.bien.trim() && !review.mejorar.trim() && !review.leccion.trim() && !notas.trim()) { showToast('La revisión está vacía'); return; }
      guardarRevision(dia, { plan: review.plan, estado: review.estado, error: review.error, limites: review.limites, bien: review.bien.trim(), mejorar: review.mejorar.trim(), leccion: review.leccion.trim() }, notas.trim());
      showToast('Revisión guardada');
      pintar();
    }
  });

  pintar();
}
