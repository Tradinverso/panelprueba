import { sheetsVisibles, sheetLabel } from '../utils/strategy-config.js';
import { ic } from '../components/icons.js';
import { state } from '../state.js';
import { MONTHS_ES } from '../utils/date-helpers.js';
import { fmtPct } from '../utils/number-format-es.js';
import { renderTradeTable } from '../components/trade-table.js';
import { tradeRealPnl } from '../utils/calculations.js';
import { tradeUsd } from '../utils/account-stats.js';
import { openReflectionModal } from './psicologia.js';

// Qué se enseña en cada día y en cada semana: % del sistema, % real o dólares
// (solo esa cifra, en grande, y los trades). El resumen del mes enseña los tres.
// Se recuerda en este navegador.
const MODOS = [
  { value: 'sis',  label: '% Sistema' },
  { value: 'real', label: '% Real' },
  { value: 'usd',  label: 'Dólares ($)' },
];
const CLAVE_MODO = 'tradinverso_cal_modo';
let calModo = (() => {
  try { const v = localStorage.getItem(CLAVE_MODO); return MODOS.some(m => m.value === v) ? v : 'sis'; }
  catch (e) { return 'sis'; }
})();
function guardarModo(v) {
  calModo = v;
  try { localStorage.setItem(CLAVE_MODO, v); } catch (e) { /* sin almacenamiento: dura la sesión */ }
}
// Cifra principal según el modo. En $ sin ningún dato: null («—», no «$0»).
function principal(d) {
  if (calModo === 'real') return d.pnlReal;
  if (calModo === 'usd') return d.usdN ? d.usd : null;
  return d.pnl;
}
// En el calendario los dólares van redondeados: "+$243", "-$40".
function fmtUsdCal(v) {
  const r = Math.round(v);
  return `${r > 0 ? '+' : r < 0 ? '-' : ''}$${Math.abs(r).toLocaleString('en-US')}`;
}
function fmtPrincipal(v, dec) {
  if (v == null) return '—';
  return calModo === 'usd' ? fmtUsdCal(v) : fmtPct(v, dec);
}

let calYear = null, calMonth = null;
let stratFilter = 'all';
let selectedDay = null;
let selectedWeek = null;  // ISO 'YYYY-MM-DD' del lunes de la semana seleccionada

export function calendarView(container) {
  if (calYear == null) {
    const now = new Date();
    calYear = now.getFullYear();
    calMonth = now.getMonth();
  }
  render(container);
  return state.on(() => render(container));
}

function render(container) {
  const all = state.tradesVista;
  const monthTrades = all.filter(t => {
    if (stratFilter !== 'all' && t.sheet !== stratFilter) return false;
    return true;
  });
  const dayIndex = buildDayIndex(monthTrades);

  const titleText = selectedDay
    ? `Trades del ${selectedDay}`
    : selectedWeek
      ? `Trades de la semana del ${selectedWeek}`
      : 'Trades del mes';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Calendario <span>·</span> ${MONTHS_ES[calMonth]} ${calYear}</h1>
        <div class="sub">P&L diario · Círculo naranja = 5+ trades en el día (sobreoperar)</div>
      </div>
      <div class="page-actions">
        <select id="calModo" class="select" title="Qué se enseña en cada día: % del sistema, % real o dólares">
          ${MODOS.map(m => `<option value="${m.value}" ${calModo === m.value ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <select id="stratF" class="select">
          <option value="all" ${stratFilter === 'all' ? 'selected' : ''}>Todas las estrategias</option>
          ${sheetsVisibles().map(k => `<option value="${k}" ${stratFilter === k ? 'selected' : ''}>${sheetLabel(k)}</option>`).join('')}
        </select>
        <div class="cal-controls">
          <button class="cal-btn" id="prev">‹</button>
          <span class="cal-month-label">${MONTHS_ES[calMonth]} ${calYear}</span>
          <button class="cal-btn" id="next">›</button>
        </div>
      </div>
    </div>

    <div class="cal-summary" id="calSummary"></div>

    <div class="cal-wrap">
      <div class="cal-dow-row">
        <div class="cal-dow">LUN</div>
        <div class="cal-dow">MAR</div>
        <div class="cal-dow">MIÉ</div>
        <div class="cal-dow">JUE</div>
        <div class="cal-dow">VIE</div>
        <div class="cal-dow">SÁB</div>
        <div class="cal-dow">DOM</div>
        <div class="cal-dow cal-dow-sem">SEM</div>
      </div>
      <div class="cal-grid" id="calGrid"></div>
    </div>

    <div class="cal-legend" style="margin-top:12px;">
      <div class="cl-item"><div class="cl-dot" style="background:var(--green);"></div>Positivo</div>
      <div class="cl-item"><div class="cl-dot" style="background:var(--red);"></div>Negativo</div>
      <div class="cl-item"><div class="cl-dot" style="background:var(--orange);"></div>Break even</div>
      <div class="cl-item"><span class="cal-warn" style="position:static;">5</span> 5+ trades</div>
    </div>

    <div class="section-title">${titleText}</div>
    <div id="dayTrades"></div>
  `;

  container.querySelector('#prev').addEventListener('click', () => navigate(container, -1));
  container.querySelector('#next').addEventListener('click', () => navigate(container, 1));
  container.querySelector('#calModo').addEventListener('change', e => {
    guardarModo(e.target.value);
    render(container);
  });
  container.querySelector('#stratF').addEventListener('change', e => {
    stratFilter = e.target.value;
    selectedDay = null;
    selectedWeek = null;
    render(container);
  });

  paintCalendar(container, dayIndex);
}

function navigate(container, dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0) { calMonth = 11; calYear--; }
  selectedDay = null;
  selectedWeek = null;
  render(container);
}

function buildDayIndex(trades) {
  const map = {};
  const cuentas = state.cuentaMap();
  for (const t of trades) {
    if (!map[t.date]) map[t.date] = { trades: [], pnl: 0, pnlReal: 0, usd: 0, usdN: 0, count: 0, tp: 0, sl: 0, be: 0 };
    const d = map[t.date];
    d.trades.push(t);
    d.count++;
    // $: de sus cuentas o el escrito a mano. Los trades sin dato no suman.
    const u = tradeUsd(t, cuentas);
    if (u != null) { d.usd += u; d.usdN++; }
    if (t.result !== 'BE') {
      d.pnl += t.pnl_pct || 0;
      d.pnlReal += tradeRealPnl(t);
    }
    if (t.result === 'TP') d.tp++;
    else if (t.result === 'SL') d.sl++;
    else d.be++;
  }
  return map;
}

function paintCalendar(container, dayIndex) {
  const grid = container.querySelector('#calGrid');
  grid.innerHTML = '';
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();
  let mTrades = 0, mTp = 0, mSl = 0, mPnl = 0, mPnlReal = 0, mUsd = 0, mUsdN = 0;

  // Fechas que tienen reflexión diaria — para mostrar el icono 📝 en la celda
  const reflexDates = new Set(
    (state.reflections || []).filter(r => r.type === 'daily').map(r => r.period)
  );

  // Cursor sobre el lunes de la primera fila (puede caer en el mes anterior)
  const cursor = new Date(calYear, calMonth, 1);
  cursor.setDate(cursor.getDate() - firstDow);

  // Última fila a pintar: la que contiene el último día del mes
  const lastDay = new Date(calYear, calMonth, daysInMonth);
  const lastDayDow = (lastDay.getDay() + 6) % 7;
  const endOfLastRow = new Date(lastDay);
  endOfLastRow.setDate(endOfLastRow.getDate() + (6 - lastDayDow));

  while (cursor <= endOfLastRow) {
    let wTrades = 0, wTp = 0, wSl = 0, wBe = 0, wPnl = 0, wPnlReal = 0, wUsd = 0, wUsdN = 0;
    const mondayISO = isoOf(cursor);

    // 7 celdas de día (lun → dom)
    for (let i = 0; i < 7; i++) {
      const ds = isoOf(cursor);
      const dayNum = cursor.getDate();
      const inMonth = cursor.getMonth() === calMonth && cursor.getFullYear() === calYear;
      const data = dayIndex[ds];
      const isToday = inMonth && dayNum === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();

      const cell = document.createElement('div');
      let cls = 'cal-cell';
      if (!inMonth) cls += ' other';
      if (selectedWeek === mondayISO) cls += ' in-week';

      if (inMonth && data) {
        // El color sigue a la cifra grande (si en $ no hay dato, al sistema).
        const ref = principal(data) ?? data.pnl;
        cls += ' has-data ' + (ref > 0 ? 'profit' : ref < 0 ? 'loss' : 'be');
        // Solo trades del mes actual cuentan para el resumen del mes
        mTrades += data.count; mTp += data.tp; mSl += data.sl;
        mPnl += data.pnl; mPnlReal += data.pnlReal; mUsd += data.usd; mUsdN += data.usdN;
      }
      if (isToday) cls += ' cal-today';
      if (selectedDay === ds) cls += ' selected';
      cell.className = cls;

      // Acumulado de la semana — incluye días del mes vecino (la semana es la semana)
      if (data) {
        wTrades += data.count; wTp += data.tp; wSl += data.sl; wBe += data.be;
        wPnl += data.pnl; wPnlReal += data.pnlReal; wUsd += data.usd; wUsdN += data.usdN;
      }

      const hasReflex = inMonth && reflexDates.has(ds);
      const reflexBtn = hasReflex
        ? `<button class="cal-reflex-btn" data-reflex="${ds}" title="Ver reflexión del día">${ic('nota')}</button>`
        : '';

      if (inMonth && data) {
        cell.innerHTML = `
          ${reflexBtn}
          <span class="cal-num">${dayNum}</span>
          <div class="cal-body">
            <div class="cal-pnl pnl-value${calModo === 'usd' ? ' usd' : ''}">${fmtPrincipal(principal(data))}</div>
            <div class="cal-meta">${data.count} trade${data.count > 1 ? 's' : ''} · ${data.tp}T ${data.sl}S${data.be > 0 ? ' ' + data.be + 'BE' : ''}</div>
          </div>
          ${data.count >= 5 ? `<div class="cal-warn">${data.count}</div>` : ''}
        `;
        cell.addEventListener('click', () => {
          selectedDay = ds;
          selectedWeek = null;
          render(container);
        });
      } else {
        cell.innerHTML = `${reflexBtn}<span class="cal-num">${dayNum}</span>`;
      }

      const reflexBtnEl = cell.querySelector('.cal-reflex-btn');
      if (reflexBtnEl) {
        reflexBtnEl.addEventListener('click', e => {
          e.stopPropagation();
          openReflectionModal('daily', ds);
        });
      }

      grid.appendChild(cell);
      cursor.setDate(cursor.getDate() + 1);
    }

    // 8ª celda: resumen de semana
    const wWr = (wTp + wSl) > 0 ? wTp / (wTp + wSl) * 100 : 0;
    const wkCell = document.createElement('div');
    let wkCls = 'cal-week-summary';
    if (selectedWeek === mondayISO) wkCls += ' selected';
    if (wTrades === 0) wkCls += ' empty';
    wkCell.className = wkCls;
    wkCell.dataset.weekMonday = mondayISO;
    if (wTrades > 0) {
      const wrColor = wWr >= 55 ? 'var(--green)' : wWr < 45 ? 'var(--red)' : 'var(--orange)';
      const colorDe = v => v == null ? 'var(--muted)' : v > 0 ? 'var(--green)' : v < 0 ? 'var(--red)' : 'var(--orange)';
      const breakdown = `${wTp}T · ${wSl}S${wBe > 0 ? ' · ' + wBe + 'BE' : ''}`;
      // La columna de la semana enseña los tres, siempre en el mismo orden; el
      // elegido en el desplegable, más grande.
      const wUsdV = wUsdN ? wUsd : null;
      const linea = (modo, lbl, v, txt) => `<div class="cws-pnl${calModo === modo ? ' on' : ''}" style="color:${colorDe(v)};"><span class="cws-lbl">${lbl}</span><span class="pnl-value">${txt}</span></div>`;
      wkCell.innerHTML = `
        <div class="cws-top">${wTrades} tr · <span class="cws-wr" style="color:${wrColor};">${wWr.toFixed(0)}% WR</span></div>
        <div class="cws-bd">${breakdown}</div>
        ${linea('sis', 'sis', wPnl, fmtPct(wPnl, 1))}
        ${linea('real', 'rl', wPnlReal, fmtPct(wPnlReal, 1))}
        ${linea('usd', '$', wUsdV, wUsdV == null ? '—' : fmtUsdCal(wUsdV))}
      `;
    } else {
      wkCell.innerHTML = `<div class="cws-empty">–</div>`;
    }
    wkCell.addEventListener('click', () => {
      selectedWeek = selectedWeek === mondayISO ? null : mondayISO;
      selectedDay = null;
      render(container);
    });
    grid.appendChild(wkCell);
  }

  const wr = (mTp + mSl) > 0 ? mTp / (mTp + mSl) * 100 : 0;
  const sumDiv = container.querySelector('#calSummary');
  sumDiv.style.setProperty('--cs-n', 5);
  sumDiv.innerHTML = `
    <div class="cs-card">
      <div class="cs-label">Trades del mes</div>
      <div class="cs-val">${mTrades || '–'}</div>
      <div class="cs-sub">${mTrades > 0 ? `${mTp}TP · ${mSl}SL` : '–'}</div>
    </div>
    <div class="cs-card">
      <div class="cs-label">Winrate</div>
      <div class="cs-val" style="color:${wr >= 55 ? 'var(--green)' : wr < 45 ? 'var(--red)' : 'var(--orange)'};">${mTrades > 0 ? wr.toFixed(1) + '%' : '–'}</div>
      <div class="cs-sub">del mes</div>
    </div>
    <div class="cs-card">
      <div class="cs-label">P&L sistema</div>
      <div class="cs-val pnl-value" style="color:${mPnl > 0 ? 'var(--green)' : mPnl < 0 ? 'var(--red)' : 'var(--orange)'};">${mTrades > 0 ? fmtPct(mPnl) : '–'}</div>
      <div class="cs-sub">% sistema 1R</div>
    </div>
    <div class="cs-card">
      <div class="cs-label">P&L real</div>
      <div class="cs-val pnl-value" style="color:${mPnlReal > 0 ? 'var(--green)' : mPnlReal < 0 ? 'var(--red)' : 'var(--orange)'};">${mTrades > 0 ? fmtPct(mPnlReal) : '–'}</div>
      <div class="cs-sub">según riesgo real</div>
    </div>
    <div class="cs-card">
      <div class="cs-label">P&L en $</div>
      <div class="cs-val pnl-value" style="color:${!mUsdN ? 'var(--muted)' : mUsd > 0 ? 'var(--green)' : mUsd < 0 ? 'var(--red)' : 'var(--orange)'};">${mUsdN ? fmtUsdCal(mUsd) : '–'}</div>
      <div class="cs-sub">${!mUsdN ? 'sin trades con $ este mes' : mUsdN < mTrades ? `${mUsdN} de ${mTrades} trades con $` : 'cuentas y resultados a mano'}</div>
    </div>
  `;

  // Panel de trades inferior: día > semana > mes
  const tradesEl = container.querySelector('#dayTrades');
  if (selectedDay && dayIndex[selectedDay]) {
    renderTradeTable(tradesEl, dayIndex[selectedDay].trades, { canDelete: true, emptyMsg: 'Sin trades este día' });
  } else if (selectedWeek) {
    const monday = selectedWeek;
    const sunday = isoPlusDays(monday, 6);
    const weekList = state.tradesVista.filter(t =>
      t.date >= monday && t.date <= sunday &&
      (stratFilter === 'all' || t.sheet === stratFilter)
    );
    if (weekList.length) {
      renderTradeTable(tradesEl, weekList, { canDelete: true });
    } else {
      tradesEl.innerHTML = '<div class="empty">Sin trades esta semana</div>';
    }
  } else {
    const monthStr = `${calYear}-${pad(calMonth + 1)}`;
    const monthList = state.tradesVista.filter(t => t.date.startsWith(monthStr) && (stratFilter === 'all' || t.sheet === stratFilter));
    if (monthList.length) {
      renderTradeTable(tradesEl, monthList, { canDelete: true });
    } else {
      tradesEl.innerHTML = '<div class="empty">Sin trades en este mes</div>';
    }
  }
}

function pad(n) { return String(n).padStart(2, '0'); }

function isoOf(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoPlusDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoOf(dt);
}
