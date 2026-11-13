// Pop-up de la cuenta: sustituye a la antigua página Ajustes (#/ajustes).
// Se abre desde el botón con el nombre del usuario (barra superior), desde el
// enlace "Ajustes" del pie y desde cualquier elemento con [data-account].
//
// Dos columnas: menú con buscador a la izquierda y la sección a la derecha.
//   CUENTA: Perfil · Trofeos          TRADING: Módulos · Apps Script
//   APP: Preferencias · Datos y privacidad · Mantenimiento
//   TRADINVERSO: Sobre Tradinverso
//
// Todo lo que se cambia se guarda en la cuenta (Firestore): el perfil en
// users/{uid}/profile, lo demás en config (state.setConfig).
//
// "Ver como" (admin mirando a un alumno): solo salen Trofeos (lectura), Datos
// y Mantenimiento, y actúan sobre la cuenta del ALUMNO, igual que hacía la
// página Ajustes.

import { state } from '../state.js';
import { auth, authErrorMsg } from '../auth.js';
import { sync } from '../sync.js';
import { storage } from '../storage.js';
import { router } from '../router.js';
import { appearance } from '../appearance.js';
import { appearanceBodyHtml, handleAppearanceClick } from './appearance-panel.js';
import { renderTrophies, getTrophiesMeta } from './trophies.js';
import { showToast } from './toast.js';
import { icon, ic } from './icons.js';
import { clockParts } from './topbar.js';
import { TIMEZONES, tzLabel, guessTz, todayLocal } from '../utils/timezone.js';
import { downloadFile } from '../utils/csv.js';
import { stampNow, slug, exportXlsx } from '../utils/sheet-export.js';
import { fetchAppsScript } from '../utils/apps-script-import.js';
import { paintUrlTab, paintFileTab } from '../views/import-table.js';
import { VERSION } from '../version.js';
import { avatarInner, prepararFoto, fotoValida } from '../utils/avatar.js';
import { reglaDiariaActiva, mostrarRegla } from './regla-aviso.js';
import { EXPORT_SHEETS, sheetLabel, filterTrades, periodLabel, exportCsv, exportExcel, exportPdf } from '../utils/export-trades.js';

const FORMACION_URL = 'https://tradinverso.thinkific.com/enrollments';
const CALENDARIO_URL = 'https://es.investing.com/economic-calendar';
const APPS_SCRIPT_RE = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;

const MENU = [
  { grupo: 'Cuenta', items: [
    { id: 'perfil', label: 'Perfil', icon: 'usuario', sub: 'Tu email, nombre para mostrar, contraseña, zona horaria y sesión', keys: 'email nombre contraseña password zona horaria hora formato cerrar sesion avatar' },
    { id: 'trofeos', label: 'Trofeos', icon: 'trofeo', sub: 'Tu canal de logros: fases pasadas, fondeos y payouts de las prop firms', keys: 'logros certificados fase fondeada payout prop firm pdf imagen' },
  ] },
  { grupo: 'Trading', items: [
    { id: 'modulos', label: 'Módulos', icon: 'modulos', sub: 'Herramientas extra que puedes activar en la app', keys: 'riesgo rotacion cfd futuros cortacircuitos pausa regla del dia leccion aviso' },
    { id: 'apps', label: 'Conexión con Apps Script', icon: 'enlace', sub: 'La URL de tu Google Sheet para reimportar trades', keys: 'google sheet url script importar conexion' },
  ] },
  { grupo: 'App', items: [
    { id: 'preferencias', label: 'Preferencias', icon: 'paleta', sub: 'Tema, colores, letra y densidad', keys: 'apariencia tema color acento letra fuente densidad tarjetas oscuro claro glass ocultar pnl' },
    { id: 'datos', label: 'Datos y privacidad', icon: 'datos', sub: 'Copia de seguridad, exportar tus trades y eliminar cuenta', keys: 'backup copia seguridad exportar excel csv pdf json importar restaurar tabla eliminar cuenta' },
    { id: 'mantenimiento', label: 'Mantenimiento', icon: 'herramienta', sub: 'Reimportar y borrar trades', keys: 'reimportar borrar trades estrategia limpiar' },
  ] },
  { grupo: 'Tradinverso', items: [
    { id: 'sobre', label: 'Sobre Tradinverso', icon: 'info', sub: 'La app, la versión y dónde viven tus datos', keys: 'version formacion firebase privacidad calendario' },
  ] },
];
const VIEWAS_IDS = ['trofeos', 'datos', 'mantenimiento'];

let rootEl = null;
let section = 'perfil';
let query = '';
let logoutAsk = false;
let unsubAuth = null;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sinTildes = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const inViewAs = () => !!state.viewAsUid;
const targetUid = () => state.viewAsUid || auth.uid();
const quien = () => inViewAs() && state.viewAsProfile ? (state.viewAsProfile.nombre || state.viewAsProfile.email || 'alumno') : auth.displayName();
const usuario = n => '@' + (sinTildes(n).replace(/[^a-z0-9]/g, '') || 'usuario');
const rol = () => inViewAs() ? 'Alumno Tradinverso' : auth.isAdmin() ? 'Admin Tradinverso' : auth.isGestor() ? 'Gestor Tradinverso' : 'Alumno Tradinverso';
function iniciales(name) {
  const p = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
  return p.length ? (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase() : '·';
}
const items = () => MENU.flatMap(g => g.items).filter(i => !inViewAs() || VIEWAS_IDS.includes(i.id));

// Ondas del banner: cuatro capas de azules translúcidos.
const ondas = () => `
  <svg class="acc-waves" viewBox="0 0 1100 150" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 70 C 180 20, 320 120, 520 74 S 900 20, 1100 80 V150 H0Z" fill="rgba(96,165,250,.28)"/>
    <path d="M0 96 C 200 50, 380 140, 600 92 S 940 60, 1100 104 V150 H0Z" fill="rgba(59,130,246,.26)"/>
    <path d="M0 112 L 150 70 L 300 118 L 470 62 L 640 122 L 820 76 L 980 120 L 1100 88 V150 H0Z" fill="rgba(37,99,235,.20)"/>
    <path d="M0 128 C 240 96, 420 150, 660 122 S 980 104, 1100 132 V150 H0Z" fill="rgba(147,197,253,.34)"/>
  </svg>`;

export function isAccountOpen() { return !!(rootEl && rootEl.firstChild); }

export function openAccountModal(sec) {
  if (!auth.currentUser) return;
  if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'account-root'; document.body.appendChild(rootEl); }
  const ids = items().map(i => i.id);
  section = ids.includes(sec) ? sec : (ids.includes(section) && isAccountOpen() ? section : ids[0]);
  query = ''; logoutAsk = false;
  document.body.classList.add('acc-open');
  document.addEventListener('keydown', onKey);
  if (!unsubAuth) unsubAuth = auth.on(() => { if (!auth.currentUser) closeAccountModal(); });
  render();
  const x = rootEl.querySelector('.acc-close'); if (x) x.focus();
}

export function closeAccountModal() {
  if (rootEl) rootEl.innerHTML = '';
  document.body.classList.remove('acc-open');
  document.removeEventListener('keydown', onKey);
  // Si se entró por la URL #/ajustes, al cerrar se vuelve a una vista real.
  if (router.current() === '#/ajustes') router.go(auth.isAdmin() && !inViewAs() ? '#/admin' : '#/dashboard');
}

function onKey(e) {
  if (e.key !== 'Escape') return;
  const visor = rootEl && rootEl.querySelector('.tro-viewer');
  if (visor) visor.remove(); else closeAccountModal();
}

// ── Armazón ────────────────────────────────────────────────
function render() {
  const nombre = quien();
  rootEl.innerHTML = `
    <div class="acc-overlay">
      <div class="acc-box ${appearance.isDark() ? 'dark' : ''}" role="dialog" aria-modal="true" aria-label="Tu cuenta y ajustes">
        <div class="acc-banner">${ondas()}<button type="button" class="acc-x acc-close" aria-label="Cerrar">×</button></div>
        <div class="acc-id">
          <div class="acc-avatar">${avatarInner(inViewAs() ? state.viewAsProfile : auth.profile, nombre)}</div>
          <div class="acc-id-text">
            <div class="acc-name">${esc(nombre)}</div>
            <div class="acc-user">${esc(usuario(nombre))} · ${rol()}${inViewAs() ? ' · <b>estás viendo su cuenta</b>' : ''}</div>
          </div>
        </div>
        <div class="acc-cols">
          <nav class="acc-side" aria-label="Secciones de ajustes">
            <label class="acc-search">${icon('buscar')}<input type="search" placeholder="Buscar en ajustes" value="${esc(query)}" aria-label="Buscar en ajustes"></label>
            <div class="acc-menu"></div>
          </nav>
          <div class="acc-main"></div>
        </div>
      </div>
    </div>`;
  const overlay = rootEl.querySelector('.acc-overlay');
  let abajoEnFondo = false;
  overlay.addEventListener('mousedown', e => { abajoEnFondo = e.target === overlay; });
  overlay.addEventListener('click', e => { if (e.target === overlay && abajoEnFondo) closeAccountModal(); });
  rootEl.querySelector('.acc-close').addEventListener('click', closeAccountModal);
  const buscador = rootEl.querySelector('.acc-search input');
  buscador.addEventListener('input', () => { query = buscador.value; renderMenu(); });
  renderMenu();
  renderSection();
}

function renderMenu() {
  const menu = rootEl.querySelector('.acc-menu');
  const q = sinTildes(query.trim());
  const visible = i => (!inViewAs() || VIEWAS_IDS.includes(i.id)) && (!q || sinTildes(i.label + ' ' + i.keys + ' ' + i.sub).includes(q));
  const grupos = MENU.map(g => ({ ...g, items: g.items.filter(visible) })).filter(g => g.items.length);
  menu.innerHTML = (grupos.length ? grupos.map(g => `
      <div class="acc-group">${g.grupo}</div>
      ${g.items.map(i => `<button type="button" class="acc-item ${i.id === section ? 'on' : ''}" data-sec="${i.id}"><span class="acc-item-ic">${icon(i.icon)}</span>${i.label}</button>`).join('')}`).join('')
    : `<div class="acc-noresults">Sin resultados para «${esc(query.trim())}»</div>`)
    + (inViewAs() ? '' : `<div class="acc-sep"></div>
      ${logoutAsk
        ? `<div class="acc-logout-ask">¿Seguro? <button type="button" class="btn" data-logout="no">Cancelar</button> <button type="button" class="btn danger" data-logout="si">Sí, cerrar sesión</button></div>`
        : `<button type="button" class="acc-item acc-logout" data-logout="ask"><span class="acc-item-ic">${icon('salir')}</span>Cerrar sesión</button>`}`);
  menu.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => { section = b.dataset.sec; renderMenu(); renderSection(); }));
  menu.querySelectorAll('[data-logout]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.logout === 'si') return cerrarSesion();
    logoutAsk = b.dataset.logout === 'ask'; renderMenu();
  }));
}

async function cerrarSesion() {
  try { await auth.signOut(); } catch (e) { console.error(e); }
  closeAccountModal();
}

const SECCIONES = { perfil, trofeos, modulos, apps, preferencias, datos, mantenimiento, sobre };

function renderSection() {
  const main = rootEl.querySelector('.acc-main');
  const def = items().find(i => i.id === section) || items()[0];
  main.innerHTML = `<h2 class="acc-title">${def.label}</h2><div class="acc-sub">${def.sub}</div><div class="acc-body"></div>`;
  main.scrollTop = 0;
  SECCIONES[def.id](main.querySelector('.acc-body'));
}
// Repinta la sección conservando el scroll (tras guardar o cambiar una opción).
function refresh() {
  const main = rootEl.querySelector('.acc-main');
  const y = main ? main.scrollTop : 0;
  renderSection();
  const m2 = rootEl.querySelector('.acc-main'); if (m2) m2.scrollTop = y;
}

// Piezas comunes
const card = (inner, cls = '') => `<div class="acc-card ${cls}">${inner}</div>`;
const fila = (label, desc, control) => `
  <div class="setting-row">
    <div class="setting-info"><div class="setting-label">${label}</div>${desc ? `<div class="setting-desc">${desc}</div>` : ''}</div>
    <div class="setting-control">${control}</div>
  </div>`;
const on = (root, sel, ev, fn) => { const el = root.querySelector(sel); if (el) el.addEventListener(ev, fn); return el; };
const errorEn = (root, sel, msg) => { const e = root.querySelector(sel); if (e) { e.textContent = msg || ''; e.hidden = !msg; } };

// ── PERFIL ─────────────────────────────────────────────────
function perfil(body) {
  const p = auth.profile || {};
  const nombre = auth.displayName();
  const tz = auth.timezone();
  const prefs = appearance.get();
  body.innerHTML = `
    ${card(`
      <div class="acc-pcard-banner">${ondas()}</div>
      <div class="acc-pcard">
        <button type="button" class="acc-avatar sm acc-avatar-btn" id="accFotoAv" title="Cambiar la foto de perfil" aria-label="Cambiar la foto de perfil">${avatarInner(p, nombre)}<span class="acc-avatar-cam">${ic('lapiz')}</span></button>
        <div class="acc-id-text"><div class="acc-name sm">${esc(nombre)}</div><div class="acc-user">${esc(usuario(nombre))}</div></div>
        <button type="button" class="btn" id="accEditName">${ic('lapiz')} Editar perfil</button>
      </div>
      <div class="acc-foto">
        <input type="file" id="accFotoFile" accept="image/jpeg,image/png,image/webp,image/*" hidden>
        <button type="button" class="btn" id="accFotoBtn">${fotoValida(p.foto) ? 'Cambiar foto' : 'Poner foto de perfil'}</button>
        ${fotoValida(p.foto) ? '<button type="button" class="btn ghost" id="accFotoDel">Quitar foto</button>' : ''}
        <span class="acc-foto-nota">Se recorta en cuadrado y se guarda pequeña, en tu cuenta.</span>
        <div class="acc-err" id="accFotoErr" hidden></div>
      </div>
      <div class="acc-inline" id="accNameBox" hidden>
        <label class="acc-flabel">Nombre para mostrar
          <input class="form-input" id="accName" maxlength="40" value="${esc(p.nombre || nombre)}" placeholder="Tu nombre"></label>
        <div class="acc-err" id="accNameErr" hidden></div>
        <div class="acc-actions"><button type="button" class="btn" id="accNameCancel">Cancelar</button><button type="button" class="btn primary" id="accNameSave">Guardar</button></div>
      </div>`, 'acc-profile')}
    ${card(`
      ${fila('Email', 'Tu identificador de acceso. No se puede cambiar.', `<span class="acc-lock">${ic('candado')} ${esc(p.email || auth.currentUser?.email || '')}</span>`)}
      ${fila('Contraseña', 'Cambia tu contraseña de acceso.', `<button type="button" class="btn" id="accPwBtn">Cambiar contraseña</button>`)}
      <div class="acc-inline" id="accPwBox" hidden>
        <label class="acc-flabel">Contraseña actual<input class="form-input" type="password" id="accPw0" autocomplete="current-password"></label>
        <label class="acc-flabel">Nueva contraseña<input class="form-input" type="password" id="accPw1" autocomplete="new-password" placeholder="Mínimo 8 caracteres y un número"></label>
        <label class="acc-flabel">Repetir la nueva<input class="form-input" type="password" id="accPw2" autocomplete="new-password"></label>
        <div class="acc-err" id="accPwErr" hidden></div>
        <div class="acc-actions"><button type="button" class="btn" id="accPwCancel">Cancelar</button><button type="button" class="btn primary" id="accPwSave">Cambiar contraseña</button></div>
      </div>
      ${fila('Zona horaria', `Metes los trades en <strong>tu hora local</strong> y las estadísticas por hora se muestran en tu horario. Tu profesor verá tus horas convertidas a la suya.${!auth.hasTimezone() ? `<br><span class="acc-warn">⚠ Sin configurar. Detectada: <strong>${esc(guessTz())}</strong>: confírmala para que tus horas cuadren.</span>` : ''}`,
        `<div class="acc-row"><select class="select" id="accTz">
          ${TIMEZONES.map(t => `<option value="${esc(t.tz)}" ${tz === t.tz ? 'selected' : ''}>${esc(tzLabel(t.tz))}</option>`).join('')}
          ${TIMEZONES.some(t => t.tz === tz) ? '' : `<option value="${esc(tz)}" selected>${esc(tzLabel(tz))}</option>`}
        </select><button type="button" class="btn primary" id="accTzSave">Guardar</button></div>`)}
      ${fila('Formato de hora', `Ahora mismo en tu zona: <strong id="accAhora">${esc(clockParts().hora)}</strong> · ${esc(tzLabel(tz))}`,
        `<div class="ap-seg" id="accHora"><button type="button" class="${prefs.hour12 ? '' : 'on'}" data-h="24">24 h</button><button type="button" class="${prefs.hour12 ? 'on' : ''}" data-h="12">12 h</button></div>`)}
      ${fila('Cerrar sesión', 'Sal de tu cuenta en este dispositivo. Tus datos siguen guardados en la nube.',
        `<span id="accOutAsk" hidden>¿Seguro? <button type="button" class="btn" id="accOutNo">Cancelar</button> <button type="button" class="btn danger" id="accOutYes">Sí, cerrar sesión</button></span>
         <button type="button" class="btn acc-danger-outline" id="accOut">Cerrar sesión</button>`)}
    `)}`;

  // Foto de perfil
  const fotoFile = body.querySelector('#accFotoFile');
  const elegirFoto = () => fotoFile.click();
  on(body, '#accFotoAv', 'click', elegirFoto);
  on(body, '#accFotoBtn', 'click', elegirFoto);
  on(body, '#accFotoFile', 'change', async () => {
    const f = fotoFile.files && fotoFile.files[0];
    fotoFile.value = '';
    if (!f) return;
    errorEn(body, '#accFotoErr', '');
    try {
      await auth.updatePhoto(await prepararFoto(f));
      showToast('Foto de perfil guardada');
      render();
    } catch (e) { errorEn(body, '#accFotoErr', e.message || String(e)); }
  });
  on(body, '#accFotoDel', 'click', async () => {
    try { await auth.updatePhoto(null); showToast('Foto de perfil quitada'); render(); }
    catch (e) { errorEn(body, '#accFotoErr', 'No se pudo quitar: ' + (e.message || e)); }
  });

  // Nombre
  const box = body.querySelector('#accNameBox');
  on(body, '#accEditName', 'click', () => { box.hidden = !box.hidden; if (!box.hidden) body.querySelector('#accName').focus(); });
  on(body, '#accNameCancel', 'click', () => { box.hidden = true; });
  on(body, '#accNameSave', 'click', async () => {
    const v = body.querySelector('#accName').value.trim();
    if (v.length < 2 || v.length > 40) return errorEn(body, '#accNameErr', 'El nombre debe tener entre 2 y 40 caracteres.');
    try {
      await auth.updateName(v);
      showToast('Nombre actualizado');
      router.reload();          // título "Dashboard · <nombre>"
      render();                 // cabecera del pop-up
    } catch (e) { errorEn(body, '#accNameErr', 'No se pudo guardar: ' + (e.message || e)); }
  });

  // Contraseña
  const pw = body.querySelector('#accPwBox');
  on(body, '#accPwBtn', 'click', () => { pw.hidden = !pw.hidden; if (!pw.hidden) body.querySelector('#accPw0').focus(); });
  on(body, '#accPwCancel', 'click', () => { pw.hidden = true; });
  on(body, '#accPwSave', 'click', async () => {
    const [a, b, c] = ['#accPw0', '#accPw1', '#accPw2'].map(s => body.querySelector(s).value);
    const err = m => errorEn(body, '#accPwErr', m);
    if (!a) return err('Escribe tu contraseña actual.');
    if (b.length < 8 || !/\d/.test(b)) return err('La nueva contraseña debe tener al menos 8 caracteres y un número.');
    if (b !== c) return err('Las dos contraseñas nuevas no coinciden.');
    if (a === b) return err('La nueva contraseña tiene que ser distinta de la actual.');
    const btn = body.querySelector('#accPwSave'); btn.disabled = true;
    try {
      await auth.changePasswordWithCurrent(a, b);
      pw.hidden = true; ['#accPw0', '#accPw1', '#accPw2'].forEach(s => { body.querySelector(s).value = ''; });
      err(''); showToast('Contraseña actualizada');
    } catch (e) {
      err(e && (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') ? 'La contraseña actual no es correcta.' : authErrorMsg(e));
    } finally { btn.disabled = false; }
  });

  // Zona horaria
  on(body, '#accTzSave', 'click', async e => {
    const v = body.querySelector('#accTz').value;
    e.currentTarget.disabled = true;
    try { await auth.updateTimezone(v); showToast('Zona horaria guardada: ' + tzLabel(v)); router.reload(); refresh(); }
    catch (err) { showToast('Error guardando la zona horaria: ' + (err.message || err)); e.currentTarget.disabled = false; }
  });

  // Formato de hora (va con la apariencia: se guarda en la cuenta)
  body.querySelectorAll('#accHora [data-h]').forEach(b => b.addEventListener('click', () => {
    appearance.set({ hour12: b.dataset.h === '12' });
    router.reload(); refresh();
    showToast('Formato de hora: ' + (b.dataset.h === '12' ? '12 h' : '24 h'));
  }));

  // Cerrar sesión
  on(body, '#accOut', 'click', e => { e.currentTarget.hidden = true; body.querySelector('#accOutAsk').hidden = false; });
  on(body, '#accOutNo', 'click', () => { body.querySelector('#accOut').hidden = false; body.querySelector('#accOutAsk').hidden = true; });
  on(body, '#accOutYes', 'click', cerrarSesion);
}

// ── TROFEOS ────────────────────────────────────────────────
function trofeos(body) {
  const host = document.createElement('div');
  body.appendChild(host);
  renderTrophies(host, { uid: targetUid(), readOnly: inViewAs(), hoy: todayLocal(auth.timezone()) });
}

// ── MÓDULOS ────────────────────────────────────────────────
function riskValue() {
  if (state.config.riskModuleEnabled === false) return 'off';
  return state.config.riskTipos || 'ambos';
}
function modulos(body) {
  const cc = state.config.cortacircuitos === true;
  const rd = reglaDiariaActiva();
  body.innerHTML = card(`
    ${fila('Gestión de riesgo / rotación', 'Añade en <strong>Cuentas</strong> las pestañas de riesgo: <strong>CFD</strong> (escalado por niveles según el drawdown) y <strong>Futuros</strong> (gestiones de riesgo fijo y grupos de copiado), cada una con su rotación. Elige cuáles ver. Lee de tus cuentas y trades, no añade datos.',
      `<select class="select" id="accRisk">${[['ambos', 'CFD y Futuros'], ['CFD', 'Solo CFD'], ['Futuros', 'Solo Futuros'], ['off', 'Desactivado']]
        .map(([v, l]) => `<option value="${v}" ${riskValue() === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
    ${fila('Cortacircuitos de riesgo', 'Al apuntar el primer SL del día en una cuenta, la app te marca una <strong>pausa de 5 minutos</strong> con cuenta atrás antes del siguiente trade.',
      `<button type="button" class="ap-switch ${cc ? 'on' : ''}" role="switch" aria-checked="${cc}" aria-label="Cortacircuitos de riesgo" id="accBreaker"><span></span></button>`)}
    ${fila('Regla del día al abrir', 'Una vez al día, al entrar, la app te recuerda una regla. En días alternos es una lección que tú mismo escribiste en el diario del trader. <button type="button" class="acc-linkbtn" id="accReglaVer">Ver la de hoy</button>',
      `<button type="button" class="ap-switch ${rd ? 'on' : ''}" role="switch" aria-checked="${rd}" aria-label="Regla del día al abrir" id="accRegla"><span></span></button>`)}`);
  on(body, '#accRegla', 'click', () => {
    const v = !reglaDiariaActiva();
    state.setConfig({ reglaDiaria: v });
    showToast(v ? 'Regla del día activada' : 'Regla del día desactivada');
    refresh();
  });
  on(body, '#accReglaVer', 'click', () => mostrarRegla());
  on(body, '#accRisk', 'change', e => {
    const v = e.target.value;
    state.setConfig(v === 'off' ? { riskModuleEnabled: false } : { riskModuleEnabled: true, riskTipos: v });
    showToast(v === 'off' ? 'Gestión de riesgo desactivada' : v === 'ambos' ? 'Gestión de riesgo activada: CFD y Futuros' : `Gestión de riesgo activada: solo ${v}`);
  });
  on(body, '#accBreaker', 'click', () => {
    const v = !(state.config.cortacircuitos === true);
    state.setConfig({ cortacircuitos: v });
    showToast(v ? 'Cortacircuitos activado' : 'Cortacircuitos desactivado');
    refresh();
  });
}

// ── APPS SCRIPT ────────────────────────────────────────────
const urlGuardada = () => (state.config && state.config.appsScriptUrl) || storage.getAppsScriptUrl() || '';
function apps(body) {
  let probada = null;      // { url, ok, msg }
  body.innerHTML = card(`
    <label class="acc-flabel">URL del Apps Script
      <input class="form-input" type="url" id="accUrl" value="${esc(urlGuardada())}" placeholder="https://script.google.com/macros/s/…/exec"></label>
    <div class="acc-status" id="accUrlStatus"></div>
    <div class="acc-actions"><button type="button" class="btn" id="accUrlTest">Probar conexión</button><button type="button" class="btn primary" id="accUrlSave">Guardar</button></div>
  `) + card(`<div class="acc-help"><b>¿Dónde está la URL?</b> Google Sheet → Extensiones → Apps Script → Implementar → Aplicación web (acceso: cualquiera) → copia la URL que termina en <code>/exec</code>.</div>`, 'soft');
  const inp = body.querySelector('#accUrl');
  const pintarEstado = () => {
    const v = inp.value.trim(), g = urlGuardada();
    let cls = 'off', txt = 'Sin conectar';
    if (v && !APPS_SCRIPT_RE.test(v)) { cls = 'bad'; txt = 'Formato incorrecto: debe ser https://script.google.com/macros/s/…/exec'; }
    else if (probada && probada.url === v) { cls = probada.ok ? 'ok' : 'bad'; txt = probada.msg; }
    else if (v && v !== g) { cls = 'warn'; txt = 'Cambios sin guardar'; }
    else if (v) { cls = 'ok'; txt = 'URL guardada en tu cuenta'; }
    body.querySelector('#accUrlStatus').innerHTML = `<span class="sdot ${cls === 'off' ? '' : cls}"></span>${esc(txt)}`;
  };
  inp.addEventListener('input', pintarEstado);
  on(body, '#accUrlSave', 'click', () => {
    const v = inp.value.trim();
    if (v && !APPS_SCRIPT_RE.test(v)) return pintarEstado();
    state.setConfig({ appsScriptUrl: v });
    storage.setAppsScriptUrl(v);
    probada = null; pintarEstado();
    showToast(v ? 'URL de Apps Script guardada' : 'URL de Apps Script quitada');
  });
  on(body, '#accUrlTest', 'click', async e => {
    const v = inp.value.trim();
    if (!APPS_SCRIPT_RE.test(v)) return pintarEstado();
    e.currentTarget.disabled = true;
    body.querySelector('#accUrlStatus').innerHTML = '<span class="sdot warn"></span>Probando…';
    try {
      const trades = await fetchAppsScript(v);
      probada = { url: v, ok: trades.length > 0, msg: trades.length ? `Conexión válida: devuelve ${trades.length} trades` : 'Responde, pero no devuelve ningún trade' };
    } catch (err) { probada = { url: v, ok: false, msg: 'No responde: ' + (err.message || err) }; }
    e.currentTarget.disabled = false;
    pintarEstado();
  });
  pintarEstado();
}

// ── PREFERENCIAS ───────────────────────────────────────────
function preferencias(body) {
  body.innerHTML = card(`<div class="acc-ap">${appearanceBodyHtml()}</div>`);
  body.addEventListener('click', e => {
    // Al cambiar de tema cambia también claro/oscuro: se repinta todo el pop-up.
    handleAppearanceClick(e, () => { const y = rootEl.querySelector('.acc-main').scrollTop; render(); rootEl.querySelector('.acc-main').scrollTop = y; });
  });
}

// ── DATOS Y PRIVACIDAD ─────────────────────────────────────
function nombreArchivo() {
  const p = inViewAs() ? (state.viewAsProfile || {}) : (auth.profile || {});
  return slug(p.nombre || p.email || 'tradinverso');
}
function datos(body) {
  const nt = state.trades.length;
  const noTomados = state.backtests.filter(b => b.not_taken).length;
  const protocolos = (state.tradingPlan && Array.isArray(state.tradingPlan.protocolos)) ? state.tradingPlan.protocolos : [];
  const exp = { sheets: [...EXPORT_SHEETS], period: 'todo', desde: '', hasta: '', formato: 'excel' };

  body.innerHTML = `
    ${inViewAs() ? card(`<div class="acc-help">${ic('nota')} Estás en la cuenta de <b>${esc(quien())}</b>: las copias y exportaciones son de <b>sus</b> datos.</div>`, 'soft') : ''}
    ${card(`
      ${fila('Copia de seguridad (JSON)', `Todos los datos de la cuenta en un archivo. <span id="accBkCount">${nt} trades · ${state.backtests.length - noTomados} backtests · ${noTomados} no tomados · ${state.reflections.length} reflexiones · ${state.cuentas.length} cuentas · ${protocolos.length} protocolos</span>`,
        `<button type="button" class="btn" id="accBackup">${ic('descargar')} Descargar JSON</button>`)}
      ${fila('Excel completo (.xlsx)', 'Un libro con una pestaña por estrategia (Zonas · Liquidez · Nasdaq), con las mismas columnas que tu hoja original.',
        `<button type="button" class="btn primary" id="accXlsx" ${nt ? '' : 'disabled'}>${ic('tabla')} Descargar Excel (${nt})</button>`)}
    `)}
    ${card(`
      <div class="acc-card-title">Elegir y exportar</div>
      <div class="acc-flabel">Estrategias</div>
      <div class="pill-group" id="accExpSheets">${EXPORT_SHEETS.map(s => `<button type="button" class="pill active" data-sheet="${s}">${sheetLabel(s)}</button>`).join('')}</div>
      <div class="acc-flabel">Periodo</div>
      <div class="pill-group" id="accExpPeriod">${[['todo', 'Todo'], ['mes', 'Este mes'], ['semana', 'Esta semana'], ['custom', 'Personalizado']].map(([v, l]) => `<button type="button" class="pill ${v === 'todo' ? 'active' : ''}" data-period="${v}">${l}</button>`).join('')}</div>
      <div class="acc-row" id="accExpCustom" hidden>
        <label class="acc-flabel">Desde<input class="form-input" type="date" id="accExpFrom"></label>
        <label class="acc-flabel">Hasta<input class="form-input" type="date" id="accExpTo"></label>
      </div>
      <div class="acc-flabel">Formato</div>
      <div class="pill-group" id="accExpFormat">${[['excel', 'Excel'], ['csv', 'CSV'], ['pdf', 'PDF']].map(([v, l]) => `<button type="button" class="pill ${v === 'excel' ? 'active' : ''}" data-format="${v}">${l}</button>`).join('')}</div>
      <div class="acc-export-foot"><span id="accExpSum"></span><button type="button" class="btn primary" id="accExpGo"></button></div>
    `)}
    ${card(`
      ${fila('Importar trades', 'Pega desde Excel o trae los trades de tu Apps Script. Se abre en su pantalla.', `<button type="button" class="btn" data-ir="#/importar">Abrir importación</button>`)}
      ${fila('Tabla de datos', 'Todos tus trades en una tabla, para buscar, revisar y borrar uno a uno.', `<button type="button" class="btn" data-ir="#/tabla">Abrir tabla</button>`)}
    `)}
    ${state.readOnly && !inViewAs() ? '' : `<div class="acc-card-title out">Restaurar copia de seguridad</div><div id="accRestore" class="acc-embed"></div>`}
    ${inViewAs() || auth.isAdmin() ? '' : card(`
      ${fila('Eliminar cuenta', 'Borra tu usuario y todos tus datos: trades, cuentas, reflexiones, backtests, plan y trofeos. <strong>No se puede deshacer.</strong>',
        `<button type="button" class="btn danger" id="accDel">Eliminar cuenta</button>`)}
      <div class="acc-inline" id="accDelBox" hidden>
        <label class="acc-flabel">Escribe ELIMINAR para confirmar<input class="form-input" id="accDelWord" autocomplete="off" placeholder="ELIMINAR"></label>
        <label class="acc-flabel">Tu contraseña<input class="form-input" type="password" id="accDelPw" autocomplete="current-password"></label>
        <div class="acc-err" id="accDelErr" hidden></div>
        <div class="acc-actions"><button type="button" class="btn" id="accDelCancel">Cancelar</button><button type="button" class="btn danger" id="accDelGo" disabled>Eliminar definitivamente</button></div>
      </div>`, 'danger')}`;

  // Recuento con los trofeos (se cargan aparte)
  getTrophiesMeta(targetUid()).then(t => { const c = body.querySelector('#accBkCount'); if (c) c.textContent += ` · ${t.length} trofeos`; });

  // Backup JSON completo
  on(body, '#accBackup', 'click', async () => {
    const trofeosMeta = (await getTrophiesMeta(targetUid())).map(({ thumb, ...m }) => m);
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      exportedBy: auth.profile?.email || auth.currentUser?.email || 'unknown',
      trades: state.trades,
      backtests: state.backtests,
      cuentas: state.cuentas,
      reflections: state.reflections,
      perfiles: state.perfiles,
      config: state.config,
      tradingPlan: state.tradingPlan,
      protocolos,
      trofeos: trofeosMeta,
      preferencias: inViewAs() ? (state.config && state.config.appearance) || null : appearance.get(),
    };
    downloadFile(`tradinverso-backup-${nombreArchivo()}-${stampNow()}.json`, JSON.stringify(data, null, 2), 'application/json');
    showToast('Copia de seguridad descargada');
  });

  // Excel completo
  on(body, '#accXlsx', 'click', async e => {
    const btn = e.currentTarget, txt = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<span class="spinner-sm"></span> Generando…';
    try { await exportXlsx(state.trades, `tradinverso-${nombreArchivo()}-${stampNow()}.xlsx`); showToast('Excel descargado'); }
    catch (err) { console.error(err); showToast('Error generando Excel: ' + (err.message || err)); }
    finally { btn.disabled = false; btn.innerHTML = txt; }
  });

  // Elegir y exportar
  const seleccion = () => filterTrades(state.trades, exp);
  const pintarExp = () => {
    const n = seleccion().length;
    body.querySelector('#accExpCustom').hidden = exp.period !== 'custom';
    body.querySelector('#accExpSum').textContent = `${n} trade${n === 1 ? '' : 's'} · ${exp.sheets.map(sheetLabel).join(', ') || 'ninguna estrategia'} · ${periodLabel(exp.period, exp.desde, exp.hasta)}`;
    const go = body.querySelector('#accExpGo');
    go.textContent = 'Exportar ' + { excel: 'Excel', csv: 'CSV', pdf: 'PDF' }[exp.formato];
    go.disabled = !n;
  };
  body.querySelectorAll('#accExpSheets [data-sheet]').forEach(b => b.addEventListener('click', () => {
    const s = b.dataset.sheet;
    exp.sheets = exp.sheets.includes(s) ? exp.sheets.filter(x => x !== s) : EXPORT_SHEETS.filter(x => x === s || exp.sheets.includes(x));
    b.classList.toggle('active', exp.sheets.includes(s)); pintarExp();
  }));
  const unico = (grupo, attr, clave) => body.querySelectorAll(`${grupo} [data-${attr}]`).forEach(b => b.addEventListener('click', () => {
    exp[clave] = b.dataset[attr];
    body.querySelectorAll(`${grupo} .pill`).forEach(x => x.classList.toggle('active', x === b)); pintarExp();
  }));
  unico('#accExpPeriod', 'period', 'period'); unico('#accExpFormat', 'format', 'formato');
  on(body, '#accExpFrom', 'change', e => { exp.desde = e.target.value; pintarExp(); });
  on(body, '#accExpTo', 'change', e => { exp.hasta = e.target.value; pintarExp(); });
  on(body, '#accExpGo', 'click', async e => {
    const sel = seleccion(); if (!sel.length) return;
    const btn = e.currentTarget; btn.disabled = true;
    try {
      if (exp.formato === 'excel') await exportExcel(sel, quien());
      else if (exp.formato === 'csv') exportCsv(sel, quien());
      else await exportPdf(sel, quien(), exp);
      showToast(`Exportados ${sel.length} trades en ${{ excel: 'Excel', csv: 'CSV', pdf: 'PDF' }[exp.formato]}`);
    } catch (err) { console.error(err); showToast('No se pudo exportar: ' + (err.message || err)); }
    finally { pintarExp(); }
  });
  pintarExp();

  // Enlaces a las pantallas que siguen existiendo
  body.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => { const r = b.dataset.ir; closeAccountModal(); router.go(r); }));

  // Restaurar: la misma lógica de Importar → Subir archivo
  const rest = body.querySelector('#accRestore');
  if (rest) paintFileTab(rest);

  // Eliminar cuenta
  const delBox = body.querySelector('#accDelBox');
  if (delBox) {
    const word = body.querySelector('#accDelWord'), pw = body.querySelector('#accDelPw'), go = body.querySelector('#accDelGo');
    const revisar = () => { go.disabled = !(word.value.trim() === 'ELIMINAR' && pw.value); };
    word.addEventListener('input', revisar); pw.addEventListener('input', revisar);
    on(body, '#accDel', 'click', () => { delBox.hidden = false; word.focus(); });
    on(body, '#accDelCancel', 'click', () => { delBox.hidden = true; word.value = ''; pw.value = ''; revisar(); });
    go.addEventListener('click', async () => {
      go.disabled = true; go.textContent = 'Eliminando…';
      try {
        await auth.deleteOwnAccount(pw.value);
        showToast('Cuenta eliminada');
        closeAccountModal();
      } catch (e) {
        errorEn(body, '#accDelErr', e && (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') ? 'La contraseña no es correcta.' : (e.code ? authErrorMsg(e) : (e.message || String(e))));
        go.textContent = 'Eliminar definitivamente'; revisar();
      }
    });
  }
}

// ── MANTENIMIENTO ──────────────────────────────────────────
function mantenimiento(body) {
  const cuenta = s => state.trades.filter(t => t.sheet === s).length;
  const de = inViewAs() ? `de la cuenta de <strong>${esc(quien())}</strong>` : 'de tu cuenta';
  let pendiente = null;
  const pintar = () => {
    body.innerHTML = `
      ${inViewAs() ? card(`<div class="acc-help">${ic('nota')} Acciones sobre <b>${esc(quien())}</b>: cualquier borrado afecta a SU cuenta, no a la tuya.</div>`, 'soft') : ''}
      <div class="acc-card-title out">Reimportar desde Apps Script</div>
      <div id="accReimport" class="acc-embed"></div>
      ${card(`
        ${fila('Borrar trades por estrategia', 'Elimina solo los trades de una estrategia. Útil para reimportar desde cero.',
          `<div class="pill-group">${EXPORT_SHEETS.map(s => `<button type="button" class="pill ${pendiente === s ? 'active' : ''}" data-wipe="${s}" ${cuenta(s) ? '' : 'disabled'}>${sheetLabel(s)} (${cuenta(s)})</button>`).join('')}</div>`)}
        ${pendiente ? `<div class="acc-inline"><div class="acc-confirm">¿Borrar los <b>${cuenta(pendiente)}</b> trades de <b>${sheetLabel(pendiente)}</b> ${de}? No se puede deshacer.
          <span class="acc-actions"><button type="button" class="btn" id="accWipeNo">Cancelar</button><button type="button" class="btn danger" id="accWipeYes">Sí, borrar ${cuenta(pendiente)}</button></span></div></div>` : ''}
        ${fila('Borrar todos los datos', `Elimina <strong>todos los trades</strong> (${state.trades.length}) ${de}. Esta acción no se puede deshacer. Escribe <strong>BORRAR</strong> para activarlo.`,
          `<div class="acc-row"><input class="form-input" id="accWipeWord" placeholder="BORRAR" autocomplete="off"><button type="button" class="btn danger" id="accWipeAll" disabled>Borrar todo</button></div>`)}
      `)}`;
    paintUrlTab(body.querySelector('#accReimport'));
    body.querySelectorAll('[data-wipe]').forEach(b => b.addEventListener('click', () => { pendiente = pendiente === b.dataset.wipe ? null : b.dataset.wipe; pintar(); }));
    on(body, '#accWipeNo', 'click', () => { pendiente = null; pintar(); });
    on(body, '#accWipeYes', 'click', () => {
      const s = pendiente, n = state.removeBySheet(s);
      pendiente = null; pintar();
      showToast(`${n} trades de ${sheetLabel(s)} eliminados`);
    });
    const word = body.querySelector('#accWipeWord'), all = body.querySelector('#accWipeAll');
    word.addEventListener('input', () => { all.disabled = word.value.trim() !== 'BORRAR'; });
    all.addEventListener('click', async () => {
      all.disabled = true;
      try {
        await sync.wipeAllTrades(targetUid());
        state.trades = []; state.emit();
        showToast('Todos los trades eliminados');
        pintar();
      } catch (e) { console.error(e); showToast('No se pudo borrar: ' + (e.message || e)); }
    });
  };
  pintar();
}

// ── SOBRE ──────────────────────────────────────────────────
function sobre(body) {
  const estrategias = new Set(state.trades.map(t => t.sheet)).size;
  body.innerHTML = card(`
    <div class="acc-about">
      <span class="acc-logo">${icon('globo')}</span>
      <div><div class="acc-name sm">Tradinverso · Trading Journal</div><div class="acc-user">Versión ${VERSION}</div></div>
    </div>
    <div class="card-sub">Trading journal en la nube · datos sincronizados con Firebase</div>
    <p class="acc-text">Toda la operativa se mide en porcentajes. Los importes monetarios reales se asignan por cuenta en la sección de gestión de cuentas. Tus datos viven en tu cuenta de Firestore y son privados: solo el admin de la academia puede verlos.</p>
    <div class="tro-stats about">
      <div class="tro-stat"><b>${state.trades.length}</b><span>trades en la nube</span></div>
      <div class="tro-stat"><b>${estrategias}</b><span>estrategias</span></div>
      <div class="tro-stat"><b>${VERSION}</b><span>versión</span></div>
    </div>
    <div class="acc-actions start">
      <a class="btn primary" href="${FORMACION_URL}" target="_blank" rel="noopener noreferrer">Formación ↗</a>
      <a class="btn" href="${CALENDARIO_URL}" target="_blank" rel="noopener noreferrer">Calendario económico ↗</a>
    </div>`);
}
