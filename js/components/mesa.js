// "Mesa": columna izquierda sticky (260 px) con lo que hay que tener a mano
// mientras se opera: fecha/hora en el huso del alumno, cuentas activas con su
// progreso y la regla del día. Se recoge en una barrita de 58 px con
// indicadores (mini-pastilla por cuenta, anillo del checklist).
// El estado abierto/recogido se guarda en las preferencias (appearance.mesa).
// Sustituye a la barra lateral de navegación: la navegación va arriba (topbar.js).

import { state } from '../state.js';
import { auth } from '../auth.js';
import { appearance } from '../appearance.js';
import { accountStats, fmtUsd } from '../utils/account-stats.js';
import { reglaDelDia } from '../utils/reglas-del-dia.js';
import { checklistProgress } from '../utils/checklist-items.js';
import { todayLocal } from '../utils/timezone.js';
import { openChecklistModal } from './checklist-modal.js';
import { clockParts } from './topbar.js';

const SHEET_SHORT = { ZONAS: 'Zonas', LIQUIDEZ: 'Liquidez', NASDAQ: 'Nasdaq' };

let unsubAuth = null;
let unsubState = null;

// "Lucid 25K", "E2T 50K"
function shortName(c) {
  const cap = c.capital >= 1000 ? Math.round(c.capital / 1000) + 'K' : String(c.capital || '');
  return `${c.empresa || 'Cuenta'} ${cap}`.trim();
}
// "LUC", "E2T"
function abbr(c) {
  const s = String(c.empresa || 'CTA').replace(/[^A-Za-z0-9]/g, '');
  return (s.slice(0, 3) || 'CTA').toUpperCase();
}

// SL de HOY en esta cuenta (regla del plan: 1 SL por cuenta y día).
function slToday(c, trades, today) {
  let n = 0;
  for (const t of trades) {
    if (t.date !== today || t.result !== 'SL') continue;
    if (Array.isArray(t.accounts) && t.accounts.some(a => a.accountId === c.id)) n++;
  }
  return n;
}

// Estrategias que opera la cuenta (según los trades asignados).
function stratsOf(c, trades) {
  const set = new Set();
  for (const t of trades) {
    if (Array.isArray(t.accounts) && t.accounts.some(a => a.accountId === c.id) && SHEET_SHORT[t.sheet]) set.add(SHEET_SHORT[t.sheet]);
  }
  return [...set].join(' · ') || (c.tipo === 'Futuros' ? 'Futuros' : 'CFD');
}

function accountsData() {
  const trades = state.trades || [];
  const today = todayLocal(auth.timezone());
  return (state.cuentas || [])
    .filter(c => c.status === 'activa')
    .map(c => {
      const s = accountStats(c, trades);
      const objPct = c.targetPct > 0 ? c.targetPct : 0;
      const objUsd = objPct > 0 ? c.capital * objPct / 100 : (c.targetUsd || 0);
      const progress = objUsd > 0 ? Math.max(0, Math.min(100, s.profitTotalUsd / objUsd * 100)) : null;
      return {
        c, s, progress,
        name: shortName(c), abbr: abbr(c),
        pct: s.equityPct, balance: s.equityUsd,
        sl: slToday(c, trades, today),
        strats: stratsOf(c, trades),
      };
    });
}

function fmtPct(v) {
  const sign = v > 0 ? '+' : (v < 0 ? '−' : '');
  return `${sign}${Math.abs(v).toFixed(1)}%`;
}

export function renderMesa(container) {
  if (!container) return;
  if (!unsubAuth)  unsubAuth  = auth.on(() => renderMesa(container));
  if (!unsubState) unsubState = state.on(() => renderMesa(container));

  const open = appearance.get().mesa;
  document.body.classList.toggle('mesa-closed', !open);

  if (!auth.currentUser) { container.innerHTML = ''; return; }

  const accs = accountsData();
  const regla = reglaDelDia();
  const chk = checklistProgress();
  const clock = clockParts();
  const colorOf = v => v > 0 ? 'var(--green)' : (v < 0 ? 'var(--red)' : 'var(--muted)');

  if (open) {
    container.innerHTML = `
      <div class="mesa-head">
        <span class="mesa-title">Mesa · ${clock.ddmm}</span>
        <button type="button" class="mesa-toggle" id="mesaToggle" aria-label="Recoger Mesa">‹ Recoger</button>
      </div>
      <section class="card mesa-card">
        <div class="mesa-block">
          <div class="mesa-block-head"><h2>Cuentas</h2><a href="#/cuentas" class="mesa-link">${accs.length} activa${accs.length === 1 ? '' : 's'} →</a></div>
          ${accs.length ? accs.map(a => `
            <div class="mesa-acc" title="${escapeHtml(a.name)} · ${fmtPct(a.pct)} · SL hoy ${a.sl}/1">
              <div class="mesa-acc-row">
                <span class="mesa-acc-name"><span class="mesa-dot ${a.sl > 0 ? 'bad' : 'ok'}" title="SL hoy ${a.sl}/1"></span>${escapeHtml(a.name)}</span>
                <span class="mesa-acc-pct pnl-value" style="color:${colorOf(a.pct)}">${fmtPct(a.pct)}</span>
              </div>
              ${a.progress != null ? `<div class="mesa-bar" title="Progreso hacia el objetivo de la fase: ${a.progress.toFixed(0)}%"><div style="width:${a.progress}%"></div></div>` : ''}
              <div class="mesa-acc-row sub"><span>${escapeHtml(a.strats)}</span><span class="pnl-value">${fmtUsd(a.balance)}</span></div>
            </div>`).join('')
          : `<div class="mesa-empty">Sin cuentas activas. <a href="#/cuentas">Añade una →</a></div>`}
        </div>
        <div class="mesa-sep"></div>
        <div class="mesa-block">
          <div class="mesa-block-head"><div class="mesa-label">Regla del día</div><span class="mesa-muted">${regla.num}/${regla.total}</span></div>
          <div class="mesa-rule">${escapeHtml(regla.main)}</div>
          <div class="mesa-rule-sub">${escapeHtml(regla.sub)}</div>
        </div>
      </section>
    `;
  } else {
    const deg = chk.total ? chk.done / chk.total * 360 : 0;
    container.innerHTML = `
      <div class="card mesa-rail" aria-label="Mesa recogida">
        <button type="button" class="mesa-rail-open" id="mesaToggle" aria-label="Abrir Mesa">›</button>
        <span class="mesa-rail-title">Mesa</span>
        ${accs.map(a => `
          <div class="mesa-pill" title="${escapeHtml(a.name)} · ${fmtPct(a.pct)} · SL hoy ${a.sl}/1">
            <span class="mesa-pill-abbr">${escapeHtml(a.abbr)}</span>
            <span class="mesa-pill-bar" style="background:${colorOf(a.pct)}"></span>
            <span class="mesa-pill-sl">${a.sl}/1</span>
          </div>`).join('')}
        <span class="mesa-sep"></span>
        <button type="button" class="mesa-ring" id="mesaChecklist" title="Checklist pre-sesión · ${chk.done}/${chk.total}" style="background:conic-gradient(${chk.done === chk.total ? 'var(--green)' : 'var(--accent)'} ${deg}deg, var(--line) ${deg}deg 360deg)"><span>${chk.done}/${chk.total}</span></button>
      </div>
    `;
    const ring = container.querySelector('#mesaChecklist');
    if (ring) ring.addEventListener('click', () => openChecklistModal(() => renderMesa(container)));
  }

  container.querySelector('#mesaToggle').addEventListener('click', () => {
    appearance.set({ mesa: !open });
    renderMesa(container);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
