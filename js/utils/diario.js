// Diario del día: los dos protocolos de Tradinverso alrededor de la sesión.
//   · Diario inverso (antes de empezar): hoy no haré · hoy mejoraré · si pasa
//     X haré Y · mi regla de hoy · cómo llego
//   · Trades: salen solos
//   · Diario del trader (al cerrar): ¿he respetado mi plan? · qué he hecho
//     bien · dónde me he saboteado · qué quiero mejorar mañana
// Se guarda dentro de la reflexión diaria de siempre
// (users/{uid}/reflections/daily-YYYY-MM-DD), añadiéndole dos bloques:
//   plan   → { noHare, mejorare, siPasa, hare, regla, estado, at, antes }
//   review → { plan, bien, sabotaje, mejorar, leccion, at }
// y, si ese día se decidió no operar, sinOperar → { motivo, at }.
// `content` sigue siendo el texto libre de las reflexiones antiguas (ahora
// "Notas"). Las reflexiones semanales y mensuales no cambian.
//
// `plan.antes` = el diario inverso se escribió antes del primer trade de ese
// día. Es lo que hace fiable el "he respetado mi plan": hasta ahora plan y
// sensación se apuntaban con el trade ya cerrado.

import { state } from '../state.js';
import { auth } from '../auth.js';
import { todayLocal } from './timezone.js';

export const ESTADOS = [
  { id: 'centrado', label: 'Descansado y centrado', tono: 'ok' },
  { id: 'normal', label: 'Normal', tono: '' },
  { id: 'cansado', label: 'Cansado', tono: 'warn' },
  { id: 'presion', label: 'Con prisa o presión', tono: 'warn' },
  { id: 'alterado', label: 'Alterado', tono: 'bad' },
];
// Día sin operar: una decisión, no un hueco. Se apunta en el paso "Trades".
export const SIN_OPERAR = [
  ['sin-setup', 'No hubo setup'], ['noticias', 'Noticias'], ['no-estaba-bien', 'No estaba bien'],
  ['limite', 'Ya había llegado a mi límite'], ['libre', 'Día libre'],
];
export const CUMPLIDO = [['si', 'Sí'], ['parcial', 'En parte'], ['no', 'No']];
export const etiqueta = (lista, id) => { const x = lista.find(e => (e.id || e[0]) === id); return x ? (x.label || x[1]) : ''; };

export const hoy = () => todayLocal(auth.timezone());
const p2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const fecha = s => new Date(s + 'T12:00:00');
const esLaborable = s => { const d = fecha(s).getDay(); return d >= 1 && d <= 5; };
function laborableAnterior(s) {
  const d = fecha(s);
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return iso(d);
}

const ref = dia => state.reflections.find(r => r.type === 'daily' && r.period === dia) || null;

// Lo que hay apuntado un día: { plan, review, content } (nulos si no hay nada).
export function diaDe(dia) {
  const r = ref(dia);
  return { plan: (r && r.plan) || null, review: (r && r.review) || null, sinOperar: (r && r.sinOperar) || null, content: (r && r.content) || '' };
}
export function estadoDia(dia) {
  const d = diaDe(dia);
  return { plan: !!d.plan, review: !!d.review, sinOperar: !!d.sinOperar, notas: !!d.content.trim(), algo: !!(d.plan || d.review || d.sinOperar || d.content.trim()) };
}
export const tradesDe = dia => state.trades.filter(t => t.date === dia).sort((a, b) => (a.open_str || '').localeCompare(b.open_str || ''));

export function guardarPlan(dia, plan) {
  const previo = diaDe(dia).plan;
  const sinTrades = !state.trades.some(t => t.date === dia);
  state.saveReflection('daily', dia, diaDe(dia).content, {
    plan: {
      ...plan,
      at: (previo && previo.at) || Date.now(),
      // Se decide la primera vez que se guarda y ya no cambia al editarlo.
      antes: previo ? !!previo.antes : (sinTrades && dia >= hoy()),
    },
  });
}

export function guardarRevision(dia, review, notas) {
  state.saveReflection('daily', dia, notas, { review: { ...review, at: Date.now() } });
}

// Marca (o desmarca, con motivo null) el día como "sin operar".
export function marcarSinOperar(dia, motivo) {
  state.saveReflection('daily', dia, diaDe(dia).content, { sinOperar: motivo ? { motivo, at: Date.now() } : null });
}

export function borrarDia(dia) {
  state.deleteReflection(`daily-${dia}`);
}

// Racha de días laborables seguidos con diario (plan o revisión). El día de
// hoy cuenta si ya tiene algo; si aún no, no rompe la racha.
export function racha() {
  const h = hoy();
  const con = d => { const e = estadoDia(d); return e.plan || e.review; };
  let d = esLaborable(h) ? h : laborableAnterior(h);
  if (d === h && !con(d)) d = laborableAnterior(d);
  let dias = 0;
  for (let i = 0; i < 400 && con(d); i++) { dias++; d = laborableAnterior(d); }
  // Últimos 14 días laborables, del más antiguo al más reciente
  const ultimos = [];
  let x = esLaborable(h) ? h : laborableAnterior(h);
  for (let i = 0; i < 14; i++) { ultimos.unshift({ dia: x, ...estadoDia(x), hoy: x === h }); x = laborableAnterior(x); }
  return { dias, ultimos };
}

// Lo último que el trader dijo que quería mejorar "mañana", antes de `dia`:
// se le recuerda en el diario inverso del día siguiente.
export function mejorarPendiente(dia) {
  const r = state.reflections
    .filter(x => x.type === 'daily' && x.period < dia && x.review && String(x.review.mejorar || '').trim())
    .sort((a, b) => b.period.localeCompare(a.period))[0];
  return r ? { dia: r.period, texto: r.review.mejorar.trim() } : null;
}

// Lecciones escritas al cerrar un día, de la más reciente a la más antigua.
export function lecciones() {
  return state.reflections
    .filter(r => r.type === 'daily' && r.review && String(r.review.leccion || '').trim())
    .map(r => ({ dia: r.period, texto: r.review.leccion.trim() }))
    .sort((a, b) => b.dia.localeCompare(a.dia));
}

// "Una lección tuya": vuelve una de las tuyas (no la de hoy) en días alternos;
// los demás días sale la regla del día. Devuelve null si hoy toca regla.
export function leccionDeHoy() {
  const h = hoy();
  const l = lecciones().filter(x => x.dia !== h);
  if (!l.length) return null;
  const n = Math.floor(fecha(h).getTime() / 86400000);
  if (n % 2 !== 0) return null;
  return l[Math.floor(n / 2) % l.length];
}
