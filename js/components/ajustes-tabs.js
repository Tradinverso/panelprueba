import { ic } from './icons.js';
// Barra de pestañas de Importar ↔ Tabla. "Ajustes" ya no es una página: abre
// el pop-up de la cuenta (components/account-modal.js).
// Son enlaces de navegación (cada uno es su propia ruta/vista), marcando la
// activa. Mismo patrón que gestion-tabs (Cuentas/Riesgo).

export function ajustesTabs(active) {
  const tab = (id, path, label) =>
    `<a class="rg-tab ${active === id ? 'active' : ''}" href="${path}">${label}</a>`;
  return `
    <div class="rg-tabs gestion-tabs">
      <button type="button" class="rg-tab" data-account="datos">${ic('ajustes')} Ajustes</button>
      ${tab('importar', '#/importar', ic('descargar') + ' Importar')}
      ${tab('tabla', '#/tabla', ic('tabla') + ' Tabla')}
    </div>`;
}
