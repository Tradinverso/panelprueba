// Aviso de novedades: se enseña UNA vez por cuenta al entrar tras un cambio
// grande (aquí, el rediseño), para que el alumno no se encuentre la app
// cambiada sin explicación.
//
// "Visto" se guarda en la cuenta (config.novedadesVista), no en el navegador:
// no se repite al entrar desde otro dispositivo. Para anunciar otra tanda de
// cambios basta con cambiar NOVEDADES_ID y la lista.
//
// No se enseña: al admin, viendo la cuenta de un alumno ("Ver como"), ni a las
// cuentas recién creadas (no conocieron el diseño anterior; se marcan como
// vistas sin mostrar nada).

import { state } from '../state.js';
import { auth } from '../auth.js';
import { openModal } from './modal.js';
import { openAppearancePanel } from './appearance-panel.js';

export const NOVEDADES_ID = '2026-11-rediseno';

const NOVEDADES = [
  ['Diseño nuevo', 'El menú pasa arriba, agrupado en Operativa, Análisis y Gestión. Tus trades, cuentas y reflexiones siguen exactamente igual.'],
  ['Columna «Hoy»', 'A la izquierda: checklist pre-sesión, noticias de alto impacto de la semana, próximos directos con su enlace y tus cuentas. Se abre y se cierra con la flecha.'],
  ['Nuevo trade más rápido', 'Una fila por campo, botones TP / SL / BE que rellenan el resultado y un resumen que se actualiza mientras escribes.'],
  ['Apariencia a tu gusto', 'Tema claro u oscuro, color de acento, colores de TP/SL (incluida paleta para daltonismo), letra y densidad.'],
  ['Ocultar P&L', 'Tapa importes y porcentajes de toda la app para compartir pantalla sin enseñar resultados.'],
  ['Plan de trading', 'Tu documento de Drive y tu plan escrito, uno al lado del otro.'],
];

export function maybeShowNovedades() {
  if (!auth.currentUser || auth.isAdmin()) return;
  if (state.viewAsUid || state.readOnly) return;
  const cfg = state.config || {};
  if (cfg.novedadesVista === NOVEDADES_ID) return;

  // Cuenta sin nada dentro: es nueva, no hay "antes" que explicar.
  const vacia = !state.trades.length && !(state.cuentas || []).length;
  if (vacia) { state.setConfig({ novedadesVista: NOVEDADES_ID }); return; }

  // openModal() no apila: si ya hay otro aviso abierto (migración), se deja
  // para la próxima entrada.
  const root = document.getElementById('modal-root');
  if (root && root.children.length) return;

  // Se da por visto al enseñarlo: se cierre como se cierre, no vuelve a salir.
  state.setConfig({ novedadesVista: NOVEDADES_ID });

  openModal({
    title: 'Novedades del Trading Journal',
    meta: 'Hemos renovado la app. Esto es lo que cambia:',
    body: `<div class="nov">${NOVEDADES.map(([t, d]) => `
      <div class="nov-item"><span class="nov-dot"></span><div><b>${t}</b><p>${d}</p></div></div>`).join('')}
    </div>`,
    actions: [
      { label: 'Abrir Apariencia', onClick: close => { close(); openAppearancePanel(); } },
      { label: 'Entendido', variant: 'primary', onClick: close => close() },
    ],
  });
}
