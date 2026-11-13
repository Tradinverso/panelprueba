// Regla del día: un aviso al abrir la app, una vez al día. Antes vivía en una
// caja de la columna "Hoy"; se sacó de ahí para que la columna quepa entera sin
// scroll. En días alternos, en lugar de la regla sale una lección que el propio
// alumno escribió al cerrar un día (diario del trader).
//
// Se puede apagar en Ajustes → Módulos (config.reglaDiaria === false).

import { auth } from '../auth.js';
import { state } from '../state.js';
import { openModal } from './modal.js';
import { reglaDelDia } from '../utils/reglas-del-dia.js';
import { hoy, leccionDeHoy } from '../utils/diario.js';

const CLAVE = 'tradinverso_regla_vista';   // día en que se enseñó por última vez, en este navegador
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const reglaDiariaActiva = () => !(state.config && state.config.reglaDiaria === false);

export function maybeShowRegla() {
  if (!auth.currentUser) return;
  if (state.viewAsUid || state.readOnly) return;
  if (!reglaDiariaActiva()) return;
  const dia = hoy();
  try { if (localStorage.getItem(CLAVE) === dia) return; } catch (e) { return; }

  // openModal() no apila: si ya hay otro aviso abierto (migración, novedades),
  // se deja para la próxima vez que se abra la app hoy.
  const root = document.getElementById('modal-root');
  if (root && root.children.length) return;

  try { localStorage.setItem(CLAVE, dia); } catch (e) { /* sin almacenamiento: saldrá otra vez */ }
  mostrarRegla();
}

// También se puede abrir a mano (botón "Ver la de hoy" en Ajustes → Módulos).
export function mostrarRegla() {
  const leccion = leccionDeHoy();
  const regla = reglaDelDia();
  openModal({
    title: leccion ? 'Una lección tuya' : 'Regla del día',
    body: `<div class="regla-aviso">
      <div class="regla-aviso-t">${esc(leccion ? leccion.texto : regla.main)}</div>
      <div class="regla-aviso-s">${esc(leccion ? `La escribiste el ${leccion.dia.split('-').reverse().join('/')}.` : regla.sub)}</div>
    </div>`,
    actions: [{ label: 'Entendido', variant: 'primary', onClick: close => close() }],
  });
}
