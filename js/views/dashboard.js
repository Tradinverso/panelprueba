import { ic } from '../components/icons.js';
import { state } from '../state.js';
import { auth } from '../auth.js';
import { router } from '../router.js';
import {
  winrate, pnlPct, pnlPctReal, profitFactor, maxDrawdown, maxStreak, bestTpStreakPnl,
  equityCurve, equityCurveReal, monthlyPnl, activeDays, tradeCounts, durationStats,
  wrByHour, wrByDay, statsByGroup, longVsShort, avgRR, expectancy, planStats,
} from '../utils/calculations.js';
import { fmtPct, fmtPctNoSign, fmtNum } from '../utils/number-format-es.js';
import {
  formatDateShort, MONTHS_ES_SHORT,
} from '../utils/date-helpers.js';
import { kpiCard, kpiCardComposite } from '../components/kpi-card.js';
import { createEquity, createBar, createHourBar, createDayBar } from '../components/charts.js';
import { renderHeatmap } from '../components/heatmap.js';
import { openDiarioModal } from '../components/diario-modal.js';
import { hoy as hoyDiario, estadoDia } from '../utils/diario.js';
import { buildAlerts } from '../utils/diagnostics.js';
import { renderPills } from '../components/pills.js';
import { todayStatus } from '../utils/diagnostics.js';
import { checklistProgress } from '../utils/checklist-items.js';
import { openChecklistModal } from '../components/checklist-modal.js';
import { periodStats, mondayOf } from '../utils/period-stats.js';
import { todayLocal } from '../utils/timezone.js';
import { appearance } from '../appearance.js';
import {
  newPeriod, monthsOf, inPeriod, clampPeriod, periodHtml, wirePeriod, prevPeriod,
} from '../components/period-filter.js';

const STRAT_LABELS = { ZONAS: 'Forex, Oro y Oil', LIQUIDEZ: 'EUR/USD', NASDAQ: 'NQ Futuros' };

let dashPeriod = newPeriod();   // rango de meses { from, to }
let perfMode = 'sistema'; // 'sistema' | 'real'
let lastUserKey = null;   // detecta cambio de usuario (viewAs) para resetear filtros

function render(container) {
  const allTrades = state.trades;

  // Los filtros viven a nivel de módulo: al cambiar de alumno (viewAs) o si el
  // periodo filtrado ya no existe en los datos (wipe/reimport), se resetean.
  // Si no, filtrarían en silencio con el select mostrando "Todos".
  const userKey = state.viewAsUid || 'self';
  if (userKey !== lastUserKey) {
    if (lastUserKey !== null) dashPeriod = newPeriod();
    lastUserKey = userKey;
  }
  clampPeriod(dashPeriod, monthsOf(allTrades));

  if (!allTrades.length) {
    container.innerHTML = impersonationBanner() + (state.loading ? loadingState() : emptyState());
    wireImpersonation(container);
    return;
  }

  const filtered = filterTrades(allTrades, dashPeriod);
  container.innerHTML = impersonationBanner() + renderShell(allTrades, filtered);
  wireImpersonation(container);

  // Botón "Checklist n/5": abre el pop-up; al cerrarlo se repinta (contador y color).
  const chkBtn = container.querySelector('#semaforoChk');
  if (chkBtn) chkBtn.addEventListener('click', () => openChecklistModal(() => {
    const b = container.querySelector('#semaforoChk');
    if (b) b.outerHTML = checklistChip();
    container.querySelector('#semaforoChk')?.addEventListener('click', () => chkBtn.click());
  }));

  // Chip del diario de hoy: abre el pop-up (plan, trades y revisión).
  container.querySelector('#diarioChip')?.addEventListener('click', () => openDiarioModal());

  wirePeriod(container, dashPeriod, () => render(container), { idFrom: 'dashFrom', idTo: 'dashTo' });

  // Toggle Sistema 1R / Real (en la franja Pulso): cambia todas las cifras de P&L.
  const perfToggleEl = container.querySelector('#perfToggle');
  if (perfToggleEl) {
    renderPills(perfToggleEl, {
      name: 'perfMode',
      options: [{ value: 'sistema', label: 'Sistema 1R' }, { value: 'real', label: 'Real' }],
      value: perfMode,
      onChange: v => { perfMode = v; render(container); },
    });
  }
  // Ocultar / mostrar importes de P&L (preferencia de Apariencia)
  const hideBtn = container.querySelector('#pulseHide');
  if (hideBtn) hideBtn.addEventListener('click', () => {
    appearance.set({ hidePnl: !appearance.get().hidePnl });   // pnl-mask.js repinta la vista
  });

  // KPIs y tablas (HTML puro) se pintan ya.
  paintKpis(container, filtered, allTrades);
  paintStreaks(container, filtered);
  paintDurations(container, filtered);

  // Gráficos (Chart.js): en el siguiente frame, cuando el layout del contenedor
  // ya está calculado. Crearlos en el mismo tick que el innerHTML provoca que a
  // veces midan tamaño 0 y salgan en blanco hasta refrescar.
  requestAnimationFrame(() => {
    if (!container.querySelector('#equityChart')) return; // la vista cambió
    paintEquity(container, filtered);
    paintMonthly(container, allTrades);
    ['ZONAS', 'LIQUIDEZ', 'NASDAQ'].forEach(s => paintStrategy(container, s, filtered));
    paintTiming(container, filtered);
    paintDirectionAndPairs(container, filtered);
  });
}

function impersonationBanner() {
  if (!state.viewAsUid || !state.viewAsProfile) return '';
  const p = state.viewAsProfile;
  const n = state.trades.length;
  return `
    <div class="imp-banner">
      <div class="imp-banner-icon">${ic('nota')}</div>
      <div class="imp-banner-text">
        Editando como <strong>${escapeHtml(p.nombre || p.email)}</strong>
        <span class="meta">${n} trades · cualquier cambio se guarda en SU cuenta</span>
      </div>
      <button class="btn" id="exitImpBtn">Volver a Mis Alumnos</button>
    </div>
  `;
}

function wireImpersonation(container) {
  const btn = container.querySelector('#exitImpBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    await state.exitViewAs();
    router.go('#/admin');
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function dashboardView(container) {
  render(container);
  const unsubState = state.on(() => render(container));
  return () => {
    unsubState();
  };
}

// Mientras Firestore responde, sin datos aún en memoria: no confundir con el
// vacío real ("Aún no hay trades"), que asusta si solo es una carga lenta.
function loadingState() {
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <div class="sub">Cargando…</div>
      </div>
    </div>
    <div class="empty">
      <span class="spinner-sm" style="width:24px;height:24px;border-width:3px;"></span>
      <div style="margin-top:14px;">Cargando tus datos…</div>
    </div>
  `;
}

// ── Empty state ──────────────────────────────────────────────
function emptyState() {
  const userName = state.viewAsUid && state.viewAsProfile
    ? (state.viewAsProfile.nombre || state.viewAsProfile.email.split('@')[0])
    : auth.displayName();
  const userSuffix = userName ? ` <span style="color:var(--muted);font-weight:400;">·</span> <span style="color:var(--text);font-weight:500;">${escapeHtml(userName)}</span>` : '';
  const writableActions = state.readOnly ? '' : `
      <a class="btn primary" href="#/importar" style="margin-top:20px;display:inline-flex;">Importar datos</a>
      <a class="btn" href="#/nuevo" style="margin-top:20px;margin-left:8px;display:inline-flex;">Nuevo trade</a>
  `;
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard${userSuffix}</h1>
        <div class="sub">Sin datos aún</div>
      </div>
    </div>
    <div class="empty">
      <div class="big">${ic('nasdaq')}</div>
      <div>Aún no hay trades${state.readOnly ? '' : '. Importa tu histórico desde Google Sheets o crea un trade nuevo'}.</div>
      ${writableActions}
    </div>
  `;
}

// ── Filter helpers ───────────────────────────────────────────
function filterTrades(trades, sel) {
  return trades.filter(t => inPeriod(t.date, sel));
}

// Trades del periodo ANTERIOR equivalente al filtro actual, para comparar.
// Con un rango de N meses, el "antes" son los N meses justo anteriores. Sin
// periodo acotado no hay comparación posible (no hay un antes con el que medir).
function prevPeriodTrades(allTrades, sel) {
  const prev = prevPeriod(sel, monthsOf(allTrades));
  if (!prev) return null;
  return { trades: allTrades.filter(t => inPeriod(t.date, prev.range)), ref: prev.ref };
}

// Construye la píldora de tendencia. `better` decide el color: en el DD, menos es mejor.
function trend(curr, prev, ref, { unit = 'pp', lowerIsBetter = false } = {}) {
  if (prev == null || !isFinite(curr) || !isFinite(prev)) return null;
  const delta = curr - prev;
  const txt = (delta > 0 ? '+' : '−') + fmtNum(Math.abs(delta), 1) + unit;
  return { delta, text: txt, ref, better: lowerIsBetter ? delta < 0 : delta > 0 };
}

// ── Shell HTML ───────────────────────────────────────────────
function renderShell(allTrades, filtered) {
  const months = monthsOf(allTrades);
  const dates = filtered.map(t => t.date).sort();
  const first = dates.length ? formatDateShort(dates[0]) : '';
  const last = dates.length ? formatDateShort(dates[dates.length - 1]) : '';
  const userName = state.viewAsUid && state.viewAsProfile
    ? (state.viewAsProfile.nombre || state.viewAsProfile.email.split('@')[0])
    : auth.displayName();
  return `
    <div class="page-header">
      <div>
        <h1>Dashboard${userName ? ` <span style="color:var(--muted);font-weight:400;">·</span> <span style="color:var(--text);font-weight:500;">${escapeHtml(userName)}</span>` : ''}</h1>
        <div class="sub">${filtered.length} trades · ${first} → ${last}</div>
      </div>
      <div class="page-actions">
        ${periodHtml(months, dashPeriod, { idFrom: 'dashFrom', idTo: 'dashTo' })}
        ${checklistChip()}
        ${diarioChip()}
        ${semaforoPill(allTrades)}
        <a class="btn primary" href="#/nuevo">+ Nuevo trade</a>
      </div>
    </div>

    ${pulseStrip(allTrades)}

    <div class="kpi-grid" id="kpis"></div>

    <div class="section-title">Rendimiento</div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-head">
          <div>
            <div class="card-title">Curva de equity (P&L acumulado)</div>
            <div class="card-sub">Por estrategia · ${perfMode === 'real' ? 'P&L real (riesgo aplicado)' : 'Sistema 1R normalizado'}</div>
          </div>
          <div class="eq-legend" style="display:flex;gap:6px;" title="Pulsa una estrategia para mostrar u ocultar su línea">
            <button type="button" class="strat-pill global" data-eq="0">● Global</button>
            <button type="button" class="strat-pill zonas" data-eq="1">● Zonas</button>
            <button type="button" class="strat-pill liquidez" data-eq="2">● Liquidez</button>
            <button type="button" class="strat-pill nasdaq" data-eq="3">● Nasdaq</button>
          </div>
        </div>
        <div class="chart-wrap" style="height:300px;"><canvas id="equityChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">P&L mensual</div>
        <div class="card-sub">${monthlyChartYear() ? 'Año ' + monthlyChartYear() : 'Todo el histórico'} · ${perfMode === 'real' ? '% riesgo real' : '% sistema 1R'}</div>
        <div class="chart-wrap" style="height:300px;"><canvas id="monthlyChart"></canvas></div>
      </div>
    </div>

    <div class="section-title">Por estrategia</div>
    <div class="grid-3 strat-grid" id="stratGrid">
      ${['ZONAS', 'LIQUIDEZ', 'NASDAQ'].map(s => stratCardShell(s)).join('')}
    </div>

    <div class="section-title">Timing y dirección</div>
    <div class="grid-3">
      <div class="card">
        <div class="card-title">Winrate por franja horaria</div>
        <div class="card-sub">Hora de apertura · Línea = nº trades</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="hourChart"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Winrate por día de semana</div>
        <div class="card-sub">WR + nº trades por día</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="dayChart"></canvas></div>
      </div>
      <div class="card" id="lsCard">
        <div class="card-title">Long vs Short</div>
        <div class="card-sub">Winrate y P&L según dirección</div>
        <div id="lsBody"></div>
      </div>
    </div>

    <div class="section-title">Mapa de calor y diagnóstico</div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-title">WR por día y hora</div>
        <div class="card-sub">Color fuerte = WR alto · rojo = WR bajo · gris = sin trades</div>
        <div id="heatmap" style="margin-top:14px;"></div>
      </div>
      <div class="card">
        <div class="card-head">
          <div><div class="card-title">Diagnóstico</div><div class="card-sub">Lo más relevante ahora</div></div>
          <a class="mesa-link" href="#/diagnostico">Todo →</a>
        </div>
        <div class="diag-mini" id="diagMini"></div>
      </div>
    </div>

    <div class="section-title">Dirección y pares</div>
    <div class="grid-2">
      <div class="card table-card" style="grid-column: 1 / -1;">
        <div class="card-title">Rendimiento por par</div>
        <div class="card-sub">Pares con ≥1 trade</div>
        <table class="data-table"><thead><tr>
          <th>Par</th><th>Trades</th><th>WR</th><th>P&L sist.</th><th>P&L real</th><th>PF</th><th>Señal</th>
        </tr></thead><tbody id="pairsTbody"></tbody></table>
      </div>
    </div>

    <div class="section-title">Rachas y drawdown</div>
    <div class="card table-card" style="margin-bottom:24px;">
      <div class="card-title" style="margin-bottom:14px;">Rachas consecutivas y DD por estrategia y par</div>
      <table class="data-table"><thead><tr>
        <th>Métrica</th><th>Global</th>
        <th style="color:var(--liquidez)">Liquidez</th>
        <th style="color:var(--nasdaq)">Nasdaq</th>
        <th style="color:var(--zonas)">Zonas</th>
        <th style="color:var(--pair-gbp)">GBP/USD</th>
        <th style="color:var(--pair-eur)">EUR/USD</th>
        <th style="color:var(--pair-gold)">ORO</th>
        <th style="color:var(--pair-oil)">OIL</th>
      </tr></thead><tbody id="streakTbody"></tbody></table>
    </div>

    <div class="section-title">Duración de trades</div>
    <div class="card table-card" style="margin-bottom:24px;">
      <div class="card-title" style="margin-bottom:14px;">Duración media por estrategia y resultado</div>
      <table class="data-table"><thead><tr>
        <th>Estrategia</th><th>Media</th><th>Media TP</th><th>Media SL</th><th>Máxima</th><th>Mínima</th>
      </tr></thead><tbody id="durTbody"></tbody></table>
    </div>
  `;
}

// Tarjeta por estrategia: barra superior del color de la estrategia, nombre y
// meta, estado, anillo de winrate (conic-gradient) y 4 líneas. Pulsable → la
// página de esa estrategia.
const STRAT_ROUTE = { ZONAS: '#/zonas', LIQUIDEZ: '#/liquidez', NASDAQ: '#/nasdaq' };
function stratCardShell(s) {
  const cls = { ZONAS: 'zonas', LIQUIDEZ: 'liquidez', NASDAQ: 'nasdaq' }[s];
  return `
    <a class="card strat-card ${cls}" data-strat="${s}" href="${STRAT_ROUTE[s]}" title="Ver análisis de ${s.charAt(0) + s.slice(1).toLowerCase()}">
      <div class="strat-head">
        <div>
          <div class="card-title">${s.charAt(0) + s.slice(1).toLowerCase()}</div>
          <div class="card-sub" data-field="sub">– trades</div>
        </div>
        <span class="strat-status" data-field="status">Activa</span>
      </div>
      <div class="strat-body">
        <div class="strat-ring" data-field="ring"><span data-field="wr">–</span><small>winrate</small></div>
        <div class="strat-lines">
          <div><span>P&L sist.</span><b data-field="pnl" class="pnl-value">–</b></div>
          <div><span>P&L real</span><b data-field="pnlReal" class="pnl-value">–</b></div>
          <div><span>PF</span><b data-field="pf">–</b></div>
          <div><span>Trades</span><b data-field="n">–</b></div>
        </div>
      </div>
    </a>
  `;
}

// ── Painters ─────────────────────────────────────────────────
function paintKpis(container, trades, allTrades) {
  const c = tradeCounts(trades);
  const decisive = c.tp + c.sl;
  const wr = winrate(trades);
  const pnl = pnlPct(trades);
  const pnlReal = pnlPctReal(trades);
  const dd = maxDrawdown(trades);
  const pf = profitFactor(trades);
  const exp = expectancy(trades);
  const rr = avgRR(trades);
  const plan = planStats(trades);
  const tpStreak = maxStreak(trades, 'TP');
  const tpStreakPct = bestTpStreakPnl(trades);
  const days = activeDays(trades);
  const avgPerDay = days > 0 ? (c.total / days).toFixed(1) : '0';

  // Comparación con el periodo anterior (solo si hay un mes/año seleccionado y
  // ese periodo anterior tiene trades: comparar contra cero no dice nada).
  const prev = allTrades ? prevPeriodTrades(allTrades, dashPeriod) : null;
  const p = prev && prev.trades.length ? prev : null;
  const tWr   = p ? trend(wr, winrate(p.trades), p.ref) : null;
  const tPnl  = p ? trend(pnl, pnlPct(p.trades), p.ref) : null;
  const tReal = p ? trend(pnlReal, pnlPctReal(p.trades), p.ref) : null;
  const tDd   = p ? trend(dd, maxDrawdown(p.trades), p.ref, { lowerIsBetter: true }) : null;
  const tPf   = p ? trend(pf, profitFactor(p.trades), p.ref, { unit: '' }) : null;
  const tExp  = p ? trend(exp.value, expectancy(p.trades).value, p.ref) : null;
  const tPlan = p ? trend(plan.pctInPlan, planStats(p.trades).pctInPlan, p.ref) : null;

  // 2 filas de 5: arriba las 5 clave, abajo las 5 secundarias.
  container.querySelector('#kpis').innerHTML = [
    kpiCard({ label: 'Winrate global', value: wr.toFixed(1) + '%', sub: `${c.tp} TP · ${c.sl} SL · ${c.be} BE`, tone: decisive > 0 && wr < 40 ? 'red' : 'blue', trend: tWr }),
    kpiCard({ label: 'P&L sistema', value: fmtPct(pnl, 1), sub: 'trades al 1%', tone: pnl >= 0 ? 'green' : 'red', trend: tPnl }),
    kpiCard({ label: 'P&L real', value: fmtPct(pnlReal, 1), sub: 'según riesgo real', tone: pnlReal >= 0 ? 'green' : 'red', trend: tReal }),
    kpiCard({ label: 'DD máximo', value: (dd > 0 ? '−' : '') + dd.toFixed(1) + '%', sub: 'equity combinada', tone: 'red', trend: tDd }),
    kpiCardComposite({ label: 'Racha TP máx', primary: tpStreak, secondary: 'TP · ' + fmtPct(tpStreakPct, 1), sub: 'consecutivos · % sistema', tone: 'green' }),
    // Mismos umbrales que la leyenda de la tabla de pares: >2 verde · 1.5-2 naranja.
    kpiCard({ label: 'Profit factor', value: decisive ? (isFinite(pf) ? fmtNum(pf) : '∞') : '–', sub: 'bruto ganado / bruto perdido', tone: !decisive ? 'blue' : pf >= 2 ? 'green' : pf >= 1.5 ? 'orange' : 'red', trend: tPf }),
    kpiCard({ label: 'Esperanza / trade', value: decisive ? fmtPct(exp.value, 2) : '–', sub: decisive ? `media TP ${fmtPct(exp.avgWin, 1)} · media SL −${fmtPctNoSign(exp.avgLoss)}` : 'sin trades decisivos', tone: exp.value >= 0 ? 'green' : 'red', trend: tExp }),
    kpiCard({ label: 'RR medio', value: rr > 0 ? '1:' + fmtNum(rr) : '–', sub: rr > 0 ? 'R media ganada en los TP' : 'sin TP todavía', tone: 'blue' }),
    kpiCard({ label: 'Adherencia al plan', value: plan.total ? plan.pctInPlan.toFixed(0) + '%' : '–', sub: plan.total ? `${plan.inPlan} dentro · ${plan.outOfPlan} fuera` : 'sin trades marcados', tone: !plan.total ? 'blue' : plan.pctInPlan >= 80 ? 'green' : plan.pctInPlan >= 60 ? 'orange' : 'red', trend: tPlan }),
    kpiCard({ label: 'Días activos', value: days, sub: `${c.total} trades · ${avgPerDay}/día`, tone: 'purple' }),
  ].join('');
}

function paintEquity(container, trades) {
  const curve = perfMode === 'real' ? equityCurveReal : equityCurve;
  const datasets = [
    { key: 'ALL', label: 'Global', data: curve(trades) },
    { key: 'ZONAS', label: 'Zonas', data: curve(trades.filter(t => t.sheet === 'ZONAS')) },
    { key: 'LIQUIDEZ', label: 'Liquidez', data: curve(trades.filter(t => t.sheet === 'LIQUIDEZ')) },
    { key: 'NASDAQ', label: 'Nasdaq', data: curve(trades.filter(t => t.sheet === 'NASDAQ')) },
  ];
  const chart = createEquity(container.querySelector('#equityChart'), datasets);
  // Leyenda pulsable: muestra u oculta la línea de esa estrategia.
  container.querySelectorAll('.eq-legend [data-eq]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.eq;
      const visible = chart.isDatasetVisible(i);
      chart.setDatasetVisibility(i, !visible);
      chart.update();
      btn.classList.toggle('off', visible);
    });
  });
}

// Semáforo del día: ¿puede operar hoy? SOLO reglas de trading (SL, límites,
// venganza…) — el checklist va en su propio chip al lado, porque son cosas
// distintas y antes "Precaución" tapaba el "Checklist pendiente".
// Siempre evalúa HOY sobre todos los trades (el filtro mes/año no le afecta).
const SEMAFORO = {
  ok:   { dot: '<span class="sdot ok"></span>', label: 'Vía libre' },
  warn: { dot: '<span class="sdot warn"></span>', label: 'Precaución' },
  stop: { dot: '<span class="sdot bad"></span>', label: 'Hoy no se opera' },
};
function semaforoPill(allTrades) {
  const s = todayStatus(allTrades);
  const title = (s.reasons.length ? `Hoy: ${s.reasons.join(' · ')}` : 'Sin incidencias hoy — respeta tu plan')
    + ' · Pulsa para ver el Diagnóstico';
  const cfg = SEMAFORO[s.level];
  // Enlace al Diagnóstico: el semáforo te dice "algo pasa"; el clic te lleva al porqué.
  return `<a class="semaforo ${s.level}" href="#/diagnostico" title="${escapeHtml(title)}">${cfg.dot} ${cfg.label}</a>`;
}

// Botón del checklist: "☐ Checklist n/5" en ámbar mientras esté incompleto,
// "✓ Checklist completo" en verde al terminarlo. Abre el pop-up (checklist-modal.js).
// También en "Ver como": el checklist es del navegador de quien mira, no del alumno.
function checklistChip() {
  const p = checklistProgress();
  const hecho = p.done === p.total;
  return `<button class="chk-chip ${hecho ? 'done' : 'pending'}" id="semaforoChk"
            title="${hecho ? 'Checklist de esta sesión completado — pulsa para verlo' : 'Pulsa para abrir el checklist pre-sesión'}">
            ${hecho ? '✓ Checklist completo' : `☐ Checklist ${p.done}/${p.total}`}
          </button>`;
}

// Diario de hoy: naranja si falta el diario inverso, verde con los dos hechos.
// En "Ver como" no sale: el diario es del alumno, no de quien mira.
function diarioChip() {
  if (state.viewAsUid) return '';
  const e = estadoDia(hoyDiario());
  const hecho = e.plan && e.review;
  const txt = hecho ? '✓ Diario de hoy' : !e.plan ? '✎ Diario inverso' : '✎ Cerrar el día';
  return `<button class="chk-chip ${hecho ? 'done' : !e.plan ? 'pending' : 'mid'}" id="diarioChip" title="Diario del día: diario inverso antes de operar, trades y diario del trader al cerrar">${txt}</button>`;
}

// ── Franja "Pulso" ───────────────────────────────────────────
// Una sola tarjeta con 4 columnas (hoy · esta semana · mes · últimas 4
// semanas) + selector Sistema 1R / Real + Ocultar P&L. Sustituye al número
// hero. Siempre sobre TODOS los trades (el filtro Desde/Hasta no le afecta).
function pulseStrip(allTrades) {
  const today = todayLocal(auth.timezone());
  const monday = mondayOf(today);
  const monthStart = today.substring(0, 7) + '-01';
  const d28 = new Date(today + 'T12:00:00'); d28.setDate(d28.getDate() - 27);
  const from28 = d28.toISOString().substring(0, 10);
  const cuentas = state.cuentas;
  const hoy = periodStats(allTrades, cuentas, today, today);
  const sem = periodStats(allTrades, cuentas, monday, today);
  const mes = periodStats(allTrades, cuentas, monthStart, today);
  const w4 = periodStats(allTrades, cuentas, from28, today);
  const histWr = winrate(allTrades);
  const pnlOf = s => perfMode === 'real' ? s.pnlReal : s.pnlSistema;
  const tone = v => v > 0 ? 'green' : (v < 0 ? 'red' : '');
  const mesNombre = new Date(today + 'T12:00:00').toLocaleDateString('es-ES', { month: 'long' });
  const wrTxt = s => s.tp + s.sl > 0 ? `${s.wr.toFixed(0)}% WR` : 'sin WR';
  const nTr = n => `${n} trade${n === 1 ? '' : 's'}`;
  const w4Delta = w4.tp + w4.sl > 0 ? w4.wr - histWr : null;
  const hide = appearance.get().hidePnl;
  const col = (label, value, sub, cls = '') => `
    <div class="pulse-col">
      <div class="pulse-label">${label}</div>
      <div class="pulse-val ${cls} pnl-value">${value}</div>
      <div class="pulse-sub">${sub}</div>
    </div>`;
  return `
    <div class="card pulse">
      ${col('Hoy', hoy.count ? fmtPct(pnlOf(hoy)) : '0 trades', hoy.count ? `${nTr(hoy.count)} · ${hoy.tp} TP · ${hoy.sl} SL` : 'Sin trades aún', hoy.count ? tone(pnlOf(hoy)) : 'muted')}
      ${col('Esta semana', sem.count ? fmtPct(pnlOf(sem)) : '—', sem.count ? `${nTr(sem.count)} · ${wrTxt(sem)}` : 'Sin trades esta semana', tone(pnlOf(sem)))}
      ${col(mesNombre, mes.count ? fmtPct(pnlOf(mes)) : '—', mes.count ? `${nTr(mes.count)} · ${wrTxt(mes)}` : 'Sin trades este mes', tone(pnlOf(mes)))}
      ${col('Últimas 4 semanas', w4.tp + w4.sl > 0 ? `${w4.wr.toFixed(0)}% WR` : '—',
            w4Delta == null ? 'Sin trades' : `vs ${histWr.toFixed(0)}% histórico · ${w4Delta >= 1 ? 'mejorando' : (w4Delta <= -1 ? 'empeorando' : 'estable')}`, 'blue')}
      <div class="pulse-tools">
        <div class="perf-toggle" id="perfToggle"></div>
        <button type="button" class="pulse-hide" id="pulseHide">${hide ? 'Mostrar P&L' : 'Ocultar P&L'}</button>
      </div>
    </div>`;
}

// Año que muestra el gráfico mensual, o null = todo el histórico.
// Este gráfico NUNCA se estrecha a un mes: con un mes elegido enseña el año
// entero de ese mes — una sola barra no cuenta nada.
function monthlyChartYear() {
  const { from, to } = dashPeriod;
  if (from === 'all' && to === 'all') return null;
  const yFrom = from !== 'all' ? from.substring(0, 4) : null;
  const yTo = to !== 'all' ? to.substring(0, 4) : null;
  if (yFrom && yTo) return yFrom === yTo ? yFrom : null;   // rango que cruza años → todo
  return yFrom || yTo;
}

function paintMonthly(container, allTrades) {
  const year = monthlyChartYear();
  const scoped = year ? allTrades.filter(t => t.date.startsWith(year)) : allTrades;
  const data = monthlyPnl(scoped);
  // Con varios años a la vista, la etiqueta lleva el año: si no, salen dos
  // "Ene" idénticos (2025 y 2026) imposibles de distinguir.
  const multiYear = new Set(data.map(d => d.month.split('-')[0])).size > 1;
  const labels = data.map(d => {
    const [y, m] = d.month.split('-');
    return MONTHS_ES_SHORT[+m - 1] + (multiYear ? ' ' + y.slice(2) : '');
  });
  const values = data.map(d => +(perfMode === 'real' ? d.pnlReal : d.pnl).toFixed(2));
  createBar(container.querySelector('#monthlyChart'), labels, values);
}

function paintStrategy(container, sheet, trades) {
  const sub = trades.filter(t => t.sheet === sheet);
  const card = container.querySelector(`[data-strat="${sheet}"]`);
  if (!card) return;
  const c = tradeCounts(sub);
  const subPnl = pnlPct(sub);
  const subPnlReal = pnlPctReal(sub);
  const subWr = winrate(sub);
  const decisive = c.tp + c.sl;
  card.querySelector('[data-field="wr"]').textContent = decisive ? fmtPctNoSign(subWr) : '–';
  // Anillo: verde hasta el WR, rojo el resto; gris si no hay trades.
  const ring = card.querySelector('[data-field="ring"]');
  ring.style.background = decisive
    ? `conic-gradient(var(--green) 0 ${subWr}%, var(--red) ${subWr}% 100%)`
    : 'conic-gradient(var(--line) 0 100%)';
  const pnlEl = card.querySelector('[data-field="pnl"]');
  pnlEl.textContent = fmtPct(subPnl, 1);
  pnlEl.style.color = subPnl >= 0 ? 'var(--green)' : 'var(--red)';
  const pnlRealEl = card.querySelector('[data-field="pnlReal"]');
  pnlRealEl.textContent = fmtPct(subPnlReal, 1);
  pnlRealEl.style.color = subPnlReal >= 0 ? 'var(--green)' : 'var(--red)';
  const subPf = profitFactor(sub);
  card.querySelector('[data-field="pf"]').textContent = sub.length ? (isFinite(subPf) ? fmtNum(subPf) : '∞') : '–';
  card.querySelector('[data-field="n"]').textContent = `${c.tp} TP · ${c.sl} SL · ${c.be} BE`;
  card.querySelector('[data-field="sub"]').textContent = `${sub.length} trades · ${STRAT_LABELS[sheet]}`;
  // Estado: "Sin trades" si no hay; "Inactiva" si el último trade es de hace más de 60 días.
  const last = sub.length ? sub.map(t => t.date).sort().pop() : null;
  const daysAgo = last ? Math.round((Date.now() - new Date(last + 'T12:00:00').getTime()) / 86400000) : null;
  const st = card.querySelector('[data-field="status"]');
  st.textContent = !sub.length ? 'Sin trades' : (daysAgo > 60 ? 'Inactiva' : 'Activa');
  card.classList.toggle('dim', !sub.length || daysAgo > 60);
}

function paintTiming(container, trades) {
  createHourBar(container.querySelector('#hourChart'), wrByHour(trades));
  createDayBar(container.querySelector('#dayChart'), wrByDay(trades));
  renderHeatmap(container.querySelector('#heatmap'), trades);
  paintDiagMini(container, trades);
}

// Mini-Diagnóstico: los 5 avisos/insights más relevantes (rojo alerta, ámbar
// aviso, verde insight), con enlace a la vista completa.
function paintDiagMini(container, trades) {
  const el = container.querySelector('#diagMini');
  if (!el) return;
  const a = buildAlerts(trades, { cuentas: state.cuentas });
  const rank = { danger: 0, warning: 1, success: 2 };
  const all = [...a.tecAlertas, ...a.emoAlertas, ...a.planAlertas, ...a.tecInsights, ...a.emoInsights, ...a.planInsights]
    .sort((x, y) => (rank[x.type] ?? 9) - (rank[y.type] ?? 9))
    .slice(0, 5);
  if (!all.length) {
    el.innerHTML = `<div class="diag-row"><span class="diag-dot success"></span><div><b>Sin alertas</b><small>Todo en regla según tu plan.</small></div></div>`;
    return;
  }
  el.innerHTML = all.map(x => `
    <div class="diag-row">
      <span class="diag-dot ${x.type}"></span>
      <div><b>${escapeHtml(x.title || '')}</b>${x.body ? `<small>${escapeHtml(x.body)}</small>` : ''}</div>
    </div>`).join('');
}

// Long vs Short compacto: WR + barra + nº trades + P&L por dirección, y una
// mini-tabla WR Long/Short por estrategia (verde ≥ 50 %, rojo si no).
function paintLongShort(container, trades) {
  const el = container.querySelector('#lsBody');
  if (!el) return;
  const wrColor = (wr, n) => !n ? 'var(--muted)' : (wr >= 50 ? 'var(--green)' : 'var(--red)');
  const dir = (label, d, realPnl) => `
    <div class="ls-dir">
      <div class="ls-dir-head"><b>${label}</b><span style="color:${wrColor(d.wr, d.n)}">${d.n ? fmtPctNoSign(d.wr) : '–'}</span></div>
      <div class="ls-bar"><div style="width:${d.n ? Math.min(100, d.wr) : 0}%;background:${wrColor(d.wr, d.n)}"></div></div>
      <div class="ls-dir-sub"><span>${d.n} trade${d.n === 1 ? '' : 's'}</span><span class="pnl-value">sist. ${fmtPct(d.pnl, 1)} · real ${fmtPct(realPnl, 1)}</span></div>
    </div>`;
  const all = longVsShort(trades);
  const realLong = pnlPctReal(trades.filter(t => t.setup === 'LONG'));
  const realShort = pnlPctReal(trades.filter(t => t.setup === 'SHORT'));
  const rows = ['ZONAS', 'LIQUIDEZ', 'NASDAQ'].map(sheet => {
    const d = longVsShort(trades.filter(t => t.sheet === sheet));
    const cell = x => `<td style="color:${wrColor(x.wr, x.n)}">${x.n ? fmtPctNoSign(x.wr) : '–'}</td>`;
    return `<tr><td><span class="strat-pill ${sheet.toLowerCase()}">${sheet.charAt(0) + sheet.slice(1).toLowerCase()}</span></td>${cell(d.long)}${cell(d.short)}</tr>`;
  }).join('');
  el.innerHTML = `
    ${dir('Long', all.long, realLong)}
    ${dir('Short', all.short, realShort)}
    <table class="data-table ls-table"><thead><tr><th>WR</th><th>Long</th><th>Short</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function paintDirectionAndPairs(container, trades) {
  paintLongShort(container, trades);

  // Pairs table — split EUR/USD by strategy when present in both ZONAS and LIQUIDEZ
  const pairKey = t => {
    let p = t.pair || '';
    if (p === 'EUR/USD' && t.sheet === 'LIQUIDEZ') return 'EUR/USD (Liquidez)';
    if (p === 'EUR/USD' && t.sheet === 'ZONAS') return 'EUR/USD (Zonas)';
    return p || '–';
  };
  const stats = statsByGroup(trades, pairKey).filter(p => p.total >= 1).sort((a, b) => b.total - a.total);
  container.querySelector('#pairsTbody').innerHTML = stats.map(p => {
    const wrColor = p.wr >= 50 ? 'var(--green)' : 'var(--red)';
    const pnlColor = p.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pnlRealColor = p.pnlReal >= 0 ? 'var(--green)' : 'var(--red)';
    const pfColor = p.pf >= 2.0 ? 'var(--green)' : p.pf >= 1.5 ? 'var(--orange)' : 'var(--red)';
    const signal = p.wr >= 50 ? '<span style="color:var(--green)">✓</span>' : '<span style="color:var(--red)">!</span>';
    return `<tr>
      <td>${escapeHtml(p.key)}</td>
      <td>${p.total}</td>
      <td style="color:${wrColor}">${p.wr.toFixed(0)}%</td>
      <td style="color:${pnlColor}">${fmtPct(p.pnl, 1)}</td>
      <td style="color:${pnlRealColor}">${fmtPct(p.pnlReal, 1)}</td>
      <td style="color:${pfColor};font-weight:500;">${isFinite(p.pf) ? p.pf.toFixed(2) : '∞'}</td>
      <td>${signal}</td>
    </tr>`;
  }).join('') + `<tr style="border-top:1px solid var(--border);">
    <td colspan="7" style="color:var(--muted);font-size:10px;font-family:var(--mono);line-height:1.8;">
      PF: <span style="color:var(--green);font-weight:600;">&gt;2.0 muy bueno</span> ·
      <span style="color:var(--orange);font-weight:600;">1.5–2.0 bueno</span> ·
      <span style="color:var(--red);font-weight:600;">&lt;1.5 mejorable</span>
    </td>
  </tr>`;
}

function paintStreaks(container, trades) {
  const groups = {
    Global: trades,
    Liquidez: trades.filter(t => t.sheet === 'LIQUIDEZ'),
    Nasdaq: trades.filter(t => t.sheet === 'NASDAQ'),
    Zonas: trades.filter(t => t.sheet === 'ZONAS'),
    'GBP/USD': trades.filter(t => t.sheet === 'ZONAS' && t.pair === 'GBP/USD'),
    'EUR/USD': trades.filter(t => t.sheet === 'ZONAS' && t.pair === 'EUR/USD'),
    ORO: trades.filter(t => t.sheet === 'ZONAS' && t.pair === 'ORO'),
    OIL: trades.filter(t => t.sheet === 'ZONAS' && t.pair === 'OIL'),
  };
  const keys = Object.keys(groups);
  const tpStreak = keys.map(k => maxStreak(groups[k], 'TP'));
  const tpStreakPct = keys.map(k => bestTpStreakPnl(groups[k]));
  const slStreak = keys.map(k => maxStreak(groups[k], 'SL'));
  const dd = keys.map(k => maxDrawdown(groups[k]));

  const rows = [
    { label: 'Racha máx TP consecutivos', vals: tpStreak.map(v => v + ' TP'), color: 'var(--green)' },
    { label: '% acumulado racha TP', vals: tpStreakPct.map(v => fmtPct(v, 1)), color: 'var(--green)' },
    { label: 'Racha máx SL consecutivos', vals: slStreak.map(v => v + ' SL'), color: 'var(--red)' },
    { label: 'DD máximo acumulado', vals: dd.map(v => (v > 0 ? '−' : '') + v.toFixed(1) + '%'), color: 'var(--red)' },
  ];
  container.querySelector('#streakTbody').innerHTML = rows.map(r => `
    <tr>
      <td style="color:var(--muted);font-family:var(--mono);font-size:11px;">${r.label}</td>
      ${r.vals.map((v, i) => `<td style="color:${r.color};font-weight:${i === 0 ? '600' : '500'};">${v}</td>`).join('')}
    </tr>
  `).join('');
}

function paintDurations(container, trades) {
  const rows = [
    ['ZONAS', durationStats(trades.filter(t => t.sheet === 'ZONAS')), 'zonas'],
    ['LIQUIDEZ', durationStats(trades.filter(t => t.sheet === 'LIQUIDEZ')), 'liquidez'],
    ['NASDAQ', durationStats(trades.filter(t => t.sheet === 'NASDAQ')), 'nasdaq'],
  ];
  const global = durationStats(trades);
  container.querySelector('#durTbody').innerHTML = rows.map(([name, d, cls]) => `
    <tr>
      <td><span class="strat-pill ${cls}">${name}</span></td>
      <td>${d.avg} min</td>
      <td style="color:var(--green)">${d.tp} min</td>
      <td style="color:var(--red)">${d.sl} min</td>
      <td>${d.max} min</td>
      <td>${d.min} min</td>
    </tr>
  `).join('') + `
    <tr style="background:var(--hover);">
      <td><strong>Global</strong></td>
      <td><strong>${global.avg} min</strong></td>
      <td style="color:var(--green)"><strong>${global.tp} min</strong></td>
      <td style="color:var(--red)"><strong>${global.sl} min</strong></td>
      <td>${global.max} min</td>
      <td>${global.min} min</td>
    </tr>
  `;
}

