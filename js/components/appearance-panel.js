// Panel "Apariencia": cajón lateral derecho (440 px) para elegir tema,
// acento, colores TP/SL, estilo de tarjeta, tipografía y densidad.
// Todo se aplica al instante; la vista de debajo se repinta (los gráficos
// leen los colores del tema al crearse).

import { appearance, THEMES, ACCENTS, PNL, FONTS, CARD_STYLES, DENSITIES, NAV_STYLES } from '../appearance.js';
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

// Cambiar un ajuste → aplicar + repintar quien lo muestra (el panel rápido o la
// sección Preferencias del pop-up de la cuenta) + repintar la vista con un
// pequeño retardo (varios clics seguidos = un solo repintado).
// router.reload() también repinta barra superior, Mesa y pie (router.onChange).
function apply(patch, rerender) {
  appearance.set(patch);
  rerender();
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => router.reload(), 180);
}

// Clic sobre cualquier control de apariencia. Devuelve true si lo ha tratado.
export function handleAppearanceClick(e, rerender) {
  const btn = e.target.closest('[data-set]');
  if (btn) { apply({ [btn.dataset.set]: btn.dataset.val }, rerender); return true; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) { apply({ [tg.dataset.toggle]: !appearance.get()[tg.dataset.toggle] }, rerender); return true; }
  if (e.target.closest('[data-reset]')) {
    appearance.reset();
    rerender();
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => router.reload(), 180);
    showToast('Apariencia restaurada');
    return true;
  }
  return false;
}

// Todos los controles (tema, acento, TP/SL, tarjetas, letra, barra, densidad,
// paneles y restaurar). Lo pintan el panel rápido y el pop-up de la cuenta.
export function appearanceBodyHtml() {
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

  const toggle = (key, label, on) => `
    <div class="ap-row">
      <span>${label}</span>
      <button type="button" class="ap-switch ${on ? 'on' : ''}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${label}" data-toggle="${key}"><span></span></button>
    </div>`;

  const fontOpts = FONTS.map(f => `
    <button type="button" class="ap-opt ${p.font === f.id ? 'on' : ''}" data-set="font" data-val="${f.id}">
      <span class="ap-font-sample" style="font-family:${f.family}">+73.0%</span>
      <span class="ap-desc">${f.name}</span>
    </button>`).join('');

  const glassNote = appearance.isGlass()
    ? `<div class="ap-desc" style="font-size:11px;color:var(--muted)">En los temas Liquid Glass manda siempre la tarjeta de cristal.</div>` : '';

  return `
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

        <div class="ap-grid2" style="gap:14px">
          <div class="ap-sec">
            <div class="ap-sec-title">Barra superior</div>
            ${seg('nav', NAV_STYLES)}
          </div>
          <div class="ap-sec">
            <div class="ap-sec-title">Densidad</div>
            ${seg('density', DENSITIES)}
          </div>
        </div>

        <div class="ap-sec">
          <div class="ap-sec-title">Paneles</div>
          ${toggle('mesa', 'Columna «Hoy» abierta', p.mesa)}
          ${toggle('hidePnl', 'Ocultar importes de P&L', p.hidePnl)}
        </div>

        <button type="button" class="ap-reset" data-reset>Restaurar los de serie</button>
  `;
}

function render() {
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
        ${appearanceBodyHtml()}
      </div>
    </div>
  `;

  const overlay = root().querySelector('.appearance-overlay');
  let downOnBackdrop = false;
  overlay.addEventListener('mousedown', e => { downOnBackdrop = (e.target === overlay); });
  overlay.addEventListener('click', e => {
    if (handleAppearanceClick(e, render)) return;
    if (e.target.closest('.ap-close')) { closeAppearancePanel(); return; }
    if (e.target === overlay && downOnBackdrop) closeAppearancePanel();
  });
}
