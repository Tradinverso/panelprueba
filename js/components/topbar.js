// Barra superior: logo + navegación horizontal en píldora (agrupada con
// separadores finos: Operativa · Análisis · Gestión · Academia) + reloj en el
// huso del alumno + Apariencia + Ajustes + avatar. Sustituye a la barra
// lateral de navegación (rediseño de nov 2026); la columna izquierda es ahora
// la "Mesa" (mesa.js).

import { router } from '../router.js';
import { state } from '../state.js';
import { auth } from '../auth.js';
import { IS_TEST_ENV } from '../firebase.js';
import { tzLabel } from '../utils/timezone.js';
import { countDangerAlerts } from '../utils/diagnostics.js';
import { appearance } from '../appearance.js';
import { icon } from './icons.js';
import { openAppearancePanel } from './appearance-panel.js';
import { STRATEGY_ROUTES } from './strategy-tabs.js';
import { PSICO_ROUTES } from './psicotrading-tabs.js';
import { BACKTEST_ROUTES } from './backtest-tabs.js';

const STRATEGY_ROUTES_LIST = Object.values(STRATEGY_ROUTES);
const PSICO_ROUTES_LIST = Object.values(PSICO_ROUTES);
const BACKTEST_ROUTES_LIST = Object.values(BACKTEST_ROUTES);

// Varios ítems agrupan sub-vistas con pestañas internas (Estrategias,
// Cuentas·Riesgo, Psicotrading, Backtesting): `match` las marca activas.
const NAV_BASE = [
  { group: 'Operativa', path: '#/dashboard',  label: 'Dashboard' },
  { group: 'Operativa', path: '#/nuevo',      label: 'Nuevo trade' },
  { group: 'Operativa', path: '#/calendario', label: 'Calendario' },
  { group: 'Operativa', path: '#/zonas',      label: 'Estrategias', match: STRATEGY_ROUTES_LIST },
  // dangerAlerts: badge rojo con el nº de alertas críticas del diagnóstico.
  { group: 'Análisis',  path: '#/diagnostico', label: 'Diagnóstico', dangerAlerts: true },
  { group: 'Análisis',  path: '#/bt-zonas',    label: 'Backtesting', match: BACKTEST_ROUTES_LIST },
  { group: 'Análisis',  path: '#/psicologia',  label: 'Psicotrading', match: PSICO_ROUTES_LIST },
  { group: 'Análisis',  path: '#/plan',        label: 'Plan' },
  { group: 'Gestión',   path: '#/cuentas',      label: 'Cuentas', countActiveCuentas: true, match: ['#/cuentas', '#/riesgo', '#/riesgo-futuros'] },
  { group: 'Gestión',   path: '#/contabilidad', label: 'Contabilidad' },
];
// Solo el coach.
const NAV_ADMIN = [
  { group: 'Academia', path: '#/admin', label: 'Mis Alumnos' },
  { group: 'Academia', path: '#/grupo', label: 'Stats grupales' },
];
// Gestor de alumnos (alumno con permiso para dar de alta): solo el listado.
const NAV_GESTOR = [
  { group: 'Academia', path: '#/alumnos', label: 'Alumnos' },
];
// Rutas que "viven dentro" de Ajustes (pestañas): marcan activo el engranaje.
export const AJUSTES_ROUTES = ['#/importar', '#/tabla'];

let unsubAuth = null;
let unsubState = null;

// Hora actual en el huso del usuario (si aún no lo configuró, la del navegador).
export function clockParts() {
  const d = new Date();
  const opts = auth.hasTimezone() ? { timeZone: auth.timezone() } : {};
  try {
    const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', hour12: !!appearance.get().hour12, ...opts }).format(d);
    const fecha = new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short', ...opts }).format(d);
    const ddmm = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', ...opts }).format(d).replace('/', '.');
    return { hora, fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), ddmm };
  } catch (e) {
    return { hora: d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }), fecha: d.toLocaleDateString('es-ES'), ddmm: '' };
  }
}

// El reloj avanza sin re-render: un único intervalo actualiza los textos.
setInterval(() => {
  const c = clockParts();
  document.querySelectorAll('[data-clock-hora]').forEach(el => { el.textContent = c.hora; });
  document.querySelectorAll('[data-clock-fecha]').forEach(el => { el.textContent = c.fecha; });
}, 15000);

// Encaje de la barra en UNA fila. Lo que cabe depende del rol (el admin tiene
// más apartados), de "Ver como", de la letra elegida y del ancho de pantalla,
// así que se mide en vez de fiarlo a un ancho fijo:
//   1) todo en una fila;  2) si no cabe → modo compacto (Apariencia solo
//   icono, reloj sin fecha, logo sin texto);  3) si aun así no cabe → el botón
//   del usuario se queda en el avatar;  4) y si tampoco → la navegación baja
//   a una segunda fila centrada.
// En móvil (< 900 px) manda la hoja de estilos (navegación con scroll).
function fitTopbar(el) {
  if (!el || !el.firstChild) return;
  el.classList.remove('tb-compact', 'tb-mini', 'tb-wrap');
  if (window.innerWidth < 900) return;
  const noCabe = () => el.scrollWidth > el.clientWidth + 1;
  if (!noCabe()) return;
  el.classList.add('tb-compact');          // Apariencia solo icono, reloj sin fecha, logo sin texto
  if (!noCabe()) return;
  el.classList.add('tb-mini');             // el botón del usuario se queda en el avatar
  if (noCabe()) el.classList.add('tb-wrap');
}
let fitTimer = null;
const refit = () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => fitTopbar(document.getElementById('topbar')), 80); };
window.addEventListener('resize', refit);
// Además del resize de ventana, cualquier cambio de ANCHO de la propia barra
// (abrir/cerrar paneles del navegador, zoom…). Solo el ancho: el alto cambia
// al pasar a dos filas y no debe volver a disparar el encaje.
if (typeof ResizeObserver === 'function') {
  let lastW = 0;
  const ro = new ResizeObserver(entries => {
    const w = Math.round(entries[0].contentRect.width);
    if (w !== lastW) { lastW = w; refit(); }
  });
  const attach = () => { const el = document.getElementById('topbar'); if (el) ro.observe(el); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach); else attach();
}
// Las fuentes web cambian los anchos al terminar de cargar.
if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

function initials(name) {
  const parts = String(name || '').trim().split(/[\s._-]+/).filter(Boolean);
  if (!parts.length) return '·';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export function renderTopbar(container) {
  if (!container) return;
  if (!unsubAuth)  unsubAuth  = auth.on(() => renderTopbar(container));
  if (!unsubState) unsubState = state.on(() => renderTopbar(container));

  if (!auth.currentUser) { container.innerHTML = ''; return; }

  const current = router.current();
  const inViewAs = !!state.viewAsUid;
  let nav = NAV_BASE.slice();
  if (auth.isAdmin()) nav = nav.concat(NAV_ADMIN);
  else if (auth.isGestor()) nav = nav.concat(NAV_GESTOR);

  const home = auth.isAdmin() && !inViewAs ? '#/admin' : '#/dashboard';
  const name = inViewAs && state.viewAsProfile
    ? (state.viewAsProfile.nombre || state.viewAsProfile.email)
    : auth.displayName();
  const clock = clockParts();
  const tz = auth.hasTimezone() ? tzLabel(auth.timezone()) : 'Configura tu zona horaria';

  const items = nav.map((item, i) => {
    const isActive = item.match ? item.match.includes(current) : item.path === current;
    const sep = i > 0 && nav[i - 1].group !== item.group
      ? `<span class="tb-sep" aria-hidden="true" title="${escapeHtml(item.group)}"></span>` : '';
    let badge = '';
    if (item.countActiveCuentas) {
      const n = state.cuentas.filter(c => c.status === 'activa').length;
      if (n) badge = `<span class="tb-badge">${n}</span>`;
    } else if (item.dangerAlerts) {
      const n = countDangerAlerts(state.trades);
      if (n) badge = `<span class="tb-badge danger" title="${n} alerta${n > 1 ? 's' : ''} crítica${n > 1 ? 's' : ''}">${n}</span>`;
    }
    return `${sep}<a href="${item.path}" class="tb-item ${isActive ? 'active' : ''}" title="${escapeHtml(item.group)}">${escapeHtml(item.label)}${badge}</a>`;
  }).join('');

  container.innerHTML = `
    <a href="${home}" class="tb-brand" title="Tradinverso">
      <span class="tb-logo">${icon('globo')}</span>
      <span class="tb-brand-text">Tradinverso${IS_TEST_ENV ? ' <b class="tb-test">PRUEBAS</b>' : ''}</span>
    </a>
    <nav class="tb-nav" aria-label="Secciones">${items}</nav>
    <div class="tb-right">
      ${inViewAs ? `<button type="button" class="tb-viewas" id="tbExitViewAs" title="Estás viendo a este alumno · pulsa para volver a tu cuenta">${icon('volver')} <span>Viendo a <strong>${escapeHtml(name)}</strong></span></button>` : ''}
      <button type="button" class="tb-clock ${auth.hasTimezone() ? '' : 'warn'}" data-account="perfil" title="${escapeHtml(tz)} · pulsa para cambiar la zona horaria">
        ${icon(auth.hasTimezone() ? 'reloj' : 'aviso')}
        <span class="tb-clock-hora" data-clock-hora>${clock.hora}</span>
        <span class="tb-clock-fecha" data-clock-fecha>${clock.fecha}</span>
      </button>
      <button type="button" class="tb-tool tb-appearance" id="tbAppearance" title="Apariencia · tema, colores y letra" aria-label="Apariencia"><span class="tb-dot"></span><span class="tb-appearance-txt">Apariencia</span></button>
      <button type="button" class="tb-user" data-account="perfil" title="Tu cuenta y ajustes" aria-haspopup="dialog">
        <span class="tb-user-av">${escapeHtml(initials(name))}</span>
        <span class="tb-user-name">${escapeHtml(name)}</span>
        <span class="tb-user-chev" aria-hidden="true">▾</span>
      </button>
    </div>
  `;

  fitTopbar(container);
  container.querySelector('#tbAppearance').addEventListener('click', () => openAppearancePanel());
  const exitBtn = container.querySelector('#tbExitViewAs');
  if (exitBtn) exitBtn.addEventListener('click', async () => {
    await state.exitViewAs();
    router.go('#/admin');
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
