import { state } from '../state.js';
import { renderPills } from '../components/pills.js';
import { openModal } from '../components/modal.js';
import { renderCuentaAssign } from '../components/cuenta-assign.js';
import { router } from '../router.js';
import { TODAS as SENS_OPTIONS, NEGATIVAS as SENS_NEGATIVAS } from '../utils/sensaciones.js';
import { parseTime, durationMinutes, formatDateEs } from '../utils/date-helpers.js';
import { auth } from '../auth.js';
import { todayLocal } from '../utils/timezone.js';
import { fmtPct } from '../utils/number-format-es.js';
import { fmtUsd } from '../utils/account-stats.js';
import { STRATEGIES as STRAT_META, modelLabel, errorModeloEntrada } from '../utils/strategy-config.js';
import { aplicarReglasModelo } from '../components/model-rules.js';
import { attachDictation } from '../utils/dictation.js';
import { showToast } from '../components/toast.js';

const SHEETS = ['ZONAS', 'LIQUIDEZ', 'NASDAQ'];
// R objetivo de cada estrategia: lo que rellena el atajo "TP" del resultado.
const TP_R = { ZONAS: 2, LIQUIDEZ: 3, NASDAQ: 1.5 };

// Estrategia pedida en la URL (#/nuevo?s=NASDAQ, desde "+ Nuevo trade" de Estrategias).
function sheetFromUrl() {
  const q = (window.location.hash.split('?')[1] || '');
  const s = new URLSearchParams(q).get('s');
  return SHEETS.includes(s) ? s : null;
}

export function newTradeView(container) {
  let sheet = sheetFromUrl() || 'ZONAS';
  let formData = init(sheet);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Nuevo trade</h1>
        <div class="sub">Elige la estrategia y rellena el formulario</div>
      </div>
    </div>
    <div id="stratChooser"></div>
    <div class="nt-layout">
      <div class="nt-main" id="formWrap"></div>
      <aside class="nt-side" id="sideWrap"></aside>
    </div>
  `;
  const stratC = container.querySelector('#stratChooser');
  const formWrap = container.querySelector('#formWrap');
  const sideWrap = container.querySelector('#sideWrap');

  // Selector de estrategia: pestañas grandes con el color de cada una. Son
  // botones (cambian el formulario), no enlaces de navegación.
  function paintChooser() {
    stratC.innerHTML = `
      <div class="rg-tabs gestion-tabs strat-tabs">
        ${SHEETS.map(k => {
          const meta = STRAT_META[k] || { label: k };
          const on = sheet === k;
          return `<button type="button" class="rg-tab ${on ? 'active' : ''}" data-sheet="${k}"
                    ${on && meta.color ? `style="--tab-accent:${meta.color};"` : ''}>${meta.label}</button>`;
        }).join('')}
      </div>`;
    stratC.querySelectorAll('[data-sheet]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.sheet;
      if (k === sheet) return;
      sheet = k;
      // Conservar lo que no depende de la estrategia (fechas, P&L, riesgo,
      // sensación, plan, links, reflexión, cuentas). Antes se borraba TODO el
      // formulario al cambiar de pestaña — pérdida de datos real.
      const prev = formData;
      formData = {
        ...init(sheet),
        date: prev.date, open_str: prev.open_str, close_str: prev.close_str,
        pnl_pct: prev.pnl_pct, risk_real_pct: prev.risk_real_pct,
        rr: prev.rr, pips: prev.pips,
        sensacion: prev.sensacion, plan_followed: prev.plan_followed,
        url1: prev.url1, url2: prev.url2, reflexion: prev.reflexion,
        accounts: prev.accounts,
      };
      paintChooser();
      rerender();
    }));
  }
  paintChooser();

  // Tras guardar: formulario limpio, misma estrategia (para meter el siguiente).
  function onSaved() {
    formData = init(sheet);
    rerender();
    window.scrollTo(0, 0);
  }
  function rerender() { renderForm(formWrap, sideWrap, sheet, formData, onSaved); }
  rerender();
}

function init(sheet) {
  // Fecha de hoy en el huso del usuario. Con toISOString un UTC-3 veía la fecha
  // de MAÑANA a partir de las 21:00 locales.
  const today = todayLocal(auth.timezone());
  const meta = STRAT_META[sheet];
  return {
    sheet,
    date: today,
    open_str: '',
    close_str: '',
    pair: meta.pairs.length === 1 ? meta.pairs[0] : '',
    setup: '',
    zone: [],
    // Si la estrategia tiene una sola entrada posible, autoseleccionar.
    entry: meta.entries && meta.entries.length === 1 ? [meta.entries[0]] : [],
    model: '',   // modelo de entrada (solo estrategias con meta.models)
    rr: '',
    pips: '',
    pnl_pct: '',
    risk_real_pct: '1',
    plan_followed: null,
    sensacion: '',
    url1: '',
    url2: '',
    reflexion: '',
    accounts: [],
  };
}

// Fila del formulario: etiqueta a la izquierda (170 px) y campo a la derecha.
function row(label, field, { required = false, hint = '' } = {}) {
  return `
    <div class="nt-row">
      <div class="nt-label">${label}${required ? ' <span class="required">*</span>' : ''}${hint ? `<small>${hint}</small>` : ''}</div>
      <div class="nt-field">${field}</div>
    </div>`;
}

function renderForm(wrap, side, sheet, data, onSaved) {
  const meta = STRAT_META[sheet];
  const tpR = TP_R[sheet] || 2;
  wrap.innerHTML = `
    <div class="form nt-form">
      <div class="card nt-section">
        <div class="nt-section-title">Operativa</div>
        ${meta.models ? row('Modelo de entrada', '<div data-field="model"></div>', { required: true }) : ''}
        ${!meta.pairFixed ? row('Par', '<div data-field="pair"></div>', { required: true }) : ''}
        ${row('Setup', '<div data-field="setup"></div>', { required: true })}
        ${row('Zona', '<div data-field="zone"></div>', { required: true, hint: meta.zonesMulti ? 'puedes marcar varias' : '' })}
        ${meta.showEntry ? row('Tipo de entrada', '<div data-field="entry"></div>', { required: true, hint: meta.entriesMulti ? 'puedes marcar varias' : '' }) : ''}
      </div>

      <div class="card nt-section">
        <div class="nt-section-title">Resultado y cuenta</div>
        ${row('Resultado', `<div class="pill-group nt-result" id="resultChips">
            <button type="button" class="pill" data-res="TP" data-pnl="${tpR}">TP +${tpR}%</button>
            <button type="button" class="pill" data-res="SL" data-pnl="-1">SL −1%</button>
            <button type="button" class="pill" data-res="BE" data-pnl="0">BE 0%</button>
          </div>`, { hint: 'atajo: rellena el % P&L' })}
        ${row('% P&L sistema', `<div class="nt-inline">
            <input class="form-input" type="number" step="0.01" data-input="pnl_pct" value="${data.pnl_pct}" placeholder="${tpR}.00 = TP / -1.00 = SL">
            <label class="nt-inline-label">Riesgo real (%)
              <input class="form-input" type="number" step="0.01" min="0" data-input="risk_real_pct" value="${data.risk_real_pct}" placeholder="1.00"></label>
            ${meta.showRR ? `<label class="nt-inline-label">RR
              <input class="form-input" type="number" step="0.1" data-input="rr" value="${data.rr}" placeholder="2"></label>` : ''}
            ${meta.showPip ? `<label class="nt-inline-label">${sheet === 'ZONAS' ? 'Pips SL' : 'Pip SL'}
              <input class="form-input" type="number" step="0.1" data-input="pips" value="${data.pips}" placeholder="5.0"></label>` : ''}
          </div>`, { required: true })}
        ${row('Cuentas', '<div id="cuentaAssignBox"></div>', { hint: 'opcional' })}
      </div>

      <div class="card nt-section">
        <div class="nt-section-title">Ejecución y psicología</div>
        ${row('¿Has seguido el plan?', '<div data-field="plan_followed"></div>', { required: true })}
        ${row('Sensación al ejecutar', '<div data-field="sensacion"></div>', { required: true })}
      </div>

      <div class="card nt-section">
        <div class="nt-section-title">Tiempos y notas</div>
        ${row('Fecha y hora', `<div class="nt-inline">
            <label class="nt-inline-label"><span>Fecha <span class="required">*</span></span>
              <input class="form-input" type="date" data-input="date" value="${data.date}"></label>
            <label class="nt-inline-label"><span>Hora apertura <span class="required">*</span></span>
              <input class="form-input" type="time" data-input="open_str" value="${data.open_str}"></label>
            <label class="nt-inline-label">Hora cierre
              <input class="form-input" type="time" data-input="close_str" value="${data.close_str}"></label>
          </div>`)}
        ${meta.links.map(l => row(l.label,
          `<input class="form-input" type="url" data-input="${l.key}" value="${esc(data[l.key] || '')}" placeholder="https://www.tradingview.com/x/...">`)).join('')}
        ${row('Reflexión', `<div><textarea class="form-textarea" data-input="reflexion" placeholder="Notas sobre el trade, lo que hiciste bien o mal, qué aprender...">${esc(data.reflexion)}</textarea></div>`)}
      </div>
    </div>
  `;

  side.innerHTML = `
    <div class="card nt-summary">
      <div class="nt-section-title">Resumen del trade</div>
      <div id="ntSumBody"></div>
      <div class="nt-sum-actions">
        <button class="btn primary" type="button" id="saveBtn">Guardar trade</button>
        <button class="btn" type="button" id="cancelBtn">Cancelar</button>
      </div>
    </div>`;

  // ── Resumen lateral en vivo ──────────────────────────────
  const sumBody = side.querySelector('#ntSumBody');
  const cuentaNombre = a => {
    const c = state.cuentas.find(x => x.id === a.accountId);
    return c ? `${c.empresa} ${capShort(c.capital)}` : 'Cuenta';
  };
  function update() {
    const pnl = parseFloat(data.pnl_pct);
    const hasPnl = data.pnl_pct !== '' && isFinite(pnl);
    const res = !hasPnl ? '' : (pnl > 0.2 ? 'TP' : pnl < -0.2 ? 'SL' : 'BE');
    const risk = parseFloat(data.risk_real_pct);
    const riskOk = isFinite(risk) && risk >= 0 ? risk : 1;
    const color = res === 'TP' ? 'var(--green)' : res === 'SL' ? 'var(--red)' : 'var(--muted)';
    // Atajos de resultado: se marca el que corresponde al % escrito
    wrap.querySelectorAll('#resultChips [data-res]').forEach(b => b.classList.toggle('active', b.dataset.res === res));

    const accs = Array.isArray(data.accounts) ? data.accounts : [];
    const kv = (k, v) => `<div class="nt-kv"><span>${k}</span><b>${v || '—'}</b></div>`;
    const avisos = [];
    if (SENS_NEGATIVAS.includes(data.sensacion)) avisos.push(['warn', '⚠ Sensación de riesgo: revisa tu protocolo antes del siguiente trade.']);
    if (data.plan_followed === false) avisos.push(['bad', '⚠ Fuera del plan: contará en Diagnóstico como trade fuera de plan.']);
    if (res === 'SL' && accs.length) avisos.push(['bad', `→ SL en ${esc(accs.map(cuentaNombre).join(', '))}: con SL la rotación pasa a la siguiente cuenta.`]);
    const faltan = validate(sheet, data).length;
    if (faltan) avisos.push(['info', `Faltan ${faltan} campo${faltan === 1 ? '' : 's'} obligatorio${faltan === 1 ? '' : 's'}.`]);
    if (!avisos.length) avisos.push(['ok', '✓ Todo en regla según tu plan.']);

    sumBody.innerHTML = `
      <div class="nt-sum-pnl pnl-value" style="color:${color}">${hasPnl ? fmtPct(pnl) : '—'}</div>
      <div class="nt-sum-sub">${hasPnl ? `${res} · P&L real <span class="pnl-value">${fmtPct(pnl * riskOk)}</span> con riesgo ${riskOk}%` : 'Elige el resultado o escribe el % P&L'}</div>
      <div class="nt-kvs">
        ${kv('Estrategia', meta.label)}
        ${kv('Activo', esc(data.pair))}
        ${kv('Setup', esc(data.setup))}
        ${meta.models ? kv('Modelo', data.model ? esc(modelLabel(data.model)) : '') : ''}
        ${kv('Zona', esc((data.zone || []).join(' · ')))}
        ${meta.showEntry ? kv('Entrada', esc((data.entry || []).join(' · '))) : ''}
        ${kv('Cuenta', accs.length ? esc(accs.map(cuentaNombre).join(', ')) : 'Sin asignar')}
        ${kv('Fecha', data.date ? `${formatDateEs(data.date)}${data.open_str ? ' · ' + esc(data.open_str) : ''}` : '')}
      </div>
      <div class="nt-avisos">${avisos.map(([t, m]) => `<div class="nt-aviso ${t}">${m}</div>`).join('')}</div>`;
  }

  // Pills wiring
  if (!meta.pairFixed) {
    renderPills(wrap.querySelector('[data-field="pair"]'), {
      name: 'pair', options: meta.pairs, value: data.pair, variant: meta.pairsCols ? 'cols-' + meta.pairsCols : '', rowStarts: meta.pairsRowStarts || [],
      onChange: v => { data.pair = v; update(); },
    });
  } else {
    data.pair = meta.pairs[0];
  }
  renderPills(wrap.querySelector('[data-field="setup"]'), {
    name: 'setup', options: ['LONG', 'SHORT'], value: data.setup,
    onChange: v => { data.setup = v; update(); },
  });
  const zonePills = renderPills(wrap.querySelector('[data-field="zone"]'), {
    name: 'zone', options: meta.zones, value: data.zone, variant: meta.zonesCols ? `cols-${meta.zonesCols}` : '',
    multi: !!meta.zonesMulti,
    onChange: v => { data.zone = meta.zonesMulti ? v : (v ? [v] : []); update(); },
  });
  let entryPills = null;
  if (meta.showEntry) {
    entryPills = renderPills(wrap.querySelector('[data-field="entry"]'), {
      name: 'entry', options: meta.entries, value: data.entry, variant: meta.entriesCols ? `cols-${meta.entriesCols}` : '', rowStarts: meta.entriesRowStarts || [],
      multi: !!meta.entriesMulti,
      onChange: v => { data.entry = meta.entriesMulti ? v : (v ? [v] : []); update(); },
    });
  }
  if (meta.models) {
    renderPills(wrap.querySelector('[data-field="model"]'), {
      name: 'model',
      options: meta.models,   // obligatorio: en un alta no se puede dejar sin modelo
      value: data.model || '',
      onChange: v => { data.model = v || ''; aplicarReglasModelo(meta, data, { entry: entryPills, zone: zonePills }, true); update(); },
    });
    aplicarReglasModelo(meta, data, { entry: entryPills, zone: zonePills }, false);
  }
  renderPills(wrap.querySelector('[data-field="sensacion"]'), {
    name: 'sensacion', options: SENS_OPTIONS, value: data.sensacion,
    variant: 'sens',
    onChange: v => { data.sensacion = v; update(); },
  });
  renderPills(wrap.querySelector('[data-field="plan_followed"]'), {
    name: 'plan_followed',
    options: [
      { value: 'yes', label: '✓ Sí' },
      { value: 'no',  label: '✗ No' },
    ],
    value: data.plan_followed === true ? 'yes' : data.plan_followed === false ? 'no' : '',
    onChange: v => { data.plan_followed = v === 'yes' ? true : v === 'no' ? false : null; update(); },
  });

  // Inputs
  wrap.querySelectorAll('[data-input]').forEach(el => {
    el.addEventListener('input', () => {
      const k = el.dataset.input;
      data[k] = el.value;
      update();
    });
  });
  attachDictation(wrap.querySelector('[data-input="reflexion"]'));

  // Asignación a cuentas
  const assignBox = wrap.querySelector('#cuentaAssignBox');
  let ca = null;
  // El $ de las cuentas sigue al % P&L y al riesgo (salvo los escritos a mano)
  wrap.querySelectorAll('[data-input="pnl_pct"], [data-input="risk_real_pct"]').forEach(el =>
    el.addEventListener('input', () => { if (ca) ca.recalc(); }));
  if (assignBox) {
    ca = renderCuentaAssign(assignBox, data.accounts || [], (accs) => {
      data.accounts = accs;
      update();
    }, {
      getDefaultRisk: () => {
        const n = parseFloat(data.risk_real_pct);
        return isFinite(n) && n > 0 ? n : 1;
      },
      getPnlPct: () => {
        const n = parseFloat(data.pnl_pct);
        return isFinite(n) ? n : 0;
      },
      // Futuros: el riesgo de la tabla depende del RR. Ya no se apunta, pero en
      // un TP la R conseguida (% P&L, en R) es el RR. En SL/BE no se sabe → NaN
      // y la gestión usa su mínimo (editable).
      getRR: () => { const p = parseFloat(data.pnl_pct); return p > 0.2 ? p : NaN; },
    });
  }

  // Atajos TP / SL / BE: rellenan el % P&L sistema (que se puede ajustar a mano).
  wrap.querySelectorAll('#resultChips [data-res]').forEach(b => b.addEventListener('click', () => {
    const inp = wrap.querySelector('[data-input="pnl_pct"]');
    data.pnl_pct = b.dataset.pnl;
    inp.value = b.dataset.pnl;
    if (ca) ca.recalc();
    update();
  }));

  // Actions
  side.querySelector('#cancelBtn').addEventListener('click', () => router.go('#/dashboard'));
  side.querySelector('#saveBtn').addEventListener('click', () => attemptSave(sheet, data, wrap, onSaved));
  update();
}

function attemptSave(sheet, data, wrap, onSaved) {
  const errors = validate(sheet, data);
  // Clear previous errors
  wrap.querySelectorAll('.form-error').forEach(e => e.remove());
  wrap.querySelectorAll('.error').forEach(e => e.classList.remove('error'));
  if (errors.length) {
    for (const err of errors) {
      const target = wrap.querySelector(`[data-input="${err.field}"], [data-field="${err.field}"]`);
      if (target) {
        target.classList.add('error');
        const msg = document.createElement('div');
        msg.className = 'form-error';
        msg.textContent = err.msg;
        target.parentNode.appendChild(msg);
      }
    }
    // Lleva la vista al primer error (el botón Guardar está en el lateral).
    const first = wrap.querySelector('.form-error');
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  // Build trade and show confirmation modal
  const trade = buildTrade(sheet, data);
  openModal({
    title: 'Confirmar nuevo trade',
    meta: `${sheet} · ${trade.pair} · ${trade.setup}`,
    body: confirmBody(trade),
    actions: [
      { label: 'Cancelar', onClick: close => close() },
      {
        label: 'Confirmar y guardar', variant: 'primary',
        onClick: close => {
          state.add(trade);
          // Si es un SL sobre la cuenta activa de la rotación, avanza a la siguiente.
          state.rotateAfterSL(trade);
          close();
          showToast('Trade guardado');
          // Formulario limpio con la misma estrategia, listo para el siguiente.
          if (typeof onSaved === 'function') onSaved(); else router.go('#/dashboard');
        },
      },
    ],
  });
}

function validate(sheet, data) {
  const meta = STRAT_META[sheet];
  const errs = [];
  if (!meta.pairFixed && !data.pair) errs.push({ field: 'pair', msg: 'Selecciona el par' });
  if (!data.setup) errs.push({ field: 'setup', msg: 'Selecciona LONG o SHORT' });
  if (!data.zone || !data.zone.length) errs.push({ field: 'zone', msg: 'Selecciona la zona' });
  if (meta.showEntry && (!data.entry || !data.entry.length)) errs.push({ field: 'entry', msg: 'Selecciona el tipo de entrada' });
  if (meta.models && !data.model) errs.push({ field: 'model', msg: 'Selecciona el modelo de entrada' });
  const errME = errorModeloEntrada(meta, data.model, data.entry);
  if (errME) errs.push({ field: 'entry', msg: errME });
  if (!data.date) errs.push({ field: 'date', msg: 'Fecha obligatoria' });
  if (!data.open_str) errs.push({ field: 'open_str', msg: 'Hora apertura obligatoria' });
  const pnl = parseFloat(data.pnl_pct);
  if (data.pnl_pct === '' || isNaN(pnl)) errs.push({ field: 'pnl_pct', msg: '% P&L numérico obligatorio' });
  if (!data.sensacion) errs.push({ field: 'sensacion', msg: 'Selecciona la sensación' });
  if (data.plan_followed !== true && data.plan_followed !== false) {
    errs.push({ field: 'plan_followed', msg: 'Indica si has seguido el plan (Sí o No)' });
  }
  return errs;
}

function buildTrade(sheet, data) {
  const pnl_pct = +parseFloat(data.pnl_pct).toFixed(4);
  const result = pnl_pct > 0.2 ? 'TP' : pnl_pct < -0.2 ? 'SL' : 'BE';
  const riskRawNum = parseFloat(data.risk_real_pct);
  const risk_real_pct = isFinite(riskRawNum) && riskRawNum >= 0 ? +riskRawNum.toFixed(4) : 1;
  return {
    sheet,
    date: data.date,
    pnl_pct,
    risk_real_pct,
    result,
    open_str: data.open_str,
    close_str: data.close_str,
    open_hour: parseTime(data.open_str),
    dur: durationMinutes(data.open_str, data.close_str),
    setup: data.setup,
    pair: data.pair,
    zone: Array.isArray(data.zone) ? data.zone : (data.zone ? [data.zone] : []),
    entry: Array.isArray(data.entry) ? data.entry : (data.entry ? [data.entry] : []),
    model: STRAT_META[sheet].models ? (data.model || '') : '',
    rr: data.rr ? parseFloat(data.rr) : null,
    pips: data.pips ? parseFloat(data.pips) : null,
    sensacion: data.sensacion,
    plan_followed: data.plan_followed === true || data.plan_followed === false ? data.plan_followed : null,
    url1: data.url1 || '',
    url2: data.url2 || '',
    reflexion: data.reflexion || '',
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    // Huso en el que se escribieron estas horas. Permite que el admin las
    // convierta a la suya sin tocar lo guardado.
    entry_tz: auth.timezone(),
  };
}

function confirmBody(t) {
  // Resumen de cuentas asignadas
  let cuentasLine = '';
  if (Array.isArray(t.accounts) && t.accounts.length) {
    const lines = t.accounts.map(a => {
      const c = state.cuentas.find(x => x.id === a.accountId);
      const usd = typeof a.usdPnl === 'number' ? a.usdPnl : 0;
      const usdColor = usd > 0 ? 'var(--green)' : usd < 0 ? 'var(--red)' : 'var(--muted)';
      const usdStr = `<strong style="color:${usdColor};">${fmtUsd(usd, true)}</strong>`;
      if (!c) return `${a.accountId.substring(0, 6)}… (no encontrada) · ${usdStr}`;
      return `${esc(c.empresa)} ${capShort(c.capital)}${c.numero ? ' #' + esc(c.numero) : ''} · ${usdStr}`;
    });
    cuentasLine = `<dt>Cuentas</dt><dd>${lines.join('<br>')}</dd>`;
  }
  return `
    <dl class="confirm-grid">
      <dt>Fecha</dt><dd>${formatDateEs(t.date)}</dd>
      <dt>Hora</dt><dd>${esc(t.open_str)}${t.close_str ? ' → ' + esc(t.close_str) : ''}${t.dur != null ? ` (${t.dur} min)` : ''}</dd>
      <dt>Par</dt><dd>${esc(t.pair)}</dd>
      <dt>Setup</dt><dd>${esc(t.setup)}</dd>
      ${STRAT_META[t.sheet].models ? `<dt>Modelo</dt><dd>${esc(modelLabel(t.model))}</dd>` : ''}
      <dt>Zona</dt><dd>${esc((t.zone || []).join(' · '))}</dd>
      ${t.entry && t.entry.length ? `<dt>Entrada</dt><dd>${esc(t.entry.join(' · '))}</dd>` : ''}
      ${t.rr != null ? `<dt>RR</dt><dd>${t.rr}</dd>` : ''}
      ${t.pips != null ? `<dt>Pips</dt><dd>${t.pips}</dd>` : ''}
      <dt>% P&L sistema</dt><dd><strong style="color:${t.result === 'TP' ? 'var(--green)' : t.result === 'SL' ? 'var(--red)' : 'var(--orange)'};">${fmtPct(t.pnl_pct)}</strong> · <span class="res-pill res-${t.result.toLowerCase()}">${t.result}</span></dd>
      <dt>Riesgo real</dt><dd>${fmtPct(t.risk_real_pct)}</dd>
      <dt>% P&L real</dt><dd><strong style="color:${t.result === 'TP' ? 'var(--green)' : t.result === 'SL' ? 'var(--red)' : 'var(--orange)'};">${fmtPct(t.pnl_pct * t.risk_real_pct)}</strong></dd>
      <dt>Sensación al ejecutar</dt><dd><span class="sens-pill" data-s="${esc(t.sensacion)}">${esc(t.sensacion)}</span></dd>
      ${t.plan_followed === true ? '<dt>Plan</dt><dd><span style="color:var(--green);">✓ Seguido</span></dd>' : t.plan_followed === false ? '<dt>Plan</dt><dd><span style="color:var(--red);">✗ Fuera de plan</span></dd>' : ''}
      ${cuentasLine}
      ${t.reflexion ? `<dt>Reflexión</dt><dd style="white-space:pre-wrap;">${esc(t.reflexion)}</dd>` : ''}
    </dl>
  `;
}

// La reflexión y otros campos vienen de texto libre: sin escapar, un "<"
// rompe el modal (y con datos importados es un vector de inyección).
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function capShort(c) {
  if (c >= 1000) {
    const k = c / 1000;
    return (k % 1 === 0 ? k : +k.toFixed(1)) + 'K';   // $2500 → "2.5K", no "3K"
  }
  return String(c);
}
