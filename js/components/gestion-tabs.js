import { ic } from './icons.js';
// Barra de pestañas de la sección operativa: Cuentas · Riesgo CFD · Riesgo
// Futuros. Son enlaces de navegación (cada uno es su propia ruta/vista).
// CFD y Futuros son gestiones de riesgo distintas, cada una con su pestaña; se
// ocultan según Ajustes → Módulos (state.riesgoActivo). Mismo tamaño grande
// que las pestañas de Estrategias y Backtesting (strat-tabs).

import { state } from '../state.js';

export const RIESGO_ROUTES = { CFD: '#/riesgo', Futuros: '#/riesgo-futuros' };

export function gestionTabs(active) {
  const tab = (id, href, label) =>
    `<a class="rg-tab ${active === id ? 'active' : ''}" href="${href}">${label}</a>`;
  return `
    <div class="rg-tabs gestion-tabs strat-tabs">
      ${tab('cuentas', '#/cuentas', ic('banco') + ' Cuentas')}
      ${state.riesgoActivo('CFD') ? tab('riesgo', RIESGO_ROUTES.CFD, ic('escudo') + ' Riesgo CFD') : ''}
      ${state.riesgoActivo('Futuros') ? tab('riesgo-futuros', RIESGO_ROUTES.Futuros, ic('escudo') + ' Riesgo Futuros') : ''}
    </div>`;
}
