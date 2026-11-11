// "Ocultar P&L" (Apariencia → Paneles, o el enlace de la franja Pulso):
// enmascara TODOS los importes y porcentajes de P&L de la app con "•••" y
// "$•••" — KPIs, tablas, calendario, columna Hoy, tarjetas de cuenta… — para
// poder compartir pantalla sin enseñar resultados.
//
// Hay unos 200 sitios que pintan P&L, así que no se marca cada uno: mientras
// está activo, un observador repasa el texto que se va pintando y sustituye:
//   · importes en dólares:          $25,000 · -$999 · +$1,101 · 150–250 $
//   · porcentajes CON signo:        +73.5% · −8.0% · -1.05%
// Los porcentajes sin signo (winrate, adherencia, riesgo) NO son P&L y se
// dejan. Los gráficos se ocupan de sus ejes en charts.js (misma clase
// `hide-pnl` en <body>).
//
// Es destructivo sobre el texto pintado: al desactivarlo se repinta la vista
// (router.reload), que vuelve a generar los valores reales desde el estado.

import { appearance } from '../appearance.js';
import { router } from '../router.js';

const DINERO = /[+\-−]?\$\s?\d[\d.,]*(?:\s?[KkM]\b)?|\d[\d.,]*(?:\s?[–-]\s?\d[\d.,]*)?\s\$/g;
const PORCENTAJE = /[+\-−]\s?\d[\d.,]*\s?%/g;

// Dónde NO se toca nada: lo que escribe el usuario, formularios, textos del
// plan/protocolos/reflexiones, y datos que no son P&L aunque lleven signo.
const SALTAR = 'textarea, input, select, option, script, style, .md-content, .plan-read, .nt-form, .pill, .mesa-news, .mesa-rule, .mesa-rule-sub, .modal-body .form, [data-no-mask]';
const RAICES = ['view', 'mesa', 'modal-root'];

let observer = null;
let pendiente = false;

function enmascarar(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue;
      if (!v || (v.indexOf('$') === -1 && v.indexOf('%') === -1)) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest(SALTAR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodos = [];
  while (walker.nextNode()) nodos.push(walker.currentNode);
  for (const n of nodos) {
    const antes = n.nodeValue;
    const despues = antes.replace(DINERO, '$•••').replace(PORCENTAJE, '•••');
    if (despues !== antes) n.nodeValue = despues;
  }
}

function pasada() {
  pendiente = false;
  if (!appearance.get().hidePnl) return;
  for (const id of RAICES) enmascarar(document.getElementById(id));
}

function programar() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(pasada);
}

function activar() {
  if (!observer) {
    observer = new MutationObserver(programar);
    for (const id of RAICES) {
      const el = document.getElementById(id);
      if (el) observer.observe(el, { childList: true, subtree: true, characterData: true });
    }
  }
  pasada();
}

function desactivar() {
  if (observer) { observer.disconnect(); observer = null; }
}

// Pone el enmascarado de acuerdo con la preferencia actual (sin repintar).
export function syncPnlMask() {
  if (appearance.get().hidePnl) activar(); else desactivar();
}

// Arranque: sigue los cambios de la preferencia. Al cambiar se repinta la
// vista: al ocultar, para que los gráficos tapen sus ejes; al mostrar, para
// recuperar los valores reales.
export function initPnlMask() {
  let last = appearance.get().hidePnl;
  syncPnlMask();
  appearance.onChange(p => {
    if (p.hidePnl === last) return;
    last = p.hidePnl;
    syncPnlMask();
    router.reload();
  });
}
