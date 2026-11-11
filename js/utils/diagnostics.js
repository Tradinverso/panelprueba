// Diagnóstico técnico + emocional.
//
// Filosofía:
//   - ALERTAS = situación que pide acción (activa, reciente, o patrón histórico negativo)
//     · DANGER (rojo): crítica → para o cambia AHORA
//     · WARNING (naranja): vigilar → no es urgente pero está mal
//   - INSIGHTS = información positiva o neutra (mejores patrones, métricas en verde)
//
// Una alerta vieja sin recurrencia reciente NO se muestra (stale, no accionable).
//
// REVISIÓN DE NOVIEMBRE DE 2026 — con los datos reales de los alumnos (5.220
// trades, 34 alumnos con 30 o más) se midió qué alertas avisaban de algo real:
//   · Las rachas de SL NO predicen el trade siguiente (tras 3+ SL se acierta lo
//     mismo). Con un 42 % de acierto, 3 SL seguidos salen por azar 1 de cada 5
//     veces: la alerta "grave" estaba encendida la mitad de los días.
//   · "Peor par / franja / día / sesión" con pocos trades suele ser azar (la
//     franja y la sesión sí conservan una parte). Se mantienen como
//     diagnósticos, pero en naranja o verde —nunca en rojo ni en la insignia—,
//     comparando dentro de la misma estrategia y diciendo la muestra.
//   · Lo que SÍ predice es operar fuera del plan (20 % de acierto frente a
//     47 %) y con duda o sensación negativa (Dudoso 28 %, FOMO 16 %). Eso va
//     delante y en P&L, que es como duele.
//   · Nuevos: cierres antes del objetivo, tamaño del riesgo y datos mal
//     apuntados.

import {
  winrate, sortChrono, tradeRealPnl, wrByDay, profitFactor,
  planStats, currentInPlanStreak, currentOutOfPlanStreak,
} from './calculations.js';
import {
  withSensacion, sensacionStats,
  NEGATIVAS, POSITIVAS,
} from './sensaciones.js';
import { STRATEGIES, TP_RANGE, R_MAXIMO, tpRangeLabel } from './strategy-config.js';
import { fmtPct } from './number-format-es.js';
import { tzHourDiff, todayLocal } from './timezone.js';
import { auth } from '../auth.js';

// ═══════════════════════════════════════════════════════════════
// UMBRALES — todas las medidas del diagnóstico en un solo sitio.
// Para ajustar cualquier regla, cambia el número aquí; el resto del
// fichero solo referencia esta tabla.
// Los mínimos de muestra evitan ruido: un WR sobre 3-4 trades es azar
// (con <30 trades, un 55% real puede aparentar entre 35% y 75%).
// ═══════════════════════════════════════════════════════════════
const UMBRALES = {
  // HOY — protección de la sesión
  maxTradesDia: 5,          // trades/día: al llegar aquí, parar (regla de la academia)
  avisoTradesDia: 4,        //   aviso previo
  slDia: 3,                 // SL en el día → parar (regla de las 3 pérdidas)
  avisoSlDia: 2,            //   aviso previo
  ddDiario: -3,             // % de P&L REAL acumulado en el día → parar
  ventanaVenganzaMin: 15,   // reentrar ≤X min tras cerrar un SL = posible venganza

  // Rachas activas (consecutivos desde el último trade)
  // Rachas de SL: aviso tranquilo desde `aviso`; GRAVE solo cuando la racha es
  // improbable para el acierto del propio alumno (probabilidad < `rara`), con
  // el umbral acotado entre `min` y `max` SL, o cuando `contaminados` de esos
  // SL fueron fuera del plan / con sensación negativa.
  rachaSl: { aviso: 3, rara: 0.05, min: 5, max: 9, porDefecto: 6, minMuestra: 30, contaminados: 2 },
  rachaEstrategiaDias: 14,  // una estrategia sin operar más de X días no tiene racha "activa"
  rachaFueraPlan: { aviso: 2, alerta: 3 },

  // Mínimos de muestra (anti-ruido)
  minCobertura: 10,         // trades en la ventana antes de evaluar cobertura emocional
  ventanaCobertura: 50,     // la cobertura se mide sobre los últimos N trades: los
                            // antiguos (de antes de existir el campo sensación) no
                            // deben penalizar el porcentaje para siempre

  // Métricas de calidad
  tendencia: { dias: 28, minReciente: 5, minTotal: 30, pp: 8 },
  cobertura: { baja: 60, alta: 90 },
  plan: { min: 10, bien: 80 },
  diasRojos: 3,             // días operados seguidos en rojo → aviso
  // Coste en P&L de un grupo de trades (fuera del plan, con duda…)
  coste: { minPlan: 5, minSens: 8, dias: 90, difSens: 5 },
  // Cierres antes del objetivo (TP por debajo del mínimo de la estrategia)
  cierres: { minTp: 8, tolerancia: 0.15, mal: 30, bien: 10, difCuenta: 15 },
  // Tamaño del riesgo: P&L real frente al que saldría con riesgo fijo
  riesgo: { min: 30, valores: 3, fuga: -2, factor: 1.05 },
  // Patrones (par, franja, día, sesión, dirección, estrategia): diagnósticos en
  // naranja/verde. `amplia` = trades a partir de los cuales la muestra ya no
  // se avisa como "puede ser casualidad".
  patrones: {
    amplia: 30,
    par: { min: 10, peor: 10, mejor: 8 },         // pp frente al acierto de su estrategia
    franja: { min: 8, peor: 8, mejor: 8 },
    dia: { min: 8, dif: 8 },                      // pp frente al acierto global
    sesion: { min: 10, dif: 10, londres: [8, 12], ny: [14, 18] },   // hora de Madrid
    direccion: { min: 15, dif: 10 },
    estrategia: { min: 20 },
    sistema: { min: 20 },
    diasPositivos: { min: 8, bien: 60 },
    sensacion: { min: 8, dif: 5 },
    sinNegativas: { dias: 30, min: 10 },
  },
};

const A = (type, icon, title, body) => ({ type, icon, title, body });
const danger  = (icon, title, body) => A('danger', icon, title, body);
const warn    = (icon, title, body) => A('warning', icon, title, body);
const success = (icon, title, body) => A('success', icon, title, body);

// Marca una alerta como GRAVE: es la que enciende el badge rojo de "Diagnóstico"
// en el menú y la columna Alertas de Mis Alumnos. Solo conducta aguda (rachas
// de SL, límites del día, plan incumplido). Los patrones analíticos (peor
// par/franja/sensación, tendencia) siguen siendo rojos DENTRO del Diagnóstico,
// pero no encienden avisos fuera — minimalismo: si el badge sale, es serio.
const critico = a => ({ ...a, grave: true });

// ── Helpers temporales ─────────────────────────────────────
// "Hoy" en el huso del PERFIL (los trades se convierten a él al cargar). Con el
// huso del navegador, cerca de medianoche "hoy" no cuadraría con las fechas de
// los trades ni con el checklist (que ya usa el huso del perfil).
const todayStr = () => todayLocal(auth.timezone());
function pad(n) { return String(n).padStart(2, '0'); }

function daysBetween(yyyy_mm_dd1, yyyy_mm_dd2) {
  const a = new Date(yyyy_mm_dd1);
  const b = typeof yyyy_mm_dd2 === 'string' ? new Date(yyyy_mm_dd2) : yyyy_mm_dd2;
  return Math.round((b - a) / 86400000);
}

function recentTrades(trades, days) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const cutoffStr = `${cutoff.getFullYear()}-${pad(cutoff.getMonth() + 1)}-${pad(cutoff.getDate())}`;
  return trades.filter(t => t.date >= cutoffStr);
}

function todaysTrades(trades) {
  const t = todayStr();
  return trades.filter(x => x.date === t);
}

function lastOperatedDate(trades) {
  if (!trades.length) return null;
  const dates = [...new Set(trades.map(t => t.date))].sort();
  return dates[dates.length - 1];
}

// "HH:MM" → minutos desde medianoche (null si falta o no parsea)
function toMin(s) {
  if (!s || !/^\d{1,2}:\d{2}/.test(s)) return null;
  const [h, m] = String(s).split(':').map(Number);
  return h * 60 + m;
}

// Reentradas "en caliente" de HOY: trades abiertos ≤ventana minutos después
// de cerrar un SL del mismo día. Lo usan la alerta de venganza y el semáforo.
// La reentrada rápida por sí sola es evidencia circunstancial (puede ser un
// segundo setup legítimo) → aviso. Solo es GRAVE si el propio trade la
// confirma: sensación negativa (Venganza/FOMO/Miedo) o fuera del plan.
function casosVenganzaHoy(todays) {
  const conHoras = todays.filter(t => toMin(t.open_str) != null)
    .sort((a, b) => toMin(a.open_str) - toMin(b.open_str));
  let ultimoSlCierre = null, casos = 0, confirmados = 0, primerGap = null, primerGapConf = null;
  for (const t of conHoras) {
    const open = toMin(t.open_str);
    if (ultimoSlCierre != null) {
      const gap = open - ultimoSlCierre;
      if (gap >= 0 && gap <= UMBRALES.ventanaVenganzaMin) {
        casos++;
        if (primerGap == null) primerGap = gap;
        if (NEGATIVAS.includes(t.sensacion) || t.plan_followed === false) {
          confirmados++;
          if (primerGapConf == null) primerGapConf = gap;   // gap del caso CONFIRMADO
        }
      }
    }
    if (t.result === 'SL' && toMin(t.close_str) != null) ultimoSlCierre = toMin(t.close_str);
  }
  return { casos, confirmados, primerGap, primerGapConf };
}

// Dentro de cada lista, lo rojo arriba, luego naranja, luego verde.
// El sort es estable: a igual severidad se conserva el orden de las reglas.
const SEV_RANK = { danger: 0, warning: 1, success: 2 };
function ordenarPorSeveridad(result) {
  Object.values(result).forEach(arr => arr.sort((a, b) => (SEV_RANK[a.type] ?? 9) - (SEV_RANK[b.type] ?? 9)));
  return result;
}

// ── Helpers de medida ──────────────────────────────────────
// % P&L dentro de un rango creíble (va en R). Lo demás es un dato mal apuntado.
const limpio = t => Math.abs(t.pnl_pct || 0) <= R_MAXIMO;
const SHEETS = ['ZONAS', 'LIQUIDEZ', 'NASDAQ'];
const etiqueta = sheet => (STRATEGIES[sheet] && STRATEGIES[sheet].label) || sheet;

// Resumen de un grupo de trades: nº, decisivos (TP+SL), acierto y P&L sistema.
export function resumenR(ts) {
  let tp = 0, sl = 0, r = 0;
  for (const t of ts) {
    if (!limpio(t)) continue;
    if (t.result === 'TP') tp++; else if (t.result === 'SL') sl++;
    if (t.result !== 'BE') r += t.pnl_pct || 0;
  }
  const dec = tp + sl;
  return { n: ts.length, tp, sl, dec, wr: dec ? tp / dec * 100 : 0, r };
}

// Trades SL de la racha activa (los BE no la cortan, un TP sí), del más
// reciente al más antiguo.
function rachaSl(trades) {
  const sorted = sortChrono(trades);
  const out = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].result === 'SL') out.push(sorted[i]);
    else if (sorted[i].result === 'TP') break;
  }
  return out;
}

// A partir de cuántos SL seguidos la racha deja de ser "lo normal" para el
// acierto de ESE alumno: la probabilidad de estar en una racha de n es
// (1 − acierto)^n. Con un 42 % de acierto, 3 seguidos pasan el 19 % de las
// veces y hacen falta 6 para bajar del 5 %.
function umbralRacha(trades) {
  const u = UMBRALES.rachaSl;
  const r = resumenR(trades);
  if (r.dec < u.minMuestra) return { n: u.porDefecto, fiable: false, wr: r.wr };
  const pSl = Math.min(0.8, Math.max(0.3, r.sl / r.dec));
  const n = Math.ceil(Math.log(u.rara) / Math.log(pSl));
  return { n: Math.min(u.max, Math.max(u.min, n)), fiable: true, wr: r.wr, pSl };
}
const unaDeCada = (pSl, n) => Math.max(2, Math.round(1 / Math.pow(pSl, n)));

// Ventana reciente con muestra suficiente; si no la hay, todo el historial.
function ventana(ts, filtro, min) {
  const rec = recentTrades(ts, UMBRALES.coste.dias);
  return rec.filter(filtro).length >= min
    ? { ts: rec, nota: `Últimos ${UMBRALES.coste.dias} días.` }
    : { ts, nota: 'Todo tu historial.' };
}

// ── Punto de entrada ───────────────────────────────────────
// `ctx.cuentas` (opcional): las cuentas del alumno, para comparar la ejecución
// en cuentas fondeadas frente a las de prueba.
export function buildAlerts(trades, ctx = {}) {
  const tecAlertas = [];
  const tecInsights = [];
  const emoAlertas = [];
  const emoInsights = [];
  const planAlertas = [];
  const planInsights = [];

  if (!trades.length) return { tecAlertas, tecInsights, emoAlertas, emoInsights, planAlertas, planInsights };

  const globalWR = winrate(trades);
  const limpios = trades.filter(limpio);
  const today = todayStr();
  const lastOp = lastOperatedDate(trades);
  const daysSinceLast = lastOp ? daysBetween(lastOp, today) : Infinity;
  const isActiveTrader = daysSinceLast <= 7;

  // ═══════════════════════════════════════════════════════════
  // ALERTAS TÉCNICAS
  // ═══════════════════════════════════════════════════════════

  // ── Racha de SL activa ──
  // Solo para traders activos: si el último trade es de hace semanas, una
  // racha "activa" antigua no es accionable — sería una alerta fantasma.
  // Una racha, por sí sola, no avisa de nada (ver cabecera): aviso tranquilo.
  // GRAVE solo si es improbable para el acierto del alumno, o si parte de esos
  // SL fueron fuera del plan o con sensación negativa (ahí no es mala suerte).
  const racha = isActiveTrader ? rachaSl(trades) : [];
  const slStreak = racha.length;
  const uRacha = umbralRacha(trades);
  const contaminados = racha.filter(t => t.plan_followed === false || NEGATIVAS.includes(t.sensacion)).length;
  if (slStreak >= uRacha.n) {
    tecAlertas.push(critico(danger('🛑',
      `Racha activa de ${slStreak} SL — Protocolo Reseteo`,
      uRacha.fiable
        ? `Con tu acierto (${uRacha.wr.toFixed(0)}%), una racha así es poco habitual. Para 24h, revisa el journaling y valida el plan antes de volver.`
        : `Para 24h obligatorio. Revisa journaling y valida plan antes de volver.`)));
  } else if (slStreak >= UMBRALES.rachaSl.aviso && contaminados >= UMBRALES.rachaSl.contaminados) {
    tecAlertas.push(critico(danger('!',
      `Racha de ${slStreak} SL, ${contaminados} fuera del plan o con sensación negativa`,
      `Esto no es mala suerte, es ejecución. Para y vuelve al plan antes del siguiente trade.`)));
  } else if (slStreak >= UMBRALES.rachaSl.aviso) {
    tecAlertas.push(warn('⏳',
      `${slStreak} SL seguidos — dentro de lo normal`,
      uRacha.fiable
        ? `Con tu acierto (${uRacha.wr.toFixed(0)}%) pasa más o menos 1 de cada ${unaDeCada(uRacha.pSl, slStreak)} veces. No cambies nada: mismo plan, mismo riesgo.`
        : `Una racha así entra dentro de lo esperable. No cambies nada: mismo plan, mismo riesgo.`));
  }

  // ── Racha de SL por estrategia ──
  // Solo si la estrategia se ha operado hace poco (si no, la racha es de otra
  // época) y si no es la misma racha global de arriba.
  if (isActiveTrader) {
    for (const sheet of SHEETS) {
      const stTrades = trades.filter(t => t.sheet === sheet);
      if (!stTrades.length) continue;
      const ultima = lastOperatedDate(stTrades);
      if (daysBetween(ultima, today) > UMBRALES.rachaEstrategiaDias) continue;
      const cur = rachaSl(stTrades).length;
      if (cur <= slStreak) continue;
      const u = umbralRacha(stTrades);
      if (cur >= u.n) {
        tecAlertas.push(critico(danger('🛑',
          `${etiqueta(sheet)}: ${cur} SL seguidos — Protocolo Reseteo`,
          `Poco habitual para tu acierto en esta estrategia${u.fiable ? ` (${u.wr.toFixed(0)}%)` : ''}. Pausa 24h y revisa los setups recientes.`)));
      } else if (cur >= u.n - 1 && cur >= UMBRALES.rachaSl.aviso) {
        tecAlertas.push(warn('⏳',
          `${etiqueta(sheet)}: ${cur} SL seguidos`,
          `Todavía dentro de lo normal para esta estrategia. Revisa que los setups cumplen el plan.`));
      }
    }
  }

  // ── HOY: sobreoperar ──
  const todays = todaysTrades(trades);
  if (todays.length >= UMBRALES.maxTradesDia) {
    tecAlertas.push(critico(danger('🛑',
      `HOY llevas ${todays.length} trades — para`,
      `Tu regla: máx ${UMBRALES.maxTradesDia} trades/día. Has llegado al límite.`)));
  } else if (todays.length === UMBRALES.avisoTradesDia) {
    tecAlertas.push(warn('⏳',
      `HOY llevas ${UMBRALES.avisoTradesDia} trades — uno más y estás al límite`,
      `Solo opera el siguiente si es un setup A+, sin compromiso.`));
  }

  // ── HOY: SL acumulados (regla de las 3 pérdidas: al 3º se para el día) ──
  const todaySL = todays.filter(t => t.result === 'SL').length;
  if (todaySL >= UMBRALES.slDia) {
    tecAlertas.push(critico(danger('🛑',
      `HOY ya ${todaySL} SL — para`,
      `${UMBRALES.slDia} SL en el día es el límite. Cierra plataforma y revisa journaling.`)));
  } else if (todaySL === UMBRALES.avisoSlDia) {
    tecAlertas.push(warn('⏳',
      `HOY llevas ${UMBRALES.avisoSlDia} SL — uno más y toca parar`,
      `El siguiente solo si es un setup A+ con la cabeza fría.`));
  }

  // ── HOY: sensación negativa de alto riesgo (FOMO / Venganza / Miedo) ──
  const badEmotions = new Set(NEGATIVAS);
  const todayBadEmotion = todays.filter(t => badEmotions.has(t.sensacion));
  if (todayBadEmotion.length) {
    const sensList = [...new Set(todayBadEmotion.map(t => t.sensacion))].join(' / ');
    tecAlertas.push(critico(danger('🚨',
      `HOY operando con "${sensList}" — para`,
      `Detectada sensación negativa de alto riesgo. Cierra plataforma antes de seguir; no es momento de operar.`)));
  }

  // ── HOY: límite de drawdown diario ──
  // Sobre P&L REAL (pnl_pct × riesgo real): si arriesgas 0.5% por trade, el
  // -3% de verdad son 6 SL, no 3. Con riesgo 1 en todo, igual que antes.
  const todayPnl = todays.reduce((s, t) => s + tradeRealPnl(t), 0);
  if (todayPnl <= UMBRALES.ddDiario) {
    tecAlertas.push(critico(danger('📉',
      `HOY ${todayPnl.toFixed(1)}% acumulado — para`,
      `Has alcanzado el límite diario de drawdown (${UMBRALES.ddDiario}%). Cierra plataforma y revisa journaling.`)));
  }

  // ── HOY: reentrada en caliente tras un SL ──
  // Grave SOLO si el trade la confirma (sensación negativa o fuera del plan);
  // la reentrada rápida a secas puede ser un segundo setup legítimo → aviso.
  const venganza = casosVenganzaHoy(todays);
  if (venganza.confirmados) {
    tecAlertas.push(critico(danger('🔥',
      venganza.confirmados > 1
        ? `HOY ${venganza.confirmados} trades de venganza — para`
        : `HOY trade de venganza — para`,
      `Reentraste a los ${venganza.primerGapConf} min de un SL y el trade va con sensación negativa o fuera del plan. Cierra plataforma.`)));
  } else if (venganza.casos) {
    tecAlertas.push(warn('🔥',
      `HOY reentrada rápida tras un SL`,
      `Reentraste a los ${venganza.primerGap} min de cerrar un SL. Si era un setup nuevo válido, bien — pero vigila la impulsividad.`));
  }

  // ═══════════════════════════════════════════════════════════
  // ALERTAS E INSIGHTS DEL TRADING PLAN (categoría separada)
  // ═══════════════════════════════════════════════════════════

  // ── HOY: trades fuera del plan ──
  const todayOut = todays.filter(t => t.plan_followed === false).length;
  if (todayOut >= 2) {
    planAlertas.push(critico(danger('📋',
      `HOY ${todayOut} trades fuera del plan`,
      `Revisa la disciplina de ejecución. Cierra plataforma si vuelve a pasar.`)));
  } else if (todayOut === 1) {
    planAlertas.push(warn('📋',
      `HOY 1 trade fuera del plan`,
      `Atento — un trade más sin plan activaría la alerta crítica.`));
  }

  // ── Últimos 7 días: más de 3 trades fuera del plan ──
  const last7 = recentTrades(trades, 7);
  const last7Out = last7.filter(t => t.plan_followed === false).length;
  if (last7Out > 3) {
    planAlertas.push(critico(danger('📋',
      `Últimos 7 días: ${last7Out} trades fuera del plan`,
      `Patrón problemático — revisa tu disciplina antes de seguir operando.`)));
  }

  // ── Racha activa fuera del plan (desde 2: un solo trade suelto es ruido) ──
  const outStreak = currentOutOfPlanStreak(trades);
  if (outStreak >= UMBRALES.rachaFueraPlan.alerta) {
    planAlertas.push(critico(danger('🚫',
      `Racha activa: ${outStreak} trades seguidos fuera del plan`,
      `Para. Vuelve al journaling y revisa qué está pasando antes del siguiente trade.`)));
  } else if (outStreak === UMBRALES.rachaFueraPlan.aviso) {
    planAlertas.push(warn('🚫',
      `Racha activa: 2 trades seguidos fuera del plan`,
      `Un trade más y se activa la alerta crítica.`));
  }

  // ── Racha activa DENTRO del plan (siempre visible si ≥1; verde si ≥5) ──
  const inStreak = currentInPlanStreak(trades);
  if (inStreak >= 5) {
    planInsights.push(success('✅',
      `Racha activa: ${inStreak} trades seguidos dentro del plan`,
      `Disciplina excelente — mantén el ritmo.`));
  } else if (inStreak >= 1) {
    planInsights.push(success('🟢',
      `Racha activa: ${inStreak} trade${inStreak > 1 ? 's' : ''} dentro del plan`,
      inStreak >= 3
        ? `Vas por buen camino — apunta a los 5 seguidos.`
        : `Sigue ejecutando con disciplina.`));
  }

  // ── Lo que cuesta salirse del plan, en P&L ──
  // Es la medida con más señal de todo el diagnóstico: fuera del plan se
  // acierta menos de la mitad. Se enseña en P&L, no en "% de trades".
  const ps = planStats(trades);
  const marcados = limpios.filter(t => t.plan_followed === true || t.plan_followed === false);
  const vPlan = ventana(marcados, t => t.plan_followed === false, UMBRALES.coste.minPlan);
  const fuera = resumenR(vPlan.ts.filter(t => t.plan_followed === false));
  const dentro = resumenR(vPlan.ts.filter(t => t.plan_followed === true));
  if (fuera.dec >= UMBRALES.coste.minPlan && dentro.dec >= UMBRALES.coste.minPlan && fuera.wr < dentro.wr) {
    planAlertas.push((fuera.r < 0 ? danger : warn)('📋',
      // En pérdidas, el titular es lo que cuesta; si aún suma, que se acierta menos.
      fuera.r < 0
        ? `Fuera del plan: ${fmtPct(fuera.r, 1)} en ${fuera.n} trades`
        : `Fuera del plan aciertas menos: ${fuera.wr.toFixed(0)}% en ${fuera.n} trades`,
      `${fuera.wr.toFixed(0)}% de acierto fuera del plan (${fmtPct(fuera.r, 1)}) frente a ${dentro.wr.toFixed(0)}% dentro (${fmtPct(dentro.r, 1)} en ${dentro.n} trades). ${vPlan.nota}`));
  }
  if (ps.total >= UMBRALES.plan.min && ps.pctInPlan >= UMBRALES.plan.bien) {
    planInsights.push(success('📋',
      `${ps.pctInPlan.toFixed(0)}% de trades dentro del plan`,
      `${ps.inPlan} de ${ps.total} respetaron tu trading plan. Sigue así.`));
  }

  // ── Racha de DÍAS operados negativos seguidos (activa) ──
  const dayPnl = {};
  for (const t of trades) {
    if (t.result !== 'BE') dayPnl[t.date] = (dayPnl[t.date] || 0) + (t.pnl_pct || 0);
  }
  const operatedDays = Object.keys(dayPnl).sort();
  let currentNegDayStreak = 0;
  for (let i = operatedDays.length - 1; i >= 0; i--) {
    if (dayPnl[operatedDays[i]] < 0) currentNegDayStreak++;
    else break;
  }
  // Aviso, no alarma: como las rachas de SL, no predice la sesión siguiente.
  if (currentNegDayStreak >= UMBRALES.diasRojos && isActiveTrader) {
    tecAlertas.push(warn('⏳',
      `${currentNegDayStreak} días operados seguidos en rojo`,
      `Último día: ${operatedDays[operatedDays.length - 1]}. Antes de la siguiente sesión, repasa si esos días seguiste el plan.`));
  }

  // ── Sobreoperar reciente (días al límite en últimos 14, sin contar hoy) ──
  const recent14 = recentTrades(trades, 14);
  const dayCount14 = {};
  for (const t of recent14) dayCount14[t.date] = (dayCount14[t.date] || 0) + 1;
  const overDays14 = Object.entries(dayCount14).filter(([d, n]) => n >= UMBRALES.maxTradesDia && d !== today);
  if (overDays14.length) {
    const worst = overDays14.sort((a, b) => b[1] - a[1])[0];
    tecAlertas.push(warn('⏳',
      `Sobreoperar reciente: ${overDays14.length} día${overDays14.length > 1 ? 's' : ''} con ${UMBRALES.maxTradesDia}+ trades (últimos 14)`,
      `Peor: ${worst[0]} con ${worst[1]} trades. Tu regla: máx ${UMBRALES.maxTradesDia}/día.`));
  }

  // ── Sobreoperar por sesión (3+ misma estrategia mismo día) ──
  const dayStratCount14 = {};
  for (const t of recent14) {
    const k = `${t.date}|${t.sheet}`;
    dayStratCount14[k] = (dayStratCount14[k] || 0) + 1;
  }
  const overSess14 = Object.entries(dayStratCount14).filter(([, n]) => n >= 3);
  if (overSess14.length >= 2) {
    tecAlertas.push(warn('⏳',
      `Sobreoperar por sesión: ${overSess14.length} sesiones con 3+ trades (últimos 14 días)`,
      `Recomendado máx 2/sesión.`));
  }

  // ── Tendencia 4 semanas vs histórico ──
  const last28 = recentTrades(trades, UMBRALES.tendencia.dias);
  if (last28.length >= UMBRALES.tendencia.minReciente && trades.length >= UMBRALES.tendencia.minTotal) {
    const recentWR = winrate(last28);
    const diff = recentWR - globalWR;
    if (diff <= -UMBRALES.tendencia.pp) {
      // Aviso, no rojo: una bajada de 4 semanas no anticipa cómo van los días siguientes.
      tecAlertas.push(warn('📉',
        `Tendencia 4 semanas en bajada (${diff.toFixed(0)}pp)`,
        `WR reciente ${recentWR.toFixed(0)}% vs ${globalWR.toFixed(0)}% histórico. Algo está cambiando.`));
    } else if (diff >= UMBRALES.tendencia.pp) {
      tecInsights.push(success('📈',
        `Tendencia 4 semanas mejorando (+${diff.toFixed(0)}pp)`,
        `WR reciente ${recentWR.toFixed(0)}% vs ${globalWR.toFixed(0)}% histórico. Vas en buena dirección.`));
    }
  }

  // ── Datos mal apuntados ──
  // El % P&L va en R. Un valor enorme (pips o dólares) descuadra todas las
  // medias, así que esos trades no entran en ningún cálculo de P&L de aquí.
  const raros = trades.filter(t => !limpio(t));
  if (raros.length) {
    tecAlertas.push(warn('✎',
      `${raros.length} trade${raros.length > 1 ? 's' : ''} con % P&L fuera de rango`,
      `El % P&L va en R (2 = TP de 2R, −1 = SL) y hay valores como ${raros[0].pnl_pct}. Corrígelos en Calendario: descuadran tus estadísticas.`));
  }

  // ── Cierres antes del objetivo (TP por debajo del mínimo de la estrategia) ──
  const esTpCorto = t => t.result === 'TP' && TP_RANGE[t.sheet] && t.pnl_pct < TP_RANGE[t.sheet][0] - UMBRALES.cierres.tolerancia;
  for (const sheet of SHEETS) {
    const tps = limpios.filter(t => t.sheet === sheet && t.result === 'TP');
    const v = ventana(tps, () => true, UMBRALES.cierres.minTp);
    if (v.ts.length < UMBRALES.cierres.minTp) continue;
    const cortos = v.ts.filter(esTpCorto);
    const pctCortos = cortos.length / v.ts.length * 100;
    if (pctCortos > UMBRALES.cierres.mal) {
      const falta = cortos.reduce((a, t) => a + (TP_RANGE[sheet][0] - t.pnl_pct), 0);
      tecAlertas.push(warn('✂',
        `${etiqueta(sheet)}: cierras antes del objetivo el ${pctCortos.toFixed(0)}% de tus TP`,
        `${cortos.length} de ${v.ts.length} TP por debajo de ${tpRangeLabel(sheet)}. Hasta el objetivo faltaban ${falta.toFixed(1)}R en total. ${v.nota}`));
    } else if (pctCortos <= UMBRALES.cierres.bien) {
      tecInsights.push(success('✓',
        `${etiqueta(sheet)}: ${(100 - pctCortos).toFixed(0)}% de tus TP llegan al objetivo`,
        `Objetivo ${tpRangeLabel(sheet)} sobre ${v.ts.length} TP. Dejas correr los ganadores. ${v.nota}`));
    }
  }
  // …y si pasa más en las cuentas fondeadas que en las de prueba (miedo en real)
  if (Array.isArray(ctx.cuentas) && ctx.cuentas.length) {
    const fase = new Map(ctx.cuentas.map(c => [c.id, c.fase]));
    const tipoCuenta = t => {
      const ids = (t.accounts || []).map(a => a && a.accountId).filter(Boolean);
      if (!ids.length) return null;
      return ids.some(id => fase.get(id) === 'fondeada' || fase.get(id) === 'propia') ? 'real' : 'prueba';
    };
    const tpTodos = limpios.filter(t => t.result === 'TP' && TP_RANGE[t.sheet]);
    const real = tpTodos.filter(t => tipoCuenta(t) === 'real');
    const prueba = tpTodos.filter(t => tipoCuenta(t) === 'prueba');
    if (real.length >= UMBRALES.cierres.minTp && prueba.length >= UMBRALES.cierres.minTp) {
      const pr = real.filter(esTpCorto).length / real.length * 100;
      const pp = prueba.filter(esTpCorto).length / prueba.length * 100;
      if (pr - pp >= UMBRALES.cierres.difCuenta) {
        tecAlertas.push(warn('✂',
          `En cuentas fondeadas cierras antes: ${pr.toFixed(0)}% de los TP bajo objetivo`,
          `Frente al ${pp.toFixed(0)}% en cuentas de prueba (${real.length} y ${prueba.length} TP). El sistema es el mismo: cambia la ejecución cuando el dinero es real.`));
      }
    }
  }

  // ── Tamaño del riesgo: ¿arriesgas más en los que pierdes? ──
  // Compara el P&L real (cada trade con su riesgo) con el que saldría con el
  // mismo riesgo medio en todos. La diferencia es lo que resta el tamaño.
  const conRiesgo = limpios.filter(t => t.result !== 'BE' && typeof t.risk_real_pct === 'number' && isFinite(t.risk_real_pct));
  if (conRiesgo.length >= UMBRALES.riesgo.min && new Set(conRiesgo.map(t => t.risk_real_pct)).size >= UMBRALES.riesgo.valores) {
    const media = arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
    const rMedio = media(conRiesgo.map(t => t.risk_real_pct));
    const real = conRiesgo.reduce((a, t) => a + t.pnl_pct * t.risk_real_pct, 0);
    const plano = conRiesgo.reduce((a, t) => a + t.pnl_pct * rMedio, 0);
    const rTP = media(conRiesgo.filter(t => t.result === 'TP').map(t => t.risk_real_pct));
    const rSL = media(conRiesgo.filter(t => t.result === 'SL').map(t => t.risk_real_pct));
    if (real - plano <= UMBRALES.riesgo.fuga && rSL > rTP * UMBRALES.riesgo.factor) {
      tecAlertas.push(warn('⚖',
        `Arriesgas más en los trades que pierdes`,
        `Riesgo medio ${rSL.toFixed(2)}% en tus SL frente a ${rTP.toFixed(2)}% en tus TP. Con el mismo riesgo en todos, tu P&L real sería ${fmtPct(plano - real, 1)} mejor.`));
    }
  }

  // ── Cobertura emocional — sobre los ÚLTIMOS trades, no todo el histórico:
  //    mide el hábito ACTUAL. Los trades de antes de que existiera el campo
  //    sensación no deben penalizar el porcentaje para siempre. ──
  const withSens = withSensacion(trades);
  const ventanaCob = sortChrono(trades).slice(-UMBRALES.ventanaCobertura);
  const ventanaCobSens = withSensacion(ventanaCob);
  const coverage = ventanaCob.length ? (ventanaCobSens.length / ventanaCob.length * 100) : 0;
  if (ventanaCob.length >= UMBRALES.minCobertura) {
    if (coverage < UMBRALES.cobertura.baja) {
      tecAlertas.push(warn('🧠',
        `Cobertura emocional baja: ${coverage.toFixed(0)}% (últimos ${ventanaCob.length} trades)`,
        `Solo ${ventanaCobSens.length} de tus últimos ${ventanaCob.length} trades llevan sensación. Sin esto el diagnóstico emocional pierde valor.`));
    } else if (coverage >= UMBRALES.cobertura.alta) {
      tecInsights.push(success('🧠',
        `Cobertura emocional alta: ${coverage.toFixed(0)}% (últimos ${ventanaCob.length} trades)`,
        `${ventanaCobSens.length} de tus últimos ${ventanaCob.length} trades con sensación. Excelente disciplina.`));
    }
  }

  // ═══════════════════════════════════════════════════════════
  // PATRONES — par, franja, día, sesión, dirección y estrategia
  // Son diagnósticos, no alarmas: naranja o verde, nunca rojo ni insignia.
  // Par, franja y dirección se comparan con el acierto de SU estrategia (así
  // no se confunde "NQ acierta más" con "Nasdaq acierta más"). El texto dice
  // siempre la muestra: con pocos trades, lo que parece el peor par deja de
  // serlo unas semanas después.
  // ═══════════════════════════════════════════════════════════
  const P = UMBRALES.patrones;
  const muestra = n => n < P.amplia
    ? `Con ${n} trades todavía puede ser casualidad: vigílalo antes de cambiar nada.`
    : `Muestra amplia (${n} trades).`;
  const p2 = n => String(n).padStart(2, '0');

  // Grupos dentro de cada estrategia, comparados con el acierto de la estrategia
  const dentroDeEstrategia = (claveFn, min) => {
    const out = [];
    for (const sheet of SHEETS) {
      const sub = limpios.filter(t => t.sheet === sheet);
      const base = resumenR(sub);
      if (base.dec < min * 2) continue;
      const m = new Map();
      for (const t of sub) { const k = claveFn(t); if (k == null || k === '') continue; if (!m.has(k)) m.set(k, []); m.get(k).push(t); }
      if (m.size < 2) continue;
      for (const [k, arr] of m) {
        const r = resumenR(arr);
        if (r.dec >= min) out.push({ sheet, key: k, ...r, dif: r.wr - base.wr, base: base.wr });
      }
    }
    return out;
  };
  const peorDe = (arr, limite) => { const x = [...arr].sort((a, b) => a.dif - b.dif)[0]; return x && x.dif <= -limite ? x : null; };
  const mejorDe = (arr, limite) => { const x = [...arr].sort((a, b) => b.dif - a.dif)[0]; return x && x.dif >= limite ? x : null; };

  // Par
  const pares = dentroDeEstrategia(t => t.pair, P.par.min);
  const peorPar = peorDe(pares, P.par.peor), mejorPar = mejorDe(pares, P.par.mejor);
  if (peorPar) tecAlertas.push(warn('🚫',
    `Peor par: ${peorPar.key} — ${peorPar.wr.toFixed(0)}% de acierto`,
    `${Math.abs(peorPar.dif).toFixed(0)} puntos por debajo de tu media en ${etiqueta(peorPar.sheet)} (${peorPar.base.toFixed(0)}%), P&L ${fmtPct(peorPar.r, 1)}. ${muestra(peorPar.n)}`));
  if (mejorPar && (!peorPar || mejorPar.key !== peorPar.key)) tecInsights.push(success('✓',
    `Mejor par: ${mejorPar.key} — ${mejorPar.wr.toFixed(0)}% de acierto`,
    `${mejorPar.dif.toFixed(0)} puntos por encima de tu media en ${etiqueta(mejorPar.sheet)}, P&L ${fmtPct(mejorPar.r, 1)}. ${muestra(mejorPar.n)}`));

  // Franja horaria
  const franjas = dentroDeEstrategia(t => (t.open_hour == null || isNaN(t.open_hour)) ? null : Math.floor(t.open_hour), P.franja.min);
  const horaTxt = f => `${p2(f.key)}–${p2((f.key + 1) % 24)} h en ${etiqueta(f.sheet)}`;
  const peorFr = peorDe(franjas, P.franja.peor), mejorFr = mejorDe(franjas, P.franja.mejor);
  if (peorFr) tecAlertas.push(warn('🕐',
    `Peor franja: ${horaTxt(peorFr)} — ${peorFr.wr.toFixed(0)}% de acierto`,
    `${Math.abs(peorFr.dif).toFixed(0)} puntos por debajo de tu media en esa estrategia (${peorFr.base.toFixed(0)}%), P&L ${fmtPct(peorFr.r, 1)}. ${muestra(peorFr.n)}`));
  if (mejorFr) tecInsights.push(success('🕐',
    `Mejor franja: ${horaTxt(mejorFr)} — ${mejorFr.wr.toFixed(0)}% de acierto`,
    `${mejorFr.dif.toFixed(0)} puntos por encima de tu media en esa estrategia, P&L ${fmtPct(mejorFr.r, 1)}. ${muestra(mejorFr.n)}`));

  // Día de la semana (frente al acierto global)
  const dias = wrByDay(limpios).filter(d => d.n >= P.dia.min);
  const NOMBRE_DIA = { Lun: 'lunes', Mar: 'martes', 'Mié': 'miércoles', Jue: 'jueves', Vie: 'viernes' };
  if (dias.length >= 2) {
    const peorD = [...dias].sort((a, b) => a.wr - b.wr)[0], mejorD = [...dias].sort((a, b) => b.wr - a.wr)[0];
    if (peorD.wr <= globalWR - P.dia.dif) tecAlertas.push(warn('📅',
      `Peor día: ${NOMBRE_DIA[peorD.label] || peorD.label} — ${peorD.wr.toFixed(0)}% de acierto`,
      `${(globalWR - peorD.wr).toFixed(0)} puntos por debajo de tu media (${globalWR.toFixed(0)}%), P&L ${fmtPct(peorD.pnl, 1)}. ${muestra(peorD.n)}`));
    if (mejorD.wr >= globalWR + P.dia.dif) tecInsights.push(success('📅',
      `Mejor día: ${NOMBRE_DIA[mejorD.label] || mejorD.label} — ${mejorD.wr.toFixed(0)}% de acierto`,
      `${(mejorD.wr - globalWR).toFixed(0)} puntos por encima de tu media, P&L ${fmtPct(mejorD.pnl, 1)}. ${muestra(mejorD.n)}`));
  }

  // Londres frente a Nueva York. Las ventanas están en hora de MADRID; como
  // cada usuario ve sus horas en su huso, se trasladan a su hora.
  const dTz = tzHourDiff('Europe/Madrid', auth.timezone());
  const enVentana = (h, from, to) => {
    const f = ((from + dTz) % 24 + 24) % 24, t2 = ((to + dTz) % 24 + 24) % 24;
    return f <= t2 ? (h >= f && h < t2) : (h >= f || h < t2);
  };
  const lon = resumenR(limpios.filter(t => t.open_hour != null && enVentana(t.open_hour, ...P.sesion.londres)));
  const ny = resumenR(limpios.filter(t => t.open_hour != null && enVentana(t.open_hour, ...P.sesion.ny)));
  if (lon.dec >= P.sesion.min && ny.dec >= P.sesion.min && Math.abs(lon.wr - ny.wr) >= P.sesion.dif) {
    const [buena, otra, nombre] = lon.wr > ny.wr ? [lon, ny, 'Londres'] : [ny, lon, 'Nueva York'];
    tecInsights.push(success('🌍',
      `Mejor sesión: ${nombre} — ${buena.wr.toFixed(0)}% frente a ${otra.wr.toFixed(0)}%`,
      `P&L ${fmtPct(buena.r, 1)} en ${buena.n} trades frente a ${fmtPct(otra.r, 1)} en ${otra.n}.`));
  }

  // Dirección (LONG / SHORT) dentro de cada estrategia
  const dirs = dentroDeEstrategia(t => { const x = String(t.setup || '').toUpperCase(); return x === 'LONG' || x === 'SHORT' ? x : null; }, P.direccion.min);
  for (const sheet of SHEETS) {
    const [a, b] = ['LONG', 'SHORT'].map(k => dirs.find(d => d.sheet === sheet && d.key === k));
    if (!a || !b || Math.abs(a.wr - b.wr) < P.direccion.dif) continue;
    const [mejor, peor] = a.wr > b.wr ? [a, b] : [b, a];
    tecInsights.push(success('↕',
      `${etiqueta(sheet)}: aciertas más en ${mejor.key} — ${mejor.wr.toFixed(0)}% frente a ${peor.wr.toFixed(0)}%`,
      `${mejor.key} ${fmtPct(mejor.r, 1)} en ${mejor.n} trades; ${peor.key} ${fmtPct(peor.r, 1)} en ${peor.n}.`));
  }

  // Estrategia: la que mejor rinde por trade, y aviso si alguna está en pérdidas
  const estr = SHEETS.map(sheet => ({ sheet, ...resumenR(limpios.filter(t => t.sheet === sheet)) })).filter(e => e.n >= P.estrategia.min);
  for (const e of estr) {
    if (e.r < 0) tecAlertas.push(warn('📉',
      `${etiqueta(e.sheet)} en negativo: ${fmtPct(e.r, 1)} en ${e.n} trades`,
      `${e.wr.toFixed(0)}% de acierto. ${muestra(e.n)}`));
  }
  if (estr.length >= 2) {
    const mejorE = [...estr].sort((a, b) => b.r / b.n - a.r / a.n)[0];
    if (mejorE.r > 0) tecInsights.push(success('★',
      `Tu mejor estrategia: ${etiqueta(mejorE.sheet)} — ${fmtPct(mejorE.r / mejorE.n, 2)} por trade`,
      `${fmtPct(mejorE.r, 1)} en ${mejorE.n} trades, ${mejorE.wr.toFixed(0)}% de acierto.`));
  }

  // El sistema en conjunto
  const total = resumenR(limpios);
  if (total.n >= P.sistema.min) {
    const pf = profitFactor(limpios);
    const pfTxt = isFinite(pf) ? pf.toFixed(2) : '∞';
    // (va el primero de "Lo que va bien")
    if (total.r > 0) tecInsights.unshift(success('✓',
      `Tu sistema gana: ${fmtPct(total.r, 1)} en ${total.n} trades`,
      `${fmtPct(total.r / total.n, 2)} por trade de media, ${total.wr.toFixed(0)}% de acierto y profit factor ${pfTxt}.`));
    else tecAlertas.push(warn('📉',
      `Tu sistema está en negativo: ${fmtPct(total.r, 1)} en ${total.n} trades`,
      `${total.wr.toFixed(0)}% de acierto y profit factor ${pfTxt}. Mira arriba qué se lleva el P&L antes de tocar la estrategia.`));
  }

  // Días positivos: solo como punto fuerte. Como alerta no sirve: con un 42 %
  // de acierto y TP de 2R lo normal es tener menos de la mitad de días en
  // verde y aun así ganar, así que saltaba a casi todos los alumnos.
  if (operatedDays.length >= P.diasPositivos.min) {
    const vals = operatedDays.map(d => dayPnl[d]);
    const win = vals.filter(v => v > 0).length, loss = vals.filter(v => v < 0).length;
    const pctDias = win / vals.length * 100;
    if (pctDias >= P.diasPositivos.bien) tecInsights.push(success('✓',
      `Días positivos: ${pctDias.toFixed(0)}%`,
      `${win} días en verde y ${loss} en rojo de ${vals.length} operados.`));
  }

  // ═══════════════════════════════════════════════════════════
  // ALERTAS EMOCIONALES
  // ═══════════════════════════════════════════════════════════

  if (withSens.length < 3) {
    emoAlertas.push(warn('🧠',
      `Pocos datos emocionales (${withSens.length} trades con sensación)`,
      `Registra al menos 3 trades con sensación para empezar a ver diagnóstico emocional.`));
    return ordenarPorSeveridad({ tecAlertas, tecInsights, emoAlertas, emoInsights, planAlertas, planInsights });
  }

  // ── Racha activa de SL con misma sensación (cualquiera, prioridad si negativa) ──
  const sortedAll = sortChrono(withSens);
  let curSens = { sens: '', n: 0 };
  for (let i = sortedAll.length - 1; i >= 0; i--) {
    const t = sortedAll[i];
    if (t.result === 'SL') {
      if (curSens.n === 0) curSens = { sens: t.sensacion, n: 1 };
      else if (curSens.sens === t.sensacion) curSens.n++;
      else break;
    } else if (t.result === 'TP') {
      break;
    }
  }
  if (curSens.n >= 3 && isActiveTrader) {
    const esNegativa = NEGATIVAS.includes(curSens.sens);
    const alerta = (esNegativa ? danger : warn)('🚨',
      `Racha activa: ${curSens.n} SL seguidos con "${curSens.sens}"`,
      `Estado emocional ${esNegativa ? 'negativo' : ''} provocando pérdidas consecutivas. Para y reflexiona.`);
    // Racha de SL desde estado negativo = conducta aguda → grave
    emoAlertas.push(esNegativa ? critico(alerta) : alerta);
  }

  // ── Última operación: SL desde estado negativo ──
  const lastWithSens = sortedAll[sortedAll.length - 1];
  if (lastWithSens && isActiveTrader && lastWithSens.result === 'SL' && NEGATIVAS.includes(lastWithSens.sensacion)) {
    emoAlertas.push(warn('⚠',
      `Última operación: SL desde "${lastWithSens.sensacion}"`,
      `Tu último trade lo cerraste en pérdidas operando con sensación negativa. Si la siguiente vas igual, no operes.`));
  }

  // ── Con duda o sensación negativa frente a seguro/en calma, en P&L ──
  // Agrupado: FOMO, Venganza y Miedo son poco frecuentes y por separado no
  // dan muestra; juntas con "Dudoso" sí, y es donde se va el dinero.
  const conSensLimpios = withSensacion(limpios);
  const noPositiva = t => !POSITIVAS.includes(t.sensacion);
  const vSens = ventana(conSensLimpios, noPositiva, UMBRALES.coste.minSens);
  const noPos = resumenR(vSens.ts.filter(noPositiva));
  const pos = resumenR(vSens.ts.filter(t => POSITIVAS.includes(t.sensacion)));
  if (noPos.dec >= UMBRALES.coste.minSens && pos.dec >= UMBRALES.coste.minSens) {
    const desglose = [...sensacionStats(vSens.ts.filter(noPositiva))]
      .sort((x, y) => y[1].total - x[1].total)
      .map(([nombre, d]) => `${nombre.split(' - ')[0]} ${d.total} (${d.wr.toFixed(0)}%)`).join(' · ');
    if (noPos.wr < pos.wr - UMBRALES.coste.difSens) {
      emoAlertas.push((noPos.r < 0 ? danger : warn)('⚠',
        noPos.r < 0
          ? `Con duda o sensación negativa: ${fmtPct(noPos.r, 1)} en ${noPos.n} trades`
          : `Con duda o sensación negativa aciertas menos: ${noPos.wr.toFixed(0)}% en ${noPos.n} trades`,
        `${noPos.wr.toFixed(0)}% de acierto (${fmtPct(noPos.r, 1)}) frente a ${pos.wr.toFixed(0)}% cuando entras seguro o en calma. ${desglose}. ${vSens.nota} Si hay duda, no se opera.`));
      emoInsights.push(success('✓',
        `Seguro o en calma: ${fmtPct(pos.r, 1)} en ${pos.n} trades`,
        `${pos.wr.toFixed(0)}% de acierto, ${(pos.wr - noPos.wr).toFixed(0)} puntos más que con duda o sensación negativa. ${vSens.nota}`));
    } else if (noPos.wr >= pos.wr) {
      emoAlertas.push(warn('⚠',
        `Aciertas igual o más con duda (${noPos.wr.toFixed(0)}%) que seguro (${pos.wr.toFixed(0)}%)`,
        `Algo no encaja. Revisa si apuntas la sensación después de ver el resultado o si confundes las etiquetas.`));
    }
  }

  // ── Peor y mejor sensación, una a una (este patrón sí se mantiene en el tiempo) ──
  const PS = UMBRALES.patrones.sensacion;
  const sensWR = winrate(conSensLimpios);
  const porSens = [...sensacionStats(conSensLimpios)].filter(([, d]) => d.total >= PS.min);
  if (porSens.length > 1) {
    const peorS = [...porSens].sort((x, y) => x[1].wr - y[1].wr)[0];
    // La mejor nunca es una negativa: acertar con miedo o FOMO no es algo que reforzar.
    const mejorS = [...porSens].filter(([n]) => !NEGATIVAS.includes(n)).sort((x, y) => y[1].wr - x[1].wr)[0];
    if (peorS[1].wr < sensWR - PS.dif) emoAlertas.push((NEGATIVAS.includes(peorS[0]) ? danger : warn)('⚠',
      `Peor sensación: "${peorS[0]}" — ${peorS[1].wr.toFixed(0)}% de acierto`,
      `${(sensWR - peorS[1].wr).toFixed(0)} puntos por debajo de tu media (${sensWR.toFixed(0)}%) en ${peorS[1].total} trades, P&L ${fmtPct(peorS[1].pnl, 1)}. Si te detectas así, no operes.`));
    if (mejorS && mejorS[1].wr > sensWR + PS.dif) emoInsights.push(success('✨',
      `Mejor sensación: "${mejorS[0]}" — ${mejorS[1].wr.toFixed(0)}% de acierto`,
      `${(mejorS[1].wr - sensWR).toFixed(0)} puntos por encima de tu media en ${mejorS[1].total} trades, P&L ${fmtPct(mejorS[1].pnl, 1)}.`));
  }

  // ── Un mes sin FOMO, venganza ni miedo ──
  const SN = UMBRALES.patrones.sinNegativas;
  const recSens = recentTrades(conSensLimpios, SN.dias);
  if (recSens.length >= SN.min && !recSens.some(t => NEGATIVAS.includes(t.sensacion))) {
    emoInsights.push(success('✓',
      `${SN.dias} días sin FOMO, venganza ni miedo`,
      `${recSens.length} trades en el último mes y ninguno con sensación negativa.`));
  }

  return ordenarPorSeveridad({ tecAlertas, tecInsights, emoAlertas, emoInsights, planAlertas, planInsights });
}

// Nº de alertas GRAVES activas (marcadas con `critico`): rachas de SL, límites
// del día y plan incumplido. Lo usan el badge de "Diagnóstico" en el menú y la
// columna Alertas de Mis Alumnos. Los rojos analíticos (peor par/franja/
// sensación, tendencia) NO cuentan: si el badge se enciende, es serio de verdad.
export function countDangerAlerts(trades) {
  const r = buildAlerts(trades);
  return [...r.tecAlertas, ...r.emoAlertas, ...r.planAlertas].filter(a => a.grave).length;
}

// Semáforo del día: ¿puede operar HOY este trader?
//   'stop'  (rojo)    = una regla DURA de hoy: algo que has hecho hoy obliga a parar.
//   'warn'  (naranja) = hay alguna alerta importante activa en el Diagnóstico
//                       (racha de SL, plan incumplido…) o estás cerca de un límite del día.
//   'ok'    (verde)   = ninguna alerta importante ni regla del día — vía libre de verdad.
// Coherencia clave: naranja ⟺ el badge rojo del menú "Diagnóstico" está encendido.
// Usa los mismos UMBRALES/alertas que el resto — un solo criterio en toda la app.
export function todayStatus(trades) {
  const stops = [], warns = [];
  const todays = todaysTrades(trades);
  const todaySL = todays.filter(t => t.result === 'SL').length;
  const todayPnl = todays.reduce((s, t) => s + tradeRealPnl(t), 0);
  const badEmotions = new Set(NEGATIVAS);

  // ── ROJO: reglas duras de HOY (para AHORA) ──
  if (todaySL >= UMBRALES.slDia) stops.push(`${todaySL} SL hoy`);
  if (todays.length >= UMBRALES.maxTradesDia) stops.push(`${todays.length} trades hoy (máx ${UMBRALES.maxTradesDia})`);
  if (todayPnl <= UMBRALES.ddDiario) stops.push(`${todayPnl.toFixed(1)}% hoy (límite ${UMBRALES.ddDiario}%)`);
  if (todays.some(t => badEmotions.has(t.sensacion))) stops.push('sensación negativa hoy');
  const veng = casosVenganzaHoy(todays);
  if (veng.confirmados) stops.push('trade de venganza hoy');

  // ── NARANJA: avisos del día (cerca de un límite) ──
  if (todaySL === UMBRALES.avisoSlDia) warns.push(`${todaySL} SL hoy`);
  if (todays.length === UMBRALES.avisoTradesDia) warns.push(`${todays.length} trades hoy`);
  if (!veng.confirmados && veng.casos) warns.push('reentrada rápida tras un SL');
  const fueraHoy = todays.filter(t => t.plan_followed === false).length;
  if (fueraHoy === 1) warns.push('1 trade fuera del plan hoy');

  // ── NARANJA: alertas GRAVES activas del Diagnóstico que no son parada de hoy
  //    (racha de SL, plan incumplido, racha de días en rojo…). Así el semáforo
  //    NUNCA está verde si el Diagnóstico tiene una alerta importante. ──
  if (!stops.length) {
    const n = countDangerAlerts(trades);
    if (n) warns.push(`${n} alerta${n > 1 ? 's' : ''} importante${n > 1 ? 's' : ''} en tu diagnóstico`);
  }

  if (stops.length) return { level: 'stop', reasons: stops };
  if (warns.length) return { level: 'warn', reasons: [...new Set(warns)] };
  return { level: 'ok', reasons: [] };
}
