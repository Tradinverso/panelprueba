// Riesgo / Rotación — sección FUTUROS.
//
// Distinta de la de CFD (riesgo.js): aquí no hay niveles ni multiplicadores.
// Cada cuenta tiene una gestión de riesgo fijo en $ (utils/futures-risk.js) y
// la rotación va por UNIDADES: grupos de copiado o cuentas sueltas.
//
// Pestañas:
//   · Rotación  → unidad activa, lo que toca arriesgar en cada cuenta, y todas
//                 las cuentas agrupadas por unidad.
//   · Gestionar → orden de rotación, y por cuenta: gestión, grupo, en rotación.
//   · Gestiones → la tabla de la academia, como referencia.

import { state } from '../state.js';
import { openModal } from '../components/modal.js';
import { accountStats, fmtUsd } from '../utils/account-stats.js';
import {
  GESTIONES_FUTUROS, gestionesDeFase, gestionEfectiva, faseGestion, riesgoTexto,
  unidadesRotacion, unidadActiva, unidadNombre, BASE_CAPITAL, usdEs,
} from '../utils/futures-risk.js';

let futTab = 'rotacion';   // rotacion | gestionar | gestiones

const FASE = {
  challenge_1: { short: '1F', cls: 'g1', label: '1ª Fase' },
  challenge_2: { short: '2F', cls: 'g2', label: '2ª Fase' },
  fondeada:    { short: '★',  cls: 'gf', label: 'Fondeada' },
};

// Todas las cuentas de futuros activas (también las que están fuera de la rotación).
export function cuentasFuturos() {
  return state.cuentas
    .filter(c => c.status === 'activa' && c.tipo === 'Futuros')
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function units() {
  return unidadesRotacion(state.cuentas, state.config.futRotacionOrden || []);
}

function gruposExistentes() {
  return [...new Set(cuentasFuturos().map(c => c.grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

const pf = n => (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';

// ── Render ───────────────────────────────────────────────────
export function renderFuturos(el, rerender) {
  const cuentas = cuentasFuturos();
  if (!cuentas.length) {
    el.innerHTML = `<div class="empty">No tienes cuentas de <b>Futuros</b> activas.<br>
      <span style="font-size:11px;color:var(--muted);">Al crear o editar una cuenta en <a href="#/cuentas">Cuentas</a>, elige el tipo <b>Futuros</b>.</span></div>`;
    return;
  }
  el.innerHTML = `
    <div class="rg-tabs">
      ${tab('rotacion', 'Rotación')}
      ${tab('gestionar', 'Gestionar')}
      ${tab('gestiones', 'Gestiones')}
    </div>
    <div id="futPanel"></div>`;
  el.querySelectorAll('[data-fut-tab]').forEach(b =>
    b.addEventListener('click', () => { futTab = b.dataset.futTab; rerender(); }));

  const panel = el.querySelector('#futPanel');
  if (futTab === 'gestionar') { panel.innerHTML = gestionarHtml(); wireGestionar(panel); }
  else if (futTab === 'gestiones') { panel.innerHTML = gestionesHtml(); }
  else { panel.innerHTML = rotacionHtml(); wireRotacion(panel); }
}

function tab(id, label) {
  return `<button class="rg-tab ${futTab === id ? 'active' : ''}" data-fut-tab="${id}">${label}</button>`;
}

// ── Pestaña Rotación ─────────────────────────────────────────
function rotacionHtml() {
  const us = units();
  const act = unidadActiva(us, state.config.futRotacionActiva);
  let banner = '';
  if (act) {
    const idx = us.indexOf(act);
    const seq = Array.from({ length: Math.min(us.length, 4) }, (_, i) => us[(idx + i) % us.length]);
    banner = `
      <div class="rg-banner">
        <div>
          <div class="rg-banner-label">${act.grupo ? 'Grupo activo' : 'Cuenta activa'}</div>
          <div class="rg-banner-name">${esc(unidadNombre(act))}</div>
          <div class="rg-banner-meta">${act.cuentas.length} cuenta${act.cuentas.length !== 1 ? 's' : ''}${us.length > 1 ? ` · con SL pasa a <b>${esc(unidadNombre(us[(idx + 1) % us.length]))}</b>` : ''}</div>
        </div>
        <div class="rg-seq">
          ${seq.map((u, i) => `${i > 0 ? '<span class="rg-arr">→</span>' : ''}
            <span class="rg-pill ${i === 0 ? 'cur' : i === 1 ? 'nxt' : ''}">${esc(unidadNombre(u))}</span>`).join('')}
        </div>
      </div>
      <div class="rg-advisor">
        💡 Próximo trade en <b>${esc(unidadNombre(act))}</b> — riesgo por cuenta:
        <ul class="fut-risk-list">
          ${act.cuentas.map(c => {
            const { gestion, pendiente } = gestionEfectiva(c);
            return `<li><b>${esc(c.empresa)}${c.numero ? ' #' + esc(c.numero) : ''}</b> · ${esc(gestion.nombre)}${pendiente ? ' <span class="fut-pend">elige gestión</span>' : ''} → <b>${riesgoTexto(gestion, c)}</b></li>`;
          }).join('')}
        </ul>
        Regístralo en <a href="#/nuevo">Nuevo trade</a>${act.grupo ? ' asignándolo al grupo' : ''}; con SL la rotación pasa a la siguiente.
      </div>`;
  } else {
    banner = `<div class="rg-hint">Ninguna cuenta de futuros está en rotación. Actívalas en <b>Gestionar</b>.</div>`;
  }

  // Todas las cuentas, agrupadas por unidad (las que están fuera de rotación, al final)
  const enRot = new Set(us.flatMap(u => u.cuentas.map(c => c.id)));
  const fuera = cuentasFuturos().filter(c => !enRot.has(c.id));
  const bloques = us.map(u => bloqueUnidad(unidadNombre(u), u.cuentas, u === act, !!u.grupo));
  if (fuera.length) bloques.push(bloqueUnidad('Fuera de rotación', fuera, false, true));
  return banner + `<div class="rg-groups">${bloques.join('')}</div>`;
}

function bloqueUnidad(titulo, cuentas, activa, esGrupo) {
  return `
    <div class="rg-group">
      <div class="rg-group-hdr">
        <span class="rg-group-title">${esc(titulo)}</span>
        ${activa ? '<span class="rg-tag-active">Activa</span>' : ''}
        ${esGrupo ? `<span class="rg-group-count">${cuentas.length}</span>` : ''}
      </div>
      <div class="rg-group-body">${cuentas.map(cardCuenta).join('')}</div>
    </div>`;
}

function cardCuenta(c) {
  const st = accountStats(c, state.trades);
  const pct = c.capital > 0 ? (st.equityUsd - c.capital) / c.capital : 0;
  const { gestion, pendiente } = gestionEfectiva(c);
  const f = FASE[c.fase] || FASE.challenge_1;
  return `
    <div class="rg-card ${pct >= 0 ? 'ok' : pct >= -0.02 ? 'warn' : 'danger'}">
      <div class="rg-card-top">
        <span class="rg-card-name">${esc(c.empresa)}${c.numero ? ' #' + esc(c.numero) : ''}</span>
        <div class="rg-card-tags"><span class="rg-gtag ${f.cls}">${f.short}</span></div>
      </div>
      <div class="rg-card-perfil"><span>${esc(gestion.nombre)}</span>${pendiente ? ' <span class="fut-pend">elige gestión</span>' : ''}</div>
      <div class="rg-card-bal">${fmtUsd(st.equityUsd)}</div>
      <div class="rg-card-row"><span class="rg-card-pct ${pct >= 0 ? 'pos' : 'neg'}">${pf(pct)}</span></div>
      <div class="rg-card-risk"><span>Riesgo por trade</span><strong>${riesgoTexto(gestion, c)}</strong></div>
    </div>`;
}

function wireRotacion() { /* solo lectura */ }

// ── Pestaña Gestionar ────────────────────────────────────────
function gestionarHtml() {
  const us = units();
  const act = unidadActiva(us, state.config.futRotacionActiva);
  const grupos = gruposExistentes();

  const orden = us.length ? `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">Orden de rotación</div>
      <div class="card-sub">Cada fila es un grupo de copiado o una cuenta suelta. Con SL se pasa a la siguiente; con TP se sigue en la misma.</div>
      <div class="rg-orden">
        ${us.map((u, i) => `
          <div class="rg-orden-item">
            <span class="rg-orden-num">${i + 1}</span>
            <span class="rg-orden-name">${esc(unidadNombre(u))}${u.grupo ? ` <span style="color:var(--muted);font-weight:400;">· ${u.cuentas.length} cuenta${u.cuentas.length !== 1 ? 's' : ''}</span>` : ''}
              ${u === act ? '<span class="rg-tag-active" style="margin-left:6px;">Activa</span>' : ''}</span>
            <div class="rg-orden-actions">
              ${u === act ? '' : `<button class="btn ghost" data-fut-activa="${esc(u.key)}" title="Poner activa">●</button>`}
              <button class="btn ghost" data-fut-up="${esc(u.key)}" ${i === 0 ? 'disabled' : ''} title="Subir">▲</button>
              <button class="btn ghost" data-fut-down="${esc(u.key)}" ${i === us.length - 1 ? 'disabled' : ''} title="Bajar">▼</button>
            </div>
          </div>`).join('')}
      </div>
      ${us.length > 1 ? '<button class="btn" id="futNextSl" style="margin-top:10px;" title="Pasa la rotación a la siguiente sin registrar ningún trade">Siguiente (SL) →</button>' : ''}
    </div>` : '';

  const filas = cuentasFuturos().map(c => {
    const { gestion, pendiente } = gestionEfectiva(c);
    const f = FASE[c.fase] || FASE.challenge_1;
    const opts = gestionesDeFase(faseGestion(c));
    return `
      <tr>
        <td><div style="font-weight:700;">${esc(c.empresa)}${c.numero ? ' #' + esc(c.numero) : ''}</div>
            <span class="rg-gtag ${f.cls}" style="font-size:9px;">${f.short} ${f.label}</span>
            <span class="mono" style="font-size:10px;color:var(--muted);margin-left:4px;">${fmtUsd(c.capital)}</span></td>
        <td>
          <select class="select" data-fut-gestion="${c.id}">
            ${opts.map(g => `<option value="${g.id}" ${g.id === gestion.id && !pendiente ? 'selected' : ''}>${esc(g.nombre)} (${g.pct})</option>`).join('')}
            ${pendiente ? '<option value="" selected disabled>— Elige gestión —</option>' : ''}
          </select>
          <div class="mono" style="font-size:10px;color:var(--muted);margin-top:4px;">${riesgoTexto(gestion, c)}</div>
        </td>
        <td>
          <select class="select" data-fut-grupo="${c.id}">
            <option value="" ${!c.grupo ? 'selected' : ''}>Sin grupo</option>
            ${grupos.map(g => `<option value="${esc(g)}" ${c.grupo === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
            <option value="__nuevo__">+ Nuevo grupo…</option>
          </select>
        </td>
        <td style="text-align:center;">
          <label class="rg-toggle"><input type="checkbox" data-fut-rot="${c.id}" ${c.enRotacion !== false ? 'checked' : ''}><span>En rotación</span></label>
        </td>
      </tr>`;
  }).join('');

  return `
    ${orden}
    <div class="card table-card" style="padding:0;">
      <table class="data-table rg-table fut-table">
        <thead><tr><th>Cuenta</th><th>Gestión de riesgo</th><th>Grupo de copiado</th><th></th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <div class="rg-hint" style="margin-top:12px;">La gestión se elige por cuenta: dentro de un grupo cada cuenta puede llevar la suya.
      Las cantidades son para ${usdEs(BASE_CAPITAL)}; en cuentas de otro tamaño se escalan solas. Al pasar a fondeada se pide elegir una de fondeada.</div>`;
}

function wireGestionar(panel) {
  const keys = () => units().map(u => u.key);
  const setOrden = ks => state.setConfig({ futRotacionOrden: ks });

  panel.querySelectorAll('[data-fut-up]').forEach(b => b.addEventListener('click', () => {
    const ks = keys(); const i = ks.indexOf(b.dataset.futUp);
    if (i > 0) { [ks[i - 1], ks[i]] = [ks[i], ks[i - 1]]; setOrden(ks); }
  }));
  panel.querySelectorAll('[data-fut-down]').forEach(b => b.addEventListener('click', () => {
    const ks = keys(); const i = ks.indexOf(b.dataset.futDown);
    if (i >= 0 && i < ks.length - 1) { [ks[i + 1], ks[i]] = [ks[i], ks[i + 1]]; setOrden(ks); }
  }));
  panel.querySelectorAll('[data-fut-activa]').forEach(b => b.addEventListener('click', () =>
    state.setConfig({ futRotacionActiva: b.dataset.futActiva })));
  const next = panel.querySelector('#futNextSl');
  if (next) next.addEventListener('click', () => {
    const us = units(); const act = unidadActiva(us, state.config.futRotacionActiva);
    if (us.length > 1 && act) state.setConfig({ futRotacionActiva: us[(us.indexOf(act) + 1) % us.length].key });
  });

  panel.querySelectorAll('[data-fut-gestion]').forEach(sel => sel.addEventListener('change', () => {
    if (sel.value) state.updateCuenta(sel.dataset.futGestion, { futGestion: sel.value });
  }));
  panel.querySelectorAll('[data-fut-rot]').forEach(chk => chk.addEventListener('change', () =>
    state.updateCuenta(chk.dataset.futRot, { enRotacion: chk.checked })));
  panel.querySelectorAll('[data-fut-grupo]').forEach(sel => sel.addEventListener('change', () => {
    const id = sel.dataset.futGrupo;
    if (sel.value !== '__nuevo__') { state.updateCuenta(id, { grupo: sel.value }); return; }
    pedirNombreGrupo(nombre => state.updateCuenta(id, { grupo: nombre }), () => {
      const c = state.cuentas.find(x => x.id === id);
      sel.value = c && c.grupo ? c.grupo : '';
    });
  }));
}

// Un grupo existe mientras tenga alguna cuenta: crearlo es asignarle la primera.
function pedirNombreGrupo(onOk, onCancel) {
  openModal({
    title: 'Nuevo grupo de copiado',
    body: `<div class="form-field">
        <label class="form-label">Nombre del grupo</label>
        <input class="form-input" id="futGrupoNombre" placeholder="Grupo A" maxlength="30">
        <div id="futGrupoErr" class="auth-error" style="display:none;margin-top:8px;"></div>
      </div>`,
    actions: [
      { label: 'Cancelar', onClick: close => { close(); onCancel(); } },
      { label: 'Crear y asignar', variant: 'primary', onClick: close => {
        const inp = document.getElementById('futGrupoNombre');
        const nombre = (inp.value || '').trim();
        const err = document.getElementById('futGrupoErr');
        if (!nombre) { err.textContent = 'Pon un nombre.'; err.style.display = 'flex'; return; }
        close(); onOk(nombre);
      } },
    ],
  });
  setTimeout(() => document.getElementById('futGrupoNombre')?.focus(), 30);
}

// ── Pestaña Gestiones (referencia) ───────────────────────────
function gestionesHtml() {
  const tabla = (fase, titulo) => `
    <div class="section-title">${titulo}</div>
    <div class="card table-card" style="padding:0;margin-bottom:16px;">
      <table class="data-table rg-table">
        <thead><tr><th>Gestión</th><th>%</th><th>Riesgo por trade</th><th>Objetivo por TP</th><th>Consistencia</th><th></th></tr></thead>
        <tbody>${GESTIONES_FUTUROS.filter(g => g.fase === fase).map(g => `
          <tr>
            <td style="font-weight:700;">${esc(g.nombre)}</td>
            <td class="mono">${g.pct}</td>
            <td class="mono">${riesgoTexto(g, { capital: BASE_CAPITAL })}${g.rrRango ? ` <span style="color:var(--muted);">· RR ${g.rrRango}</span>` : ''}</td>
            <td class="mono">${g.objetivo ? usdEs(g.objetivo) + (g.objetivoNota ? ` (${g.objetivoNota})` : '') : '—'}</td>
            <td class="mono">${g.consistencia || '—'}</td>
            <td style="font-size:11px;color:var(--muted);">${esc(g.nota || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  return `
    <div class="rg-hint" style="margin-bottom:12px;">Cantidades para cuentas de ${usdEs(BASE_CAPITAL)}. En cuentas de otro tamaño se escalan en proporción.</div>
    ${tabla('challenge', 'Challenges')}
    ${tabla('fondeada', 'Fondeadas')}`;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
