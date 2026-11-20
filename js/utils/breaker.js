// Cortacircuitos de riesgo (módulo opcional, Ajustes → Módulos): un límite de
// SL por cuenta y día. Cuando una cuenta llega al límite:
//   · al guardar el SL que lo alcanza sale un aviso grande de parar;
//   · la cuenta queda marcada «Parada hoy» en la columna Hoy y en Mis cuentas;
//   · si se apunta otro trade en esa cuenta el mismo día, la confirmación lo
//     advierte antes de guardar.
// No bloquea nada: el diario apunta lo que ya ha pasado en el broker, así que
// su trabajo es que el aviso sea imposible de ignorar, no impedir el registro.
//
// Datos: config.cortacircuitos (true/false) y config.cortacircuitosSL (1–5).
// Sin cortacircuitosSL se usa LIMITE_POR_DEFECTO: 1, la misma regla que ya
// enseñaba la columna Hoy («SL hoy 0/1») y la que sigue la rotación de cuentas.
//
// Antes (hasta nov 2026) el módulo era una pausa de 5 minutos tras el primer SL,
// guardada en localStorage; initBreaker() borra esa clave antigua.

import { state } from '../state.js';
import { auth } from '../auth.js';
import { todayLocal } from './timezone.js';
import { openModal } from '../components/modal.js';

export const LIMITE_POR_DEFECTO = 1;
export const LIMITES = [1, 2, 3, 4, 5];
const CLAVE_ANTIGUA = 'tradinverso_breaker_until';

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

export const cortacircuitosActivo = () => (state.config || {}).cortacircuitos === true;

export function limiteSL() {
  const n = Math.round(Number((state.config || {}).cortacircuitosSL));
  return LIMITES.includes(n) ? n : LIMITE_POR_DEFECTO;
}

const hoy = () => todayLocal(auth.timezone());

// SL de una cuenta en una fecha (por defecto, hoy).
export function slDeCuenta(id, fecha = hoy(), trades = state.trades || []) {
  let n = 0;
  for (const t of trades) {
    if (t.date !== fecha || t.result !== 'SL') continue;
    if (Array.isArray(t.accounts) && t.accounts.some(a => a.accountId === id)) n++;
  }
  return n;
}

// ¿La cuenta ha llegado hoy a su límite? Solo con el módulo activado.
export function paradaHoy(id) {
  return cortacircuitosActivo() && slDeCuenta(id) >= limiteSL();
}

function nombreCuenta(id) {
  const c = (state.cuentas || []).find(x => x.id === id);
  if (!c) return 'Cuenta';
  const cap = c.capital >= 1000 ? `${Math.round(c.capital / 1000)}K` : (c.capital || '');
  return `${c.empresa || 'Cuenta'} ${cap}${c.numero ? ' #' + c.numero : ''}`.trim();
}

const sl = n => `${n} SL`;

// Para la confirmación de Nuevo trade: aviso si el trade va a cuentas que hoy
// ya están en su límite (contando los trades ya guardados, no este).
export function avisoAntesDeGuardar(trade) {
  if (!cortacircuitosActivo() || !trade || trade.date !== hoy()) return '';
  const lim = limiteSL();
  const paradas = (trade.accounts || []).map(a => a.accountId)
    .filter(id => slDeCuenta(id) >= lim);
  if (!paradas.length) return '';
  const nombres = paradas.map(id => `<b>${esc(nombreCuenta(id))}</b>`).join(', ');
  return `<div class="cc-aviso" role="alert">
    <span class="cc-aviso-ic">!</span>
    <div><b class="cc-aviso-tit">Ojo: ${paradas.length === 1 ? 'esta cuenta ya está parada hoy' : 'estas cuentas ya están paradas hoy'}.</b>
    ${nombres} ${paradas.length === 1 ? 'ha llegado' : 'han llegado'} a tu límite de ${sl(lim)} del día. Tu regla dice que hoy no se opera más en ${paradas.length === 1 ? 'ella' : 'ellas'}. Si el trade ya está hecho, apúntalo igual: el diario tiene que reflejar lo que pasó.</div>
  </div>`;
}

// Tras guardar: si este SL lleva alguna cuenta a su límite (o lo pasa), aviso
// grande de parar. Solo para trades de hoy.
export function avisarTrasGuardar(trade) {
  if (!cortacircuitosActivo() || !trade || trade.result !== 'SL' || trade.date !== hoy()) return false;
  const lim = limiteSL();
  const cuentas = (trade.accounts || []).map(a => ({ id: a.accountId, n: slDeCuenta(a.accountId) }))
    .filter(x => x.n >= lim);
  if (!cuentas.length) return false;
  const pasada = cuentas.some(x => x.n > lim);
  const activas = (state.cuentas || []).filter(c => c.status === 'activa' && state.cuentaConSeguimiento(c));
  const todas = activas.length > 0 && activas.every(c => slDeCuenta(c.id) >= lim);
  const lista = cuentas.map(x => `<li><b>${esc(nombreCuenta(x.id))}</b> · ${x.n} SL hoy (límite ${lim})</li>`).join('');
  openModal({
    title: pasada ? 'Has pasado tu límite de hoy' : 'Para por hoy',
    body: `<div class="cc-stop">
      <div class="cc-stop-ic" aria-hidden="true">✋</div>
      <p class="cc-stop-lead">${cuentas.length === 1 ? 'Esta cuenta ha llegado' : 'Estas cuentas han llegado'} a tu límite de ${sl(lim)} del día:</p>
      <ul class="cc-stop-lista">${lista}</ul>
      <p>${todas ? '<b>Todas tus cuentas están paradas.</b> Hoy no se opera más.' : `Tu regla dice que hoy no se opera más en ${cuentas.length === 1 ? 'ella' : 'ellas'}.`}
      Cierra la plataforma, apunta el diario del trader y vuelve mañana con la cabeza fría. Las cuentas se queman fuera del plan, no por un SL.</p>
    </div>`,
    actions: [{ label: 'Entendido, paro', variant: 'primary', onClick: close => close() }],
  });
  return true;
}

// Limpia la pausa de 5 minutos de la versión anterior, si quedó guardada.
export function initBreaker() {
  try { localStorage.removeItem(CLAVE_ANTIGUA); } catch (e) { /* sin almacenamiento */ }
}
