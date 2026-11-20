// Ayuda dentro de la app (los textos viven en js/utils/ayuda.js):
//   · botón «?» junto al título de cada página principal → su ayuda;
//   · aviso al entrar: «Qué ha cambiado» (alumnos de antes) o «Primeros pasos»
//     (alumnos nuevos), cada vez que se entra hasta pulsar «No volver a mostrar»;
// La sección Ayuda de Ajustes usa htmlPrimerosPasos / htmlNovedades (utils/ayuda.js).

import { auth } from '../auth.js';
import { state } from '../state.js';
import { openModal } from './modal.js';
import { openAccountModal } from './account-modal.js';
import { esAntiguo } from '../utils/liquidez.js';
import { AYUDA_PAGINAS, ayudaDeRuta, PRIMEROS_PASOS, QUE_HA_CAMBIADO, AVISO_ID } from '../utils/ayuda.js';

// Abre Ajustes en la sección Ayuda; con `novedades`, baja hasta ellas.
export function abrirAyudaAjustes(novedades = false) {
  openAccountModal('ayuda');
  if (novedades) setTimeout(() => document.getElementById('accNovedades')?.scrollIntoView({ block: 'start' }), 60);
}

// ── Ayuda de una página ─────────────────────────────────────────────────────
function bloqueHtml(b) {
  return `<div class="ay-bloque">
    <h3>${b.t}</h3>
    ${b.p ? `<p>${b.p}</p>` : ''}
    ${b.lista ? `<ul>${b.lista.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
  </div>`;
}

export function abrirAyuda(clave) {
  const a = AYUDA_PAGINAS[clave];
  if (!a) return;
  openModal({
    title: `Ayuda · ${a.titulo}`,
    meta: a.intro,
    size: 'lg',
    body: `<div class="ay">${a.bloques.map(bloqueHtml).join('')}</div>`,
    actions: [
      { label: 'Primeros pasos y Novedades', onClick: close => { close(); abrirAyudaAjustes(); } },
      { label: 'Entendido', variant: 'primary', onClick: close => close() },
    ],
  });
}

// ── Botón «?» en el título de cada página ───────────────────────────────────
// Las vistas pintan su cabecera a su ritmo (algunas tras cargar datos), así
// que se vigila #view y se añade el botón en cuanto aparece el título.
function ponerBoton() {
  const view = document.getElementById('view');
  if (!view || !auth.currentUser) return;
  const clave = ayudaDeRuta(location.hash);
  const h1 = view.querySelector('.page-header h1');
  if (!h1) return;
  const actual = h1.querySelector('.ayuda-btn');
  if (actual && actual.dataset.ayuda === clave) return;
  if (actual) actual.remove();
  if (!clave) return;
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'ayuda-btn';
  b.dataset.ayuda = clave;
  b.title = `Ayuda: cómo funciona ${AYUDA_PAGINAS[clave].titulo}`;
  b.setAttribute('aria-label', b.title);
  b.textContent = '?';
  b.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); abrirAyuda(clave); });
  h1.appendChild(b);
}
let vigilando = false;
export function iniciarBotonesAyuda() {
  if (vigilando) return;
  const view = document.getElementById('view');
  if (!view || typeof MutationObserver !== 'function') return;
  vigilando = true;
  let pendiente = false;
  new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => { pendiente = false; ponerBoton(); });
  }).observe(view, { childList: true, subtree: true });
  window.addEventListener('hashchange', () => requestAnimationFrame(ponerBoton));
  ponerBoton();
}

// ── Aviso al entrar ────────────────────────────────────────────────────────
// Sale cada vez que el alumno entra en la app hasta que pulsa «No volver a
// mostrar», que se guarda en su perfil (profile.avisoOculto = AVISO_ID) para
// que valga en todos sus dispositivos. Un aviso nuevo = otro AVISO_ID.
// Alumno de antes del paso a producción (misma fecha de corte que Liquidez,
// js/utils/liquidez.js) → «Qué ha cambiado»; alumno nuevo → «Primeros pasos».
let avisoEnseñado = false;   // una vez por carga de la app

export function maybeShowAviso() {
  if (avisoEnseñado) return;
  if (!auth.currentUser || !auth.profile || auth.isAdmin()) return;
  if (state.viewAsUid) return;
  if (auth.profile.avisoOculto === AVISO_ID) return;
  // openModal() no apila: si ya hay otro aviso abierto (migración), espera a la
  // próxima entrada.
  const root = document.getElementById('modal-root');
  if (root && root.children.length) return;
  avisoEnseñado = true;

  const antiguo = esAntiguo(auth.profile);
  const puntos = antiguo ? QUE_HA_CAMBIADO : PRIMEROS_PASOS;
  openModal({
    title: antiguo ? 'Qué ha cambiado en el Trading Journal' : 'Primeros pasos en el Trading Journal',
    meta: antiguo
      ? 'Hemos renovado la app. Lo más importante, en corto:'
      : 'Tu rutina del primer día. Cada página tiene su botón <b>?</b> con la ayuda completa.',
    size: 'lg',
    body: `<div class="nov">${puntos.map(x => `
      <div class="nov-item"><span class="nov-dot"></span><div><b>${x.t}</b><p>${x.p}</p></div></div>`).join('')}
    </div>`,
    actions: [
      { label: 'Ver Novedades', onClick: close => { close(); abrirAyudaAjustes(true); } },
      { label: 'No volver a mostrar', onClick: close => {
        close();
        auth.ocultarAviso(AVISO_ID).catch(err => console.warn('No se pudo guardar el aviso:', err));
      } },
      { label: 'Cerrar', variant: 'primary', onClick: close => close() },
    ],
  });
}
