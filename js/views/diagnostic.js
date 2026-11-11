import { state } from '../state.js';
import { buildAlerts, buildPatrones } from '../utils/diagnostics.js';
import { sensacionStats, withSensacion, TODAS, POSITIVAS, NEGATIVAS } from '../utils/sensaciones.js';
import { fmtPct, fmtPctNoSign } from '../utils/number-format-es.js';
import { planComparisonStats } from '../utils/calculations.js';

function render(container) {
  const trades = state.trades;
  if (!trades.length) {
    container.innerHTML = `
      <div class="page-header"><div><h1>Diagnóstico</h1><div class="sub">Sin datos</div></div></div>
      <div class="empty">Aún no hay trades. Importa o registra para ver el diagnóstico.</div>
    `;
    return;
  }

  const a = buildAlerts(trades, { cuentas: state.cuentas });
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Diagnóstico</h1>
        <div class="sub">Alertas de plan, técnicas y emocionales basadas en ${trades.length} trades</div>
      </div>
    </div>

    <div class="diag-grid">
      <div class="diag-col-title">Técnico</div>
      ${box('Alertas', a.tecAlertas, 'Sin alertas técnicas activas', 'tecAlertas', 'activas')}
      ${box('Lo que va bien', a.tecInsights, 'Nada que destacar todavía', 'tecInsights')}
      <div class="diag-col-title">Emocional</div>
      ${box('Alertas', a.emoAlertas, 'Sin alertas emocionales activas', 'emoAlertas', 'activas')}
      ${box('Lo que va bien', a.emoInsights, 'Nada que destacar todavía', 'emoInsights')}
    </div>

    <div id="patrones"></div>

    <div class="section-title">Sensaciones — distribución y rendimiento</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Distribución</div>
        <div class="card-sub">Frecuencia por estado mental</div>
        <div id="sensDist"></div>
      </div>
      <div class="card">
        <div class="card-title">Rendimiento por sensación</div>
        <div class="card-sub">WR · P&L · Profit Factor</div>
        <div id="sensTable"></div>
      </div>
    </div>

    <div class="section-title">Trading Plan — Disciplina de ejecución</div>
    <div class="diag-grid diag-grid-1">
      ${box('Alertas (fuera del plan)', a.planAlertas, 'Sin alertas: disciplina al día', 'planAlertas', 'activas')}
      ${box('Indicadores positivos', a.planInsights, 'Marca el campo "plan seguido" en tus trades para activar indicadores.', 'planInsights')}
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">Rendimiento según disciplina</div>
      <div class="card-sub">Comparativa de trades dentro vs fuera del plan</div>
      <table class="data-table" style="margin-top:14px;">
        <thead><tr>
          <th></th><th>Trades</th><th>WR</th><th>TP</th><th>SL</th><th>BE</th><th>P&L</th>
        </tr></thead>
        <tbody id="planCompareTbody"></tbody>
      </table>
    </div>
  `;

  paintPatrones(container.querySelector('#patrones'), trades);
  paintSensDist(container.querySelector('#sensDist'), trades);
  paintSensTable(container.querySelector('#sensTable'), trades);
  paintPlanCompare(container.querySelector('#planCompareTbody'), trades);
}

// ── Dónde ganas y dónde pierdes ────────────────────────────
// Par, franja, día y dirección dentro de cada estrategia. Es información, no
// alarma: con poca muestra las diferencias suelen ser azar, así que cada fila
// lleva su fiabilidad y las de muestra baja van atenuadas.
let patSheet = null;
const FIAB = { alta: 'Alta', media: 'Media', baja: 'Baja' };
function paintPatrones(container, trades) {
  if (!container) return;
  const p = buildPatrones(trades);
  if (!p.estrategias.length) { container.innerHTML = ''; return; }
  if (!p.estrategias.some(e => e.sheet === patSheet)) patSheet = p.estrategias[0].sheet;
  const e = p.estrategias.find(x => x.sheet === patSheet);
  const color = v => v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--muted)';
  const tabla = g => `
    <div class="pat-grupo">
      <div class="pat-grupo-t">${g.titulo}</div>
      <table class="data-table pat-table">
        <thead><tr><th></th><th>Trades</th><th>Acierto</th><th>P&L</th><th>Por trade</th><th>Fiabilidad</th></tr></thead>
        <tbody>${g.filas.map(f => `
          <tr class="fiab-${f.fiab}">
            <td>${f.key}</td>
            <td>${f.n}</td>
            <td>${f.dec ? fmtPctNoSign(f.wr, 0) : '–'}</td>
            <td style="color:${color(f.r)};font-weight:500;">${fmtPct(f.r, 1)}</td>
            <td style="color:${color(f.rTrade)};">${fmtPct(f.rTrade, 2)}</td>
            <td><span class="pat-fiab ${f.fiab}">${FIAB[f.fiab]}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  container.innerHTML = `
    <div class="section-title">Dónde ganas y dónde pierdes</div>
    <div class="card pat-card">
      <div class="pat-head">
        <div>
          <div class="card-title">Por par, franja, día y dirección</div>
          <div class="card-sub">Es información, no una alarma: con pocas operaciones la diferencia entre un par y otro suele ser azar. Fíjate en las filas de fiabilidad alta (${p.umbrales.alta} trades o más); las de fiabilidad baja (menos de ${p.umbrales.media}) van atenuadas.</div>
        </div>
        <div class="pill-group pat-tabs">
          ${p.estrategias.map(x => `<button type="button" class="pill ${x.sheet === patSheet ? 'active' : ''}" data-pat="${x.sheet}">${x.label}</button>`).join('')}
        </div>
      </div>
      <div class="pat-total">${e.label}: <b>${e.total.n}</b> trades · <b>${e.total.dec ? fmtPctNoSign(e.total.wr, 0) : '–'}</b> de acierto · P&L sistema <b style="color:${color(e.total.r)}">${fmtPct(e.total.r, 1)}</b> · <b style="color:${color(e.total.rTrade)}">${fmtPct(e.total.rTrade, 2)}</b> por trade</div>
      <div class="pat-grid">${e.grupos.map(tabla).join('')}</div>
    </div>`;
  container.querySelectorAll('[data-pat]').forEach(b => b.addEventListener('click', () => {
    patSheet = b.dataset.pat;
    paintPatrones(container, trades);
  }));
}

function paintPlanCompare(container, trades) {
  const s = planComparisonStats(trades);
  const total = s.inPlan.total + s.outOfPlan.total;
  if (total === 0) {
    container.innerHTML = `<tr><td colspan="7" class="empty" style="padding:18px;">Marca el campo "plan seguido" en tus trades para ver la comparativa.</td></tr>`;
    return;
  }
  container.innerHTML = `
    <tr>
      <td><span style="color:var(--green);font-weight:600;">✓ Dentro del plan</span></td>
      <td>${s.inPlan.total}</td>
      <td>${s.inPlan.total ? fmtPctNoSign(s.inPlan.wr, 0) : '–'}</td>
      <td style="color:var(--green);">${s.inPlan.tp}</td>
      <td style="color:var(--red);">${s.inPlan.sl}</td>
      <td style="color:var(--orange);">${s.inPlan.be}</td>
      <td style="color:${s.inPlan.pnlSistema >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:500;">${s.inPlan.total ? fmtPct(s.inPlan.pnlSistema, 1) : '–'}</td>
    </tr>
    <tr>
      <td><span style="color:var(--red);font-weight:600;">✗ Fuera del plan</span></td>
      <td>${s.outOfPlan.total}</td>
      <td>${s.outOfPlan.total ? fmtPctNoSign(s.outOfPlan.wr, 0) : '–'}</td>
      <td style="color:var(--green);">${s.outOfPlan.tp}</td>
      <td style="color:var(--red);">${s.outOfPlan.sl}</td>
      <td style="color:var(--orange);">${s.outOfPlan.be}</td>
      <td style="color:${s.outOfPlan.pnlSistema >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:500;">${s.outOfPlan.total ? fmtPct(s.outOfPlan.pnlSistema, 1) : '–'}</td>
    </tr>
  `;
}

// Caja de alertas o insights. Las cuatro (Técnico/Emocional × Alertas/Insights)
// van en una rejilla que iguala alturas por fila: quedan cuadros iguales.
function box(title, items, emptyText, id, unidad) {
  const n = items.length;
  return `
    <div class="card diag-box">
      <div class="diag-box-head">
        <div class="card-title">${title}</div>
        ${n ? `<span class="diag-count">${n}${unidad ? ' ' + unidad : ''}</span>` : ''}
      </div>
      <div class="diag-list" id="${id}">${renderList(items, emptyText)}</div>
    </div>`;
}

// Cada alerta o insight: punto de color (rojo alerta, ámbar aviso, verde
// insight), título y sub-texto. Sin emojis: el color ya dice qué es.
function renderList(items, emptyText) {
  if (!items.length) return `<div class="diag-row diag-empty"><span class="diag-dot success"></span><div><small>${emptyText}</small></div></div>`;
  return items.map(a => `
    <div class="diag-row">
      <span class="diag-dot ${a.type}"></span>
      <div>
        <b>${a.title}</b>
        <small>${a.body}</small>
      </div>
    </div>
  `).join('');
}

function paintSensDist(container, trades) {
  const stats = sensacionStats(trades);
  const ws = withSensacion(trades);
  if (!ws.length) {
    container.innerHTML = '<div class="empty">Sin trades con sensación registrada</div>';
    return;
  }
  const total = ws.length;
  const max = Math.max(...[...stats.values()].map(d => d.total));
  container.innerHTML = TODAS.filter(s => stats.has(s)).map(s => {
    const d = stats.get(s);
    const pct = Math.round(d.total / total * 100);
    const w = Math.round(d.total / max * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="min-width:160px;"><span class="sens-pill" data-s="${s}">${s}</span></span>
        <div style="flex:1;height:8px;background:var(--card2);border-radius:4px;overflow:hidden;">
          <div style="width:${w}%;height:100%;background:${barColor(s)};border-radius:4px;"></div>
        </div>
        <span style="font-family:var(--mono);font-size:11px;color:var(--muted);min-width:60px;text-align:right;">${d.total} (${pct}%)</span>
      </div>
    `;
  }).join('');
}

function paintSensTable(container, trades) {
  const stats = sensacionStats(trades);
  if (!stats.size) {
    container.innerHTML = '<div class="empty">Sin trades con sensación registrada</div>';
    return;
  }
  container.innerHTML = `
    <table class="data-table">
      <thead><tr>
        <th>Sensación</th><th>Trades</th><th>WR</th><th>P&L</th><th>PF</th><th>TP/SL/BE</th>
      </tr></thead>
      <tbody>
        ${TODAS.filter(s => stats.has(s)).map(s => {
          const d = stats.get(s);
          const wrColor = d.wr >= 50 ? 'var(--green)' : d.wr >= 40 ? 'var(--orange)' : 'var(--red)';
          const pnlColor = d.pnl >= 0 ? 'var(--green)' : 'var(--red)';
          const pfColor = !isFinite(d.pf) ? 'var(--green)' : d.pf >= 2 ? 'var(--green)' : d.pf >= 1.5 ? 'var(--orange)' : 'var(--red)';
          return `<tr>
            <td><span class="sens-pill" data-s="${s}">${s}</span></td>
            <td>${d.total}</td>
            <td style="color:${wrColor};font-weight:500;">${fmtPctNoSign(d.wr, 0)}</td>
            <td style="color:${pnlColor};font-weight:500;">${fmtPct(d.pnl, 1)}</td>
            <td style="color:${pfColor};font-weight:500;">${isFinite(d.pf) ? d.pf.toFixed(2) : '∞'}</td>
            <td style="font-family:var(--mono);font-size:11px;">
              <span style="color:var(--green)">${d.tp}</span> /
              <span style="color:var(--red)">${d.sl}</span> /
              <span style="color:var(--orange)">${d.be}</span>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function barColor(s) {
  if (POSITIVAS.includes(s)) return 'var(--green)';
  if (NEGATIVAS.includes(s)) return 'var(--red)';
  return 'var(--orange)';
}

export function diagnosticView(container) {
  render(container);
  return state.on(() => render(container));
}
