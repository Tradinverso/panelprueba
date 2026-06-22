// Vista "Inversión" — el negocio prop: dinero invertido en cuentas (compras /
// reintentos) vs retorno (payouts). KPIs de ROI, funding ratio y contadores,
// gráfico mensual gastos vs ganancias, y tabla por cuenta. Solo lectura sobre
// los datos ya existentes (coste/compras + retiros de cada cuenta).

import { state } from '../state.js';
import { openModal } from '../components/modal.js';
import { kpiCard } from '../components/kpi-card.js';
import { openPurchaseModal } from '../components/purchase-modal.js';
import { openWithdrawalModal } from '../components/withdrawal-modal.js';
import {
  fmtUsd, totalInvested, investmentStats, monthlyInvested,
  totalWithdrawn, totalWithdrawnNet, portfolioMonthlyWithdrawals,
} from '../utils/account-stats.js';
import { MONTHS_ES_SHORT } from '../utils/date-helpers.js';

const STATUS_LABEL = { activa: 'Activa', pausada: 'Pausada', pasada: 'Pasada', perdida: 'Quemada' };

const fmtRoi = v => !isFinite(v) ? '∞' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

function render(container) {
  const cuentas = state.cuentas;
  const s = investmentStats(cuentas);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Inversión</h1>
        <div class="sub">Negocio prop · inversión y retorno</div>
      </div>
      <div class="page-actions">
        <button class="btn" id="invRetiro">+ Retiro</button>
        <button class="btn primary" id="invCompra">+ Compra</button>
      </div>
    </div>

    ${cuentas.length === 0 ? emptyState() : `
      <div class="kpi-grid">
        ${kpiCard({ label: 'Gastos totales', value: '-' + fmtUsd(s.gastosTotales), sub: `${s.evaluaciones} compra${s.evaluaciones !== 1 ? 's' : ''}`, tone: 'red' })}
        ${kpiCard({ label: 'Ganancias (payouts)', value: fmtUsd(s.gananciasBrutas), sub: s.comisiones > 0 ? fmtUsd(s.comisiones) + ' en comisiones' : 'retiros brutos', tone: 'green' })}
        ${kpiCard({ label: 'Beneficio neto', value: fmtUsd(s.beneficioNeto, true), sub: 'payouts netos − gastos', tone: s.beneficioNeto >= 0 ? 'green' : 'red' })}
        ${kpiCard({ label: 'ROI', value: fmtRoi(s.roi), sub: 'beneficio ÷ gastos', tone: s.roi >= 0 ? 'green' : 'red' })}
        ${kpiCard({ label: 'Funding ratio', value: s.fundingRatio.toFixed(1) + '%', sub: `${s.fondeadas} fondeada${s.fondeadas !== 1 ? 's' : ''} de ${s.evaluaciones}`, tone: 'blue' })}
        ${kpiCard({ label: 'Cuentas', value: `${s.live} live`, sub: `${s.pasadas} pasadas · ${s.quemadas} quemadas`, tone: 'purple' })}
      </div>

      <div class="section-title">Capital invertido vs retornado</div>
      <div class="card" style="margin-bottom:24px;">
        <div class="card-title">Gastos vs ganancias por mes</div>
        <div class="card-sub">Compras (rojo) y payouts cobrados (verde)</div>
        <div class="chart-wrap" style="height:240px;"><canvas id="invChart"></canvas></div>
      </div>

      <div class="section-title">Detalle por cuenta</div>
      <div class="card" style="padding:0;overflow:hidden;">
        <table class="data-table inv-table">
          <thead><tr>
            <th>Cuenta</th><th>Estado</th><th>Invertido</th><th>Payouts</th><th>Neto</th><th>Beneficio</th><th>ROI</th>
          </tr></thead>
          <tbody>${rows(cuentas)}</tbody>
        </table>
      </div>
    `}
  `;

  container.querySelector('#invCompra').addEventListener('click', () => openPurchaseModal(null));
  container.querySelector('#invRetiro').addEventListener('click', () => openRetiroChooser());

  if (cuentas.length) paintChart(container, cuentas);
}

function rows(cuentas) {
  const sorted = [...cuentas].sort((a, b) => (totalWithdrawnNet(b) - totalInvested(b)) - (totalWithdrawnNet(a) - totalInvested(a)));
  return sorted.map(c => {
    const inv = totalInvested(c);
    const bruto = totalWithdrawn(c);
    const neto = totalWithdrawnNet(c);
    const ben = neto - inv;
    const roi = inv > 0 ? (ben / inv) * 100 : (ben > 0 ? Infinity : 0);
    return `
      <tr>
        <td><div style="font-weight:600;">${esc(c.empresa)} ${esc(c.numero || '')}</div><span style="font-size:10px;color:var(--muted);font-family:var(--mono);">${esc(c.tipo)}</span></td>
        <td><span class="badge st-${c.status}">${STATUS_LABEL[c.status] || c.status}</span></td>
        <td class="mono">${fmtUsd(inv)}</td>
        <td class="mono">${fmtUsd(bruto)}</td>
        <td class="mono">${fmtUsd(neto)}</td>
        <td class="mono" style="color:${ben >= 0 ? 'var(--green)' : 'var(--red)'};font-weight:600;">${fmtUsd(ben, true)}</td>
        <td class="mono" style="color:${roi >= 0 ? 'var(--green)' : 'var(--red)'};">${fmtRoi(roi)}</td>
      </tr>`;
  }).join('');
}

function openRetiroChooser() {
  const fondeadas = state.cuentas.filter(c => c.fase === 'fondeada');
  if (!fondeadas.length) {
    openModal({ title: 'Sin cuentas fondeadas', body: 'Los retiros solo se registran en cuentas fondeadas. Marca una cuenta como Fondeada primero.', actions: [{ label: 'Entendido', variant: 'primary', onClick: c => c() }] });
    return;
  }
  if (fondeadas.length === 1) { openWithdrawalModal(fondeadas[0]); return; }
  openModal({
    title: 'Registrar retiro',
    body: `
      <div class="form" style="max-width:none;">
        <div class="form-field">
          <label class="form-label">Cuenta fondeada</label>
          <select class="form-input" id="rt-cuenta">
            ${fondeadas.map(c => `<option value="${esc(c.id)}">${esc(c.empresa)} ${esc(c.numero || '')}</option>`).join('')}
          </select>
        </div>
      </div>`,
    actions: [
      { label: 'Cancelar', onClick: c => c() },
      { label: 'Continuar', variant: 'primary', onClick: close => {
        const id = document.getElementById('modal-root').querySelector('#rt-cuenta').value;
        const cuenta = fondeadas.find(x => x.id === id);
        close();
        if (cuenta) openWithdrawalModal(cuenta);
      } },
    ],
  });
}

function paintChart(container, cuentas) {
  const canvas = container.querySelector('#invChart');
  if (!canvas) return;
  const gastos = monthlyInvested(cuentas);
  const ganancias = portfolioMonthlyWithdrawals(cuentas);
  const months = [...new Set([...gastos.map(g => g.month), ...ganancias.map(g => g.month)])].sort();
  if (!months.length) return;
  const gMap = Object.fromEntries(gastos.map(g => [g.month, g.usd]));
  const wMap = Object.fromEntries(ganancias.map(g => [g.month, g.usd]));
  const labels = months.map(m => MONTHS_ES_SHORT[+m.split('-')[1] - 1] + ' ' + m.substring(2, 4));

  const READ = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim();
  Chart.getChart(canvas)?.destroy();
  new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Gastos', data: months.map(m => +(gMap[m] || 0).toFixed(2)), backgroundColor: READ('--red'), borderRadius: 8, borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.85 },
        { label: 'Ganancias', data: months.map(m => +(wMap[m] || 0).toFixed(2)), backgroundColor: READ('--green'), borderRadius: 8, borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.85 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 16, usePointStyle: true, font: { family: "'Inter', sans-serif", size: 11 } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { ticks: { callback: v => '$' + v.toLocaleString('en-US') }, grid: { color: READ('--border') }, border: { display: false } },
      },
    },
  });
}

function emptyState() {
  return `
    <div class="empty">
      <div class="big">💰</div>
      <div>Aún no hay cuentas que analizar.</div>
      <div style="margin-top:8px;font-size:11px;color:var(--muted);">Crea cuentas en <a href="#/cuentas">Cuentas</a> y registra lo que pagaste por cada una para ver tu ROI.</div>
    </div>`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function inversionView(container) {
  render(container);
  return state.on(() => render(container));
}
