// Modal para registrar un retiro de una cuenta fondeada.
//
// Campos:
//   - Fecha
//   - Importe bruto ($): lo que descuenta el broker del equity de la cuenta
//   - Comisión (%): porcentaje del bruto que se queda el broker (opcional)
//   - Saldo de la cuenta tras el retiro ($): viene relleno con lo que calcula
//     la app. Si el alumno pone otro, la diferencia se guarda como un ajuste
//     ligado al retiro y el equity queda cuadrado sin el paso manual.
//   - Nota
//
// Por qué el saldo: la app resta el retiro del equity, y eso solo cuadra si el
// beneficio retirado estaba apuntado en trades de esa cuenta. Casi nunca lo
// está del todo, y la cuenta aparecía por debajo del capital sin haber perdido.
//
// Internamente se guarda `commission` ya en $ (no en %). El % es solo input UX.

import { state } from '../state.js';
import { openModal } from './modal.js';
import { auth } from '../auth.js';
import { todayLocal } from '../utils/timezone.js';
import { accountStats, fmtUsd } from '../utils/account-stats.js';

export function openWithdrawalModal(cuenta, onSaved = () => {}) {
  if (!cuenta) return;
  if (cuenta.fase !== 'fondeada') return;

  const today = todayLocal(auth.timezone());
  const s = accountStats(cuenta, state.trades);
  const capital = cuenta.capital || 0;
  const beneficio = s.equityUsd - capital;       // lo que la app tiene apuntado por encima del capital
  const base = cuenta.equityBaseAt;              // inicio de la fase actual

  openModal({
    title: `Nuevo retiro · ${esc(cuenta.empresa)} ${esc(cuenta.numero || '')}`,
    body: `
      <div class="form" style="max-width:none;gap:14px;">
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Fecha <span class="required">*</span></label>
            <input class="form-input" type="date" id="w-date" value="${today}" max="${today}">
          </div>
          <div class="form-field">
            <label class="form-label">Importe bruto ($) <span class="required">*</span></label>
            <input class="form-input" type="number" step="0.01" min="0.01" id="w-amount" placeholder="500.00">
            <div class="w-hint">Lo que sale de la cuenta. Equity según la app: ${fmtUsd(s.equityUsd)}.</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label class="form-label">Comisión broker (%)</label>
            <input class="form-input" type="number" step="0.1" min="0" max="100" id="w-comm-pct" placeholder="10 = 10% del bruto">
            <div class="w-hint">Opcional. Lo que se queda el broker (no llega a tu bolsillo).</div>
          </div>
          <div class="form-field">
            <label class="form-label">Resumen</label>
            <div id="w-summary" class="w-summary">Introduce el importe…</div>
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">Saldo de la cuenta tras el retiro ($)</label>
          <div class="w-saldo">
            <input class="form-input" type="number" step="0.01" min="0" id="w-saldo" placeholder="${capital.toFixed(2)}">
            <button type="button" class="btn" id="w-saldo-cap" title="Tras el retiro la cuenta vuelve a su capital">Vuelve al capital</button>
            <button type="button" class="btn ghost" id="w-saldo-calc" title="Lo que calcula la app: equity menos el retiro">Lo que calcula la app</button>
          </div>
          <div class="w-hint" id="w-saldo-hint">Míralo en tu plataforma. Si no coincide con lo que calcula la app, el equity se cuadra solo.</div>
        </div>
        <div class="form-field">
          <label class="form-label">Nota</label>
          <input class="form-input" type="text" id="w-note" placeholder="Primer retiro mensual, fee retiro…">
        </div>
        <div id="w-err" class="auth-error" style="display:none;"></div>
      </div>
    `,
    actions: [
      { label: 'Cancelar', onClick: close => close() },
      {
        label: 'Registrar retiro',
        variant: 'primary',
        onClick: close => {
          const root = document.getElementById('modal-root');
          const errEl = root.querySelector('#w-err');
          const showErr = msg => { errEl.textContent = '⚠ ' + msg; errEl.style.display = 'flex'; };
          errEl.style.display = 'none';

          const date = root.querySelector('#w-date').value;
          const amount = parseFloat(root.querySelector('#w-amount').value);
          const commPctRaw = root.querySelector('#w-comm-pct').value;
          const commPct = commPctRaw === '' ? 0 : parseFloat(commPctRaw);
          const note = root.querySelector('#w-note').value.trim();
          const saldoRaw = root.querySelector('#w-saldo').value;
          const saldo = saldoRaw === '' ? null : parseFloat(saldoRaw);

          if (!date) return showErr('Falta la fecha.');
          if (!amount || amount <= 0) return showErr('El importe debe ser mayor que 0.');
          if (isNaN(commPct) || commPct < 0 || commPct > 100) return showErr('La comisión debe estar entre 0 y 100.');
          if (saldo != null && (!isFinite(saldo) || saldo < 0)) return showErr('El saldo tras el retiro no es válido.');

          const commissionUsd = +(amount * commPct / 100).toFixed(2);
          // Un retiro anterior a la fase actual no cambia el equity: no se cuadra.
          const enFase = !base || date >= base;
          const cuadre = enFase && saldo != null ? +(saldo - (s.equityUsd - amount)).toFixed(2) : 0;
          state.addWithdrawal(cuenta.id, { date, amount, commission: commissionUsd, note }, { cuadre });
          close();
          if (typeof onSaved === 'function') onSaved();
        },
      },
    ],
  });

  setTimeout(() => {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const amountInp = root.querySelector('#w-amount');
    const commInp = root.querySelector('#w-comm-pct');
    const dateInp = root.querySelector('#w-date');
    const saldoInp = root.querySelector('#w-saldo');
    const summaryEl = root.querySelector('#w-summary');
    const hintEl = root.querySelector('#w-saldo-hint');
    let saldoTocado = false;      // el alumno ha escrito el saldo: ya no se rellena solo

    function update() {
      const a = parseFloat(amountInp.value);
      const p = parseFloat(commInp.value);
      const enFase = !base || !dateInp.value || dateInp.value >= base;
      saldoInp.disabled = !enFase;
      if (!isFinite(a) || a <= 0) {
        summaryEl.textContent = 'Introduce el importe…';
        summaryEl.classList.remove('lleno');
        if (!saldoTocado) saldoInp.value = '';
        return;
      }
      const calculado = s.equityUsd - a;
      // Sin beneficio apuntado suficiente, lo normal es que la cuenta vuelva al capital.
      if (!saldoTocado && enFase) saldoInp.value = (a > beneficio + 0.5 ? capital : calculado).toFixed(2);
      const commPct = isFinite(p) && p >= 0 ? p : 0;
      const commUsd = a * commPct / 100;
      const saldo = parseFloat(saldoInp.value);
      const cuadre = enFase && isFinite(saldo) ? saldo - calculado : 0;
      summaryEl.classList.add('lleno');
      summaryEl.innerHTML = `
        <div>Comisión: <strong style="color:var(--orange);">$${commUsd.toFixed(2)}</strong></div>
        <div>Neto a tu bolsillo: <strong style="color:var(--green);">$${(a - commUsd).toFixed(2)}</strong></div>
        ${Math.abs(cuadre) >= 0.01 ? `<div>Cuadre del equity: <strong>${fmtUsd(cuadre, true)}</strong></div>` : ''}`;
      hintEl.classList.toggle('aviso', enFase && a > beneficio + 0.5);
      hintEl.textContent = !enFase
        ? 'El retiro es anterior al inicio de la fase actual: se apunta como dinero retirado, pero no cambia el equity.'
        : a > beneficio + 0.5
          ? `Retiras ${fmtUsd(a)} y en la app esta cuenta ${beneficio > 0.5 ? `solo tiene ${fmtUsd(beneficio)} de beneficio apuntado` : 'no tiene beneficio apuntado'}. Para que el equity no salga más bajo de lo real, pon aquí el saldo que ves en tu plataforma.`
          : 'Míralo en tu plataforma. Si no coincide con lo que calcula la app, el equity se cuadra solo.';
    }
    amountInp.addEventListener('input', update);
    commInp.addEventListener('input', update);
    dateInp.addEventListener('input', update);
    saldoInp.addEventListener('input', () => { saldoTocado = saldoInp.value !== ''; update(); });
    root.querySelector('#w-saldo-cap').addEventListener('click', () => { saldoTocado = true; saldoInp.value = capital.toFixed(2); update(); });
    root.querySelector('#w-saldo-calc').addEventListener('click', () => {
      const a = parseFloat(amountInp.value);
      saldoTocado = true;
      saldoInp.value = isFinite(a) && a > 0 ? Math.max(0, s.equityUsd - a).toFixed(2) : '';
      update();
    });
    amountInp.focus();
  }, 0);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
