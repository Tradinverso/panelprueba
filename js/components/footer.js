// Pie de página: versión · Formación · Ajustes.
// (Antes vivían en la barra lateral.) Sin interruptor "Journal real |
// Backtesting": Backtesting ya está en la barra superior. El calendario
// económico se abre desde la caja de noticias de la columna "Hoy".

import { auth } from '../auth.js';
import { icon } from './icons.js';

export function renderFooter(container) {
  if (!container) return;
  if (!auth.currentUser) { container.innerHTML = ''; return; }
  container.innerHTML = `
    <span class="ft-ver">Trading Journal v.2.5</span>
    <a class="ft-link" href="https://tradinverso.thinkific.com/enrollments" target="_blank" rel="noopener noreferrer" title="Cursos y directos">${icon('formacion')} Formación ↗</a>
    <button type="button" class="ft-link" data-account="preferencias">${icon('ajustes')} Ajustes</button>
  `;
}
