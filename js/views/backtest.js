// Sección BACKTESTING — histórico de operaciones backtesteadas por estrategia,
// SEPARADO del journal real (state.backtests / users/{uid}/backtests).
// Un ítem en el menú, las 3 estrategias como pestañas; cada una con sus KPIs,
// gráficos y tabla, y su botón "+ Nuevo trade" (una operación backtesteada).
// Sin sensaciones, plan, riesgo real ni cuentas — y sin alimentar diagnóstico,
// dashboard, calendario ni rotación.

import { state } from '../state.js';
import {
  tradeCounts, winrate, pnlPct, profitFactor, maxDrawdown, maxStreak,
  equityCurve, monthlyPnl, wrByHour, wrByDay, longVsShort, statsByGroup,
  durationStats, avgRR, expectancy, currentSlStreak,
} from '../utils/calculations.js';
import { fmtPct, fmtPctNoSign, fmtNum } from '../utils/number-format-es.js';
import { MONTHS_ES_SHORT } from '../utils/date-helpers.js';
import { STRATEGIES } from '../utils/strategy-config.js';
import { kpiCard } from '../components/kpi-card.js';
import { createEquity, createDonut, createBar, createHourBar, createDayBar, createLongShort } from '../components/charts.js';
import { renderHeatmap } from '../components/heatmap.js';
import { renderTradeTable } from '../components/trade-table.js';
import { backtestTabs } from '../components/backtest-tabs.js';
import { openBacktestFormModal } from '../components/backtest-form-modal.js';
import { openViewTradeModal } from '../components/trade-view-modal.js';

export function backtestView(container, sheet) {
  render(container, sheet);
  const unsub = state.on(() => render(container, sheet));
  return unsub;
}

function render(container, sheet) {
  const meta = STRATEGIES[sheet];
  const all = state.backtests.filter(t => t.sheet === sheet);
  const c = tradeCounts(all);
  const decisive = c.tp + c.sl;

  if (!all.length) {
    container.innerHTML = `
      ${backtestTabs(sheet)}
      <div class="page-header">
        <div>
          <h1>Backtesting <span>·</span> ${meta.label}</h1>
          <div class="sub">Histórico de backtests · separado de tu journal real</div>
        </div>
        <div class="page-actions">
          <button class="btn primary" id="btNewBtn">+ Nuevo trade</button>
        </div>
      </div>
      <div class="empty">
        <div class="big">🧪</div>
        <div>Aún no hay backtests de ${meta.label}. Registra aquí tus operaciones backtesteadas<br>para validar la operativa con datos — sin mezclarlas con tu cuenta real.</div>
      </div>`;
    wire(container, sheet);
    return;
  }

  const wr = winrate(all);
  const pnl = pnlPct(all);
  const pf = profitFactor(all);
  const dd = maxDrawdown(all);
  const rr = avgRR(all);
  const exp = expectancy(all);
  const tpStreak = maxStreak(all, 'TP');
  const slStreakMax = maxStreak(all, 'SL');

  container.innerHTML = `
    ${backtestTabs(sheet)}
    <div class="page-header">
      <div>
        <h1>Backtesting <span>·</span> ${meta.label}</h1>
        <div class="sub">${all.length} backtests · separado de tu journal real</div>
      </div>
      <div class="page-actions">
        <button class="btn primary" id="btNewBtn">+ Nuevo trade</button>
      </div>
    </div>

    <div class="kpi-grid">
      ${kpiCard({ label: 'Backtests', value: all.length, sub: `${c.tp} TP · ${c.sl} SL · ${c.be} BE`, tone: 'blue' })}
      ${kpiCard({ label: 'Winrate', value: decisive ? wr.toFixed(1) + '%' : '–', sub: 'TP / (TP+SL)', tone: decisive > 0 && wr < 40 ? 'red' : 'blue' })}
      ${kpiCard({ label: 'P&L acumulado', value: fmtPct(pnl, 1), sub: 'trades al 1%', tone: pnl >= 0 ? 'green' : 'red' })}
      ${kpiCard({ label: 'Profit factor', value: decisive ? (isFinite(pf) ? fmtNum(pf) : '∞') : '–', sub: 'bruto ganado / bruto perdido', tone: !decisive ? 'blue' : pf >= 2 ? 'green' : pf >= 1.5 ? 'orange' : 'red' })}
      ${kpiCard({ label: 'Esperanza / trade', value: decisive ? fmtPct(exp.value, 2) : '–', sub: decisive ? `media TP ${fmtPct(exp.avgWin, 1)} · media SL −${fmtPctNoSign(exp.avgLoss)}` : 'sin trades decisivos', tone: exp.value >= 0 ? 'green' : 'red' })}
      ${kpiCard({ label: 'RR medio', value: rr > 0 ? fmtNum(rr) : '–', sub: rr > 0 ? 'riesgo : beneficio medio' : 'sin RR registrado', tone: 'blue' })}
      ${kpiCard({ label: 'DD máximo', value: (dd > 0 ? '−' : '') + dd.toFixed(1) + '%', sub: 'sobre la curva acumulada', tone: 'red' })}
      ${kpiCard({ label: 'Rachas máx', value: `${tpStreak} TP`, sub: `${slStreakMax} SL seguidos · racha actual ${currentSlStreak(all)} SL`, tone: 'purple' })}
    </div>

    <div class="section-title">Rendimiento</div>
    <div class="grid-2-1">
      <div class="card">
        <div class="card-title">Curva de equity (P&L acumulado)</div>
        <div class="card-sub">Sistema 1R normalizado</div>
        <div class="chart-wrap" style="height:280px;"><canvas id="btEquity"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">P&L mensual</div>
        <div class="chart-wrap" style="height:280px;"><canvas id="btMonthly"></canvas></div>
      </div>
    </div>

    <div class="section-title">Desglose</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Distribución TP / SL / BE</div>
        <div class="chart-wrap" style="height:180px;"><canvas id="btDonut"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Long vs Short</div>
        <div class="card-sub">Winrate según dirección</div>
        <div class="chart-wrap" style="height:180px;"><canvas id="btLs"></canvas></div>
      </div>
    </div>

    ${meta.pairs.length > 1 ? `
    <div class="card table-card" style="margin-bottom:24px;">
      <div class="card-title">Por par</div>
      <table class="data-table"><thead><tr>
        <th>Par</th><th>Trades</th><th>WR</th><th>P&L</th><th>PF</th>
      </tr></thead><tbody id="btPairs"></tbody></table>
    </div>` : ''}

    <div class="grid-2">
      <div class="card table-card">
        <div class="card-title">Por zona</div>
        <table class="data-table"><thead><tr>
          <th>Zona</th><th>Trades</th><th>WR</th><th>P&L</th><th>PF</th>
        </tr></thead><tbody id="btZones"></tbody></table>
      </div>
      <div class="card table-card">
        <div class="card-title">Por entrada</div>
        <table class="data-table"><thead><tr>
          <th>Entrada</th><th>Trades</th><th>WR</th><th>P&L</th><th>PF</th>
        </tr></thead><tbody id="btEntries"></tbody></table>
      </div>
    </div>

    <div class="section-title">Timing</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Winrate por franja horaria</div>
        <div class="card-sub">Hora de apertura · Línea = nº trades</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="btHour"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Winrate por día de semana</div>
        <div class="chart-wrap" style="height:200px;"><canvas id="btDay"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">WR por día y hora</div>
      <div class="card-sub">Verde = WR alto · Rojo = WR bajo · Gris = sin trades</div>
      <div id="btHeatmap" style="margin-top:14px;"></div>
    </div>

    <div class="section-title">Duración</div>
    <div class="card table-card" style="margin-bottom:24px;">
      <table class="data-table"><thead><tr>
        <th>Media</th><th>Media TP</th><th>Media SL</th><th>Máxima</th><th>Mínima</th>
      </tr></thead><tbody id="btDur"></tbody></table>
    </div>

    <div class="section-title">Backtests (${all.length})</div>
    <div id="btTable"></div>
  `;

  wire(container, sheet);

  // Tablas HTML (síncronas)
  paintGroupTable(container.querySelector('#btPairs'), statsByGroup(all, t => t.pair || '–'));
  paintGroupTable(container.querySelector('#btZones'), statsByGroup(all, t => (Array.isArray(t.zone) ? t.zone[0] : t.zone) || '–'));
  paintGroupTable(container.querySelector('#btEntries'), statsByGroup(all, t => (Array.isArray(t.entry) ? t.entry[0] : t.entry) || '–'));
  const d = durationStats(all);
  const durEl = container.querySelector('#btDur');
  if (durEl) durEl.innerHTML = `<tr>
    <td>${d.avg} min</td>
    <td style="color:var(--green)">${d.tp} min</td>
    <td style="color:var(--red)">${d.sl} min</td>
    <td>${d.max} min</td><td>${d.min} min</td>
  </tr>`;

  // Tabla de backtests: variante sin Sens./Plan/Cuentas/% real, con acciones
  // redirigidas al almacén de backtests (¡nunca al journal!).
  renderTradeTable(container.querySelector('#btTable'), all, {
    canDelete: true,
    variant: 'backtest',
    emptyMsg: 'Sin backtests.',
    // Ver en modo backtest: sin filas del journal, y Editar abre el formulario
    // de backtest (jamás el editor del journal real).
    onView: t => openViewTradeModal(t, { variant: 'backtest', onEdit: bt => openBacktestFormModal(sheet, bt, null) }),
    onDelete: id => state.removeBacktest(id),
  });

  // Charts en el siguiente frame (layout listo) para evitar lienzos en blanco
  requestAnimationFrame(() => {
    if (!container.querySelector('#btEquity')) return;   // la vista cambió
    createEquity(container.querySelector('#btEquity'),
      [{ key: sheet, label: meta.label, data: equityCurve(all) }]);
    const m = monthlyPnl(all);
    createBar(container.querySelector('#btMonthly'),
      m.map(x => MONTHS_ES_SHORT[+x.month.split('-')[1] - 1] + ' ' + x.month.substring(2, 4)),
      m.map(x => +x.pnl.toFixed(2)));
    createDonut(container.querySelector('#btDonut'), c.tp, c.sl, c.be);
    createLongShort(container.querySelector('#btLs'), [{ label: meta.label, ...longVsShort(all) }]);
    createHourBar(container.querySelector('#btHour'), wrByHour(all));
    createDayBar(container.querySelector('#btDay'), wrByDay(all));
    renderHeatmap(container.querySelector('#btHeatmap'), all);
  });
}

function wire(container, sheet) {
  const btn = container.querySelector('#btNewBtn');
  if (btn) btn.addEventListener('click', () => openBacktestFormModal(sheet, null, null));
}

function paintGroupTable(tbody, groups) {
  if (!tbody) return;
  const rows = groups.filter(g => g.total >= 1).sort((a, b) => b.total - a.total);
  tbody.innerHTML = rows.length ? rows.map(g => {
    const wrColor = g.wr >= 50 ? 'var(--green)' : 'var(--red)';
    const pnlColor = g.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    const pfColor = g.pf >= 2 ? 'var(--green)' : g.pf >= 1.5 ? 'var(--orange)' : 'var(--red)';
    return `<tr>
      <td>${esc(g.key)}</td>
      <td>${g.total}</td>
      <td style="color:${wrColor}">${g.wr.toFixed(0)}%</td>
      <td style="color:${pnlColor}">${fmtPct(g.pnl, 1)}</td>
      <td style="color:${pfColor};font-weight:500;">${isFinite(g.pf) ? g.pf.toFixed(2) : '∞'}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="5" class="empty">Sin datos</td></tr>';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
