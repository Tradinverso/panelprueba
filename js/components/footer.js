// Pie de página: Formación · Calendario económico · Ajustes · versión.
// (Antes vivían en la barra lateral.) Sin interruptor "Journal real |
// Backtesting": Backtesting ya está en la barra superior.

import { auth } from '../auth.js';
import { storage } from '../storage.js';
import { icon } from './icons.js';

// Calendario económico (la fuente se elige en Ajustes).
export const NEWS_URLS = {
  investing: 'https://es.investing.com/economic-calendar',
  forexfactory: 'https://www.forexfactory.com/calendar',
};

export function renderFooter(container) {
  if (!container) return;
  if (!auth.currentUser) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span class="ft-ver">Trading Journal v.2.5</span>
    <a class="ft-link" href="https://tradinverso.thinkific.com/enrollments" target="_blank" rel="noopener noreferrer" title="Cursos y directos">${icon('formacion')} Formación ↗</a>
    <a class="ft-link" href="${NEWS_URLS[storage.getNewsSource()]}" target="_blank" rel="noopener noreferrer" title="Noticias · la fuente se cambia en Ajustes">${icon('noticias')} Calendario económico ↗</a>
    <a class="ft-link" href="#/ajustes">${icon('ajustes')} Ajustes</a>
  `;
}
