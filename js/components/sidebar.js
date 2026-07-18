import { theme } from '../theme.js';
import { router } from '../router.js';
import { state } from '../state.js';
import { auth } from '../auth.js';
import { storage } from '../storage.js';
import { tzLabel } from '../utils/timezone.js';
import { countDangerAlerts } from '../utils/diagnostics.js';
import { icon } from './icons.js';
import { STRATEGY_ROUTES } from './strategy-tabs.js';
import { PSICO_ROUTES } from './psicotrading-tabs.js';

const STRATEGY_ROUTES_LIST = Object.values(STRATEGY_ROUTES);
const PSICO_ROUTES_LIST = Object.values(PSICO_ROUTES);

// hideInViewAs: oculto cuando admin está viendo/editando a un alumno
// (Ajustes muestra info personal del admin, así que no tiene sentido).
// Importar y Nuevo trade SÍ se permiten — admin puede dar de alta datos a alumnos.
// Lista PLANA de módulos (sin cabeceras de sección). Varios agrupan sub-vistas
// con pestañas internas (Estrategias, Cuentas·Riesgo, Psicotrading).
const NAV_BASE = [
  { path: '#/dashboard',  label: 'Dashboard',   icon: 'dashboard', class: '' },
  { path: '#/nuevo',      label: 'Nuevo trade', icon: 'nuevo', class: '' },
  { path: '#/calendario', label: 'Calendario',  icon: 'calendario', class: '' },
  // Las 3 estrategias son un único ítem: dentro se cambia con pestañas.
  { path: '#/zonas', label: 'Estrategias', icon: 'zonas', class: '', match: STRATEGY_ROUTES_LIST },
  // Lo analítico va junto tras Estrategias: primero Diagnóstico, luego Psicotrading.
  // dangerAlerts: badge rojo con el nº de alertas críticas del diagnóstico.
  { path: '#/diagnostico', label: 'Diagnóstico', icon: 'diagnostico', class: '', dangerAlerts: true },
  // Psicotrading agrupa Reflexiones + Meditaciones + Protocolos (pestañas dentro).
  { path: '#/psicologia', label: 'Psicotrading', icon: 'reflexiones', class: '', match: PSICO_ROUTES_LIST },
  // Después, la gestión del dinero: Cuentas (agrupa Cuentas + Riesgo) y Contabilidad aparte.
  { path: '#/cuentas',      label: 'Cuentas',      icon: 'cuentas', class: '', countActiveCuentas: true, match: ['#/cuentas', '#/riesgo'] },
  { path: '#/contabilidad', label: 'Contabilidad', icon: 'contabilidad', class: '' },
  { path: '#/plan',        label: 'Plan de trading', icon: 'plan', class: '' },
  // Ajustes (engloba Importar y Tabla como pestañas) se renderiza aparte, en el pie.
];

// Rutas que "viven dentro" de Ajustes (pestañas): marcan activo el ítem Ajustes.
const AJUSTES_ROUTES = ['#/ajustes', '#/importar', '#/tabla'];

// Calendario económico del botón "Noticias" (la fuente se elige en Ajustes).
const NEWS_URLS = {
  investing: 'https://es.investing.com/economic-calendar',
  forexfactory: 'https://www.forexfactory.com/calendar',
};

// Herramientas de admin (solo el coach). Sin cabecera de sección; se separan del
// resto con un hairline (primer ítem lleva la clase 'nav-admin-first').
const NAV_ADMIN = [
  { path: '#/admin', label: 'Mis Alumnos',    icon: 'alumnos', class: 'nav-admin-first' },
  { path: '#/grupo', label: 'Stats grupales', icon: 'grupo', class: '' },
];

let unsubAuth = null;
let unsubState = null;

export function renderSidebar(container) {
  if (!container) return;

  // Suscripciones a auth (nombre/role) y state (contadores de trades, modo readOnly)
  if (!unsubAuth)  unsubAuth  = auth.on(() => renderSidebar(container));
  if (!unsubState) unsubState = state.on(() => renderSidebar(container));

  if (!auth.currentUser) {
    container.innerHTML = '';
    return;
  }

  const current = router.current();
  const counts = countsBySheet();
  const inViewAs = !!state.viewAsUid;

  // En viewAs solo ocultamos Ajustes (muestra info del admin). Importar y
  // Nuevo trade siguen visibles porque admin puede dar de alta datos a alumnos.
  // Módulo de Riesgo: visible salvo que el usuario lo haya desactivado.
  const riskOn = !(state.config && state.config.riskModuleEnabled === false);
  let nav = NAV_BASE.filter(item => (!inViewAs || !item.hideInViewAs) && (!item.riskModule || riskOn));
  if (auth.isAdmin()) nav = nav.concat(NAV_ADMIN);

  const initial = (auth.displayName() || '?').charAt(0).toUpperCase();
  const collapsed = storage.getSidebarCollapsed();

  // Indicador de contexto: a quién pertenece la vista actual.
  // Si admin está en viewAs → "Viendo a [Alumno]" con icono y opción de volver.
  // Si normal → solo el nombre del usuario.
  const viewingContext = inViewAs && state.viewAsProfile
    ? `<div class="brand-context viewing-as">
         <div class="bc-label">VIENDO A</div>
         <div class="bc-name">${escapeHtml(state.viewAsProfile.nombre || state.viewAsProfile.email)}</div>
         <button class="bc-exit" id="exitViewAsTopBtn" title="Volver a tu cuenta">${icon('volver')} Volver</button>
       </div>`
    : `<div class="brand-context">
         <div class="bc-name-self">${escapeHtml(auth.displayName())}</div>
       </div>`;

  container.innerHTML = `
    <a href="${auth.isAdmin() && !inViewAs ? '#/admin' : '#/dashboard'}" class="brand" title="Tradinverso">
      <div class="brand-logo">${icon('globo')}</div>
      <div class="brand-text">
        <span class="brand-line2">TRADINVERSO</span>
        <span class="brand-line1">Trading Journal</span>
        <span class="brand-ver">v.2.1</span>
      </div>
    </a>
    <div class="sidebar-tools">
      <button class="sidebar-tool" id="sidebarCollapse" title="${collapsed ? 'Desplegar menú' : 'Plegar menú'}" aria-label="${collapsed ? 'Desplegar menú' : 'Plegar menú'}">${icon('colapsar')}</button>
      <button class="sidebar-tool" id="themeToggle" title="Cambiar tema (claro/oscuro)" aria-label="Cambiar tema">${theme.current() === 'dark' ? icon('luna') : icon('sol')}</button>
    </div>
    ${auth.hasTimezone()
      ? `<a class="user-tz" href="#/ajustes" title="Zona horaria: ${escapeHtml(tzLabel(auth.timezone()))} · pulsa para cambiarla">${icon('reloj')}<span>${escapeHtml(tzLabel(auth.timezone()))}</span></a>`
      : `<a class="user-tz warn" href="#/ajustes" title="Configura tu zona horaria">${icon('aviso')}<span>Configura tu zona horaria</span></a>`}
    ${viewingContext}
    <nav class="nav">
      ${nav.map(item => {
        if (item.section) return `<div class="nav-section">${item.section}</div>`;
        // `match`: ítems que agrupan varias rutas (Estrategias) se marcan activos
        // con cualquiera de ellas.
        const isActive = item.match ? item.match.includes(current) : item.path === current;
        const active = isActive ? 'active' : '';
        let meta = '';
        if (item.sheet) {
          meta = `<span class="nav-meta">${counts[item.sheet] || 0}</span>`;
        } else if (item.countActiveCuentas) {
          const n = state.cuentas.filter(c => c.status === 'activa').length;
          meta = n ? `<span class="nav-meta">${n}</span>` : '';
        } else if (item.dangerAlerts) {
          const n = countDangerAlerts(state.trades);
          meta = n ? `<span class="nav-meta danger" title="${n} alerta${n > 1 ? 's' : ''} crítica${n > 1 ? 's' : ''}">${n}</span>` : '';
        }
        return `
          <a href="${item.path}" class="nav-item ${item.class} ${active}" title="${escapeHtml(item.label)}">
            <span class="nav-icon">${icon(item.icon)}</span>
            <span class="nav-label">${item.label}</span>
            ${meta}
          </a>`;
      }).join('')}
    </nav>
    <a class="formacion-cta" href="https://tradinverso.thinkific.com/enrollments" target="_blank" rel="noopener noreferrer" title="Formación · cursos y directos">
      <span class="fc-icon">${icon('formacion')}</span>
      <span class="fc-text"><strong>Formación</strong><small>Cursos · directos · más</small></span>
      <span class="fc-arrow">↗</span>
    </a>
    <a class="nav-item" href="${NEWS_URLS[storage.getNewsSource()]}" target="_blank" rel="noopener noreferrer" title="Calendario económico (cambia la fuente en Ajustes)">
      <span class="nav-icon">${icon('noticias')}</span>
      <span class="nav-label">Noticias</span>
    </a>
    <a href="#/ajustes" class="nav-item ${AJUSTES_ROUTES.includes(current) ? 'active' : ''}" title="Ajustes · Importar · Tabla">
      <span class="nav-icon">${icon('ajustes')}</span>
      <span class="nav-label">Ajustes</span>
    </a>
    <div class="user-block">
      <div class="user-avatar">${escapeHtml(initial)}</div>
      <div class="user-info">
        <div class="user-name">${escapeHtml(auth.displayName())}</div>
        <div class="user-email">${escapeHtml(auth.currentUser.email)}</div>
      </div>
      <button class="user-logout" id="logoutBtn" title="Cerrar sesión">${icon('salir')}</button>
    </div>
  `;

  // Menú plegado: se aplica en <body> para que el grid del shell reaccione.
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const collapseBtn = container.querySelector('#sidebarCollapse');
  if (collapseBtn) collapseBtn.addEventListener('click', () => {
    storage.setSidebarCollapsed(!collapsed);
    renderSidebar(container);   // re-render: refresca el estado y el tooltip
  });

  container.querySelector('#themeToggle').addEventListener('click', () => {
    theme.toggle();
    // Re-render de la vista actual: los charts leen los colores del tema al
    // crearse, así que sin esto quedarían pintados con el tema anterior.
    // El propio sidebar se refresca vía router.onChange.
    router.reload();
  });
  container.querySelector('#logoutBtn').addEventListener('click', async () => {
    try { await auth.signOut(); } catch (e) { console.error(e); }
  });
  const exitBtn = container.querySelector('#exitViewAsTopBtn');
  if (exitBtn) {
    exitBtn.addEventListener('click', async () => {
      await state.exitViewAs();
      router.go('#/admin');
    });
  }
}

function countsBySheet() {
  const c = { ZONAS: 0, LIQUIDEZ: 0, NASDAQ: 0 };
  for (const t of state.trades) if (c[t.sheet] != null) c[t.sheet]++;
  return c;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
