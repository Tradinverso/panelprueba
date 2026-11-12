// Puntuación de disciplina, de 0 a 100. Un solo número para saber cómo se
// está ejecutando, no cuánto se gana.
//
// Los pesos salen del estudio con los datos reales de los alumnos (nov 2026):
// lo que más separa a quien gana de quien pierde es operar dentro del plan y
// con buena sensación, así que eso pesa más de la mitad. El resultado del
// sistema pesa poco a propósito: un mes malo siguiendo el plan sigue siendo un
// mes disciplinado.
//
//   Plan       40  % de trades dentro del plan
//   Sensación  20  % de trades con sensación positiva (seguro o en calma)
//   Riesgo     15  constancia del riesgo por trade
//   Diario     15  días operados con diario inverso y diario del trader
//   Resultado  10  P&L medio por trade
//
// Ventana: los últimos 90 días; si hay pocos trades, los últimos 30 trades.
// Con menos de 10 trades no se calcula.
//
// Una parte sin datos (trades antiguos o importados sin plan ni sensación) no
// cuenta como cero: se deja fuera y el resto se reescala a 100. El diario sí
// cuenta como cero si no se hace: es una conducta, no un dato que falte.

import { POSITIVAS, NEUTRALES, NEGATIVAS } from './sensaciones.js';
import { R_MAXIMO } from './strategy-config.js';

export const PESOS = { plan: 40, sensacion: 20, riesgo: 15, diario: 15, resultado: 10 };
const MIN_TRADES = 10;
const DIAS = 90;
const DIAS_DIARIO = 20;      // últimos días operados que cuentan para el diario
const MIN_MARCADOS = 5;      // trades con plan o sensación apuntados para juzgar esa parte

const p2 = n => String(n).padStart(2, '0');
const clamp01 = x => Math.max(0, Math.min(1, x));
function haceDias(hoy, n) {
  const d = new Date(hoy + 'T12:00:00'); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function nivelDisciplina(score) {
  if (score == null) return { id: 'sin', label: 'Sin datos' };
  if (score >= 85) return { id: 'alta', label: 'Excelente' };
  if (score >= 70) return { id: 'buena', label: 'Buena' };
  if (score >= 50) return { id: 'media', label: 'Mejorable' };
  return { id: 'baja', label: 'Baja' };
}

// `trades` y `reflections` tal cual están guardados (sirve con los del propio
// alumno ya cargados y con los que lee el admin). `hoy` = 'AAAA-MM-DD'.
export function puntuacionDisciplina(trades, reflections, hoy) {
  const limpios = (trades || []).filter(t => t && t.date && Math.abs(t.pnl_pct || 0) <= R_MAXIMO)
    .sort((a, b) => (a.date + (a.open_str || '')).localeCompare(b.date + (b.open_str || '')));
  let ts = limpios.filter(t => t.date >= haceDias(hoy, DIAS) && t.date <= hoy);
  let ventana = `últimos ${DIAS} días`;
  if (ts.length < MIN_TRADES) { ts = limpios.slice(-30); ventana = `últimos ${ts.length} trades`; }
  if (ts.length < MIN_TRADES) {
    return { score: null, nivel: nivelDisciplina(null), partes: [], ventana: '', n: ts.length, falta: MIN_TRADES - ts.length };
  }

  const partes = [];
  // ratio = null → sin datos para juzgar esa parte
  const parte = (id, label, ratio, detalle, consejo) => {
    const max = PESOS[id];
    if (ratio == null) { partes.push({ id, label, max, pts: null, ratio: null, sinDatos: true, detalle, consejo }); return; }
    partes.push({ id, label, max, pts: Math.round(max * clamp01(ratio)), ratio: clamp01(ratio), detalle, consejo });
  };

  // Plan: del 40 % (0 puntos) al 95 % (todos)
  const marcados = ts.filter(t => t.plan_followed === true || t.plan_followed === false);
  const dentro = marcados.filter(t => t.plan_followed === true).length;
  const pctPlan = marcados.length ? dentro / marcados.length * 100 : 0;
  parte('plan', 'Dentro del plan', marcados.length >= MIN_MARCADOS ? (pctPlan - 40) / 55 : null,
    marcados.length >= MIN_MARCADOS ? `${pctPlan.toFixed(0)}% de los trades dentro del plan (${dentro} de ${marcados.length})` : 'Faltan trades con el plan apuntado',
    'Cada trade fuera del plan resta: es lo que más pesa.');

  // Sensación: del 40 % al 90 % con sensación positiva
  const conSens = ts.filter(t => [...POSITIVAS, ...NEUTRALES, ...NEGATIVAS].includes(t.sensacion));
  const positivas = conSens.filter(t => POSITIVAS.includes(t.sensacion)).length;
  const pctPos = conSens.length ? positivas / conSens.length * 100 : 0;
  parte('sensacion', 'Sensación al entrar', conSens.length >= MIN_MARCADOS ? (pctPos - 40) / 50 : null,
    conSens.length >= MIN_MARCADOS ? `${pctPos.toFixed(0)}% de los trades con sensación positiva (${positivas} de ${conSens.length})` : 'Faltan trades con la sensación apuntada',
    'Si dudas o vas acelerado, no entres.');

  // Riesgo: coeficiente de variación del riesgo por trade (0,05 → todos; 0,50 → 0)
  const riesgos = ts.map(t => (typeof t.risk_real_pct === 'number' && isFinite(t.risk_real_pct) && t.risk_real_pct > 0) ? t.risk_real_pct : 1);
  const media = riesgos.reduce((a, b) => a + b, 0) / riesgos.length;
  const cv = media ? Math.sqrt(riesgos.reduce((a, r) => a + (r - media) ** 2, 0) / riesgos.length) / media : 0;
  parte('riesgo', 'Riesgo constante', 1 - (cv - 0.05) / 0.45,
    cv < 0.05 ? `Mismo riesgo en todos los trades (${media.toFixed(2)}% de media)` : `El riesgo varía un ${(cv * 100).toFixed(0)}% alrededor de ${media.toFixed(2)}%`,
    'Mismo riesgo en todos los trades, ganes o pierdas.');

  // Diario: últimos días operados con diario inverso (mitad) y diario del trader (mitad)
  const dias = [...new Set(ts.map(t => t.date))].sort().slice(-DIAS_DIARIO);
  const porDia = new Map((reflections || []).filter(r => r && r.type === 'daily').map(r => [r.period, r]));
  const conInv = dias.filter(d => porDia.get(d) && porDia.get(d).plan).length;
  // Una reflexión diaria de las de antes (solo texto) vale como diario del trader.
  const conTra = dias.filter(d => { const r = porDia.get(d); return r && (r.review || String(r.content || '').trim()); }).length;
  parte('diario', 'Diario del día', dias.length ? (conInv + conTra) / (2 * dias.length) : 0,
    `Diario inverso en ${conInv} y diario del trader en ${conTra} de los últimos ${dias.length} días operados`,
    'Dos minutos antes de abrir la plataforma y cuatro preguntas al cerrar.');

  // Resultado: P&L medio por trade (0 → 0 puntos; +0,30 % → todos)
  const pnl = ts.reduce((a, t) => a + (t.result === 'BE' ? 0 : (t.pnl_pct || 0)), 0);
  const porTrade = pnl / ts.length;
  parte('resultado', 'Resultado del sistema', porTrade / 0.3,
    `${porTrade >= 0 ? '+' : ''}${porTrade.toFixed(2)}% por trade en ${ts.length} trades`,
    'Pesa poco a propósito: llega solo cuando lo demás está bien.');

  const validas = partes.filter(x => !x.sinDatos);
  const maximo = validas.reduce((a, x) => a + x.max, 0);
  // Sin plan ni sensación no hay disciplina que medir.
  if (maximo < 60) return { score: null, nivel: nivelDisciplina(null), partes, ventana, n: ts.length, faltaMarcar: true };
  const score = Math.round(validas.reduce((a, x) => a + x.pts, 0) / maximo * 100);
  return { score, nivel: nivelDisciplina(score), partes, ventana, n: ts.length, reescalada: maximo < 100 };
}
