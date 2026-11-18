// Barra de pestañas que unifica las estrategias en una sola sección.
// Son enlaces de navegación (cada estrategia sigue siendo su propia ruta/vista),
// marcando la activa. Mismo patrón que gestion-tabs y ajustes-tabs.
// Cada pestaña activa lleva el color de su estrategia.

import { STRATEGIES, SHEETS, sheetsVisibles } from '../utils/strategy-config.js';

export const STRATEGY_ROUTES = Object.fromEntries(SHEETS.map(k => [k, STRATEGIES[k].route]));

export function strategyTabs(active) {
  return `
    <div class="rg-tabs gestion-tabs strat-tabs">
      ${sheetsVisibles().map(k => {
        const meta = STRATEGIES[k] || { label: k };
        const on = active === k;
        return `<a class="rg-tab ${on ? 'active' : ''}" href="${STRATEGY_ROUTES[k]}"
                   ${on && meta.color ? `style="--tab-accent:${meta.color};"` : ''}>${meta.label}</a>`;
      }).join('')}
    </div>`;
}
