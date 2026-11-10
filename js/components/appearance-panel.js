// Panel "Apariencia": cajón lateral derecho (440 px) para elegir tema,
// acento, colores TP/SL, estilo de tarjeta, tipografía y densidad.
// Todo se aplica al instante; la vista de debajo se repinta (los gráficos
// leen los colores del tema al crearse).

import { appearance, THEMES, ACCENTS, PNL, FONTS, CARD_STYLES, DENSITIES } from '../appearance.js';
import { router } from '../router.js';
import { showToast } from './toast.js';

let rootEl = null;
let reloadTimer = null;

function root() {
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'appearance-root';
    document.body.appendChild(rootEl);
  }
  return rootEl;
}

export function isAppearanceOpen() {
  return !!(rootEl && rootEl.firstChild);
}

export function openAppearancePanel() {
  render();
  document.addEventListener('keydown', onKey);
}

export function closeAppearancePanel() {
  if (rootEl) rootEl.innerHTML = '';
  document.removeEventListener('keydown', onKey);
}

function onKey(e) { if (e.key === 'Escape') closeAppearancePanel(); }

// Cambiar un ajuste → aplicar + repintar el panel (estado "on") + repintar la
// vista con un pequeño retardo (varios clics seguidos = un solo repintado).
function change(patch) {
  appearance.set(patch);
  render();
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => router.reload(), 180);
}

function render() {
  const p = appearance.get();
  const dark = appearance.isDark();
  const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();

  const themeOpts = Object.entries(THEMES).map(([id, t]) => `
    <button type="button" class="ap-opt ${p.theme === id ? 'on' : ''}" data-set="theme" data-val="${id}">
      <span class="ap-thumb"><span class="f" style="background:${t.frame}"></span><span class="p" style="background:${t.bg}"><span class="c" style="background:${t.card}"></span></span></span>
      <span class="ap-name">${t.name}</span>
      <span class="ap-desc">${t.desc}</span>
    </button>`).join('');

  const accentOpts = ACCENTS.map(a => `
    <button type="button" class="ap-chip ${p.accent === a.id ? 'on' : ''}" data-set="accent" data-val="${a.id}" style="--ap-c:${a.c || textColor}">
      <span class="dot"></span>${a.name}
    </button>`).join('');

  const pnlOpts = Object.entries(PNL).map(([id, m]) => {
    const [pos, neg] = dark ? m.dark : m.light;
    return `
    <button type="button" class="ap-opt ${p.pnl === id ? 'on' : ''}" data-set="pnl" data-val="${id}">
      <span class="ap-swatch"><span style="background:${pos}"></span><span style="background:${neg}"></span></span>
      <span class="ap-name" style="font-size:12px">${m.name}</span>
    </button>`;
  }).join('');

  const seg = (key, list) => `<div class="ap-seg">${list.map(([id, name]) =>
    `<button type="button" class="${p[key] === id ? 'on' : ''}" data-set="${key}" data-val="${id}">${name}</button>`).join('')}</div>`;

  const fontOpts = FONTS.map(f => `
    <button type="button" class="ap-opt ${p.font === f.id ? 'on' : ''}" data-set="font" data-val="${f.id}">
      <span class="ap-font-sample" style="font-family:${f.family}">+73.0%</span>
      <span class="ap-desc">${f.name}</span>
    </button>`).join('');

  const glassNote = appearance.isGlass()
    ? `<div class="ap-desc" style="font-size:11px;color:var(--muted)">En los temas Liquid Glass manda siempre la tarjeta de cristal.</div>` : '';

  root().innerHTML = `
    <div class="appearance-overlay" data-close>
      <div class="appearance-panel" role="dialog" aria-label="Apariencia">
        <div class="ap-head">
          <div>
            <h2>Apariencia</h2>
            <div class="ap-summary">${appearance.summary()}</div>
          </div>
          <button type="button" class="ap-close" aria-label="Cerrar" data-close>×</button>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Tema</div>
          <div class="ap-grid2">${themeOpts}</div>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Color de acento</div>
          <div class="ap-chips">${accentOpts}</div>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Colores de TP / SL</div>
          <div class="ap-grid3">${pnlOpts}</div>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Tarjetas</div>
          ${seg('cards', CARD_STYLES)}
          ${glassNote}
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Tipo de letra</div>
          <div class="ap-grid2">${fontOpts}</div>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Densidad</div>
          ${seg('density', DENSITIES)}
        </div>

        <button type="button" class="ap-reset" data-reset>Restaurar los de serie</button>
      </div>
    </div>
  `;

  const overlay = root().querySelector('.appearance-overlay');
  let downOnBackdrop = false;
  overlay.addEventListener('mousedown', e => { downOnBackdrop = (e.target === overlay); });
  overlay.addEventListener('click', e => {
    const btn = e.target.closest('[data-set]');
    if (btn) { change({ [btn.dataset.set]: btn.dataset.val }); return; }
    if (e.target.closest('[data-reset]')) {
      appearance.reset();
      render();
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => router.reload(), 180);
      showToast('Apariencia restaurada');
      return;
    }
    if (e.target.closest('.ap-close')) { closeAppearancePanel(); return; }
    if (e.target === overlay && downOnBackdrop) closeAppearancePanel();
  });
}
