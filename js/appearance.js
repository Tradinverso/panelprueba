// Apariencia: tema, acento, colores TP/SL, estilo de tarjeta, tipografía y
// densidad. Se aplica como atributos data-* en <html> (ver css/skins.css).
//
// Persistencia en dos sitios:
//  - localStorage: para que la pantalla de login y el primer pintado ya salgan
//    con el tema del usuario (antes de que Firestore responda).
//  - users/{uid}/config/data.appearance: por usuario, en la nube. app.js
//    conecta `onChange` con state.setConfig y aplica lo cargado al entrar.

import { storage } from './storage.js';
import { theme } from './theme.js';

const LS_KEY = 'tradinverso_appearance';

export const THEMES = {
  midnight:   { name: 'Midnight',           desc: 'Negro puro',                   dark: true,  frame: '#050506', bg: '#0c0c0e', card: '#151518' },
  onyx:       { name: 'Onyx',               desc: 'Marco negro, página gris',     dark: true,  frame: '#0d0d0f', bg: '#1b1b1f', card: '#25252a' },
  platinum:   { name: 'Platinum',           desc: 'Gris mate',                    dark: false, frame: '#cfcfd4', bg: '#e5e5e8', card: '#f6f6f7' },
  light:      { name: 'Light',              desc: 'Blanco limpio',                dark: false, frame: '#e9ecf4', bg: '#f4f6fb', card: '#ffffff' },
  glass:      { name: 'Liquid Glass',       desc: 'Cristal sobre luz de color',   dark: true,  glass: true,
                frame: 'radial-gradient(circle at 15% 0%, #1b2440 0%, #070a14 55%, #05060b 100%)', bg: '#0b1020', card: 'rgba(255,255,255,0.35)' },
  glassLight: { name: 'Liquid Glass claro', desc: 'Cristal sobre tonos pastel',   dark: false, glass: true,
                frame: 'linear-gradient(135deg, #e3e9ff 0%, #f3efff 45%, #e6fbf1 100%)', bg: '#ffffff', card: 'rgba(255,255,255,0.35)' },
};

export const ACCENTS = [
  { id: 'azul',      name: 'Azul TV',   c: '#3b82f6' },
  { id: 'cian',      name: 'Cian',      c: '#06b6d4' },
  { id: 'esmeralda', name: 'Esmeralda', c: '#10b981' },
  { id: 'ambar',     name: 'Ámbar',     c: '#f59e0b' },
  { id: 'violeta',   name: 'Violeta',   c: '#8b5cf6' },
  { id: 'mono',      name: 'Mono',      c: null },     // usa el color de texto
];

// [positivo, negativo] por esquema
export const PNL = {
  clasico:   { name: 'Clásico',   dark: ['#34d399', '#f87171'], light: ['#059669', '#dc2626'] },
  daltonico: { name: 'Daltónico', dark: ['#60a5fa', '#fb923c'], light: ['#1d4ed8', '#c2410c'] },
  mono:      { name: 'Mono',      dark: ['#f4f4f5', '#8b8b94'], light: ['#111827', '#6b7280'] },
};

export const FONTS = [
  { id: 'inter',     name: 'Inter',          family: "'Inter', system-ui, sans-serif" },
  { id: 'geist',     name: 'Geist',          family: "'Geist', 'Inter', system-ui, sans-serif" },
  { id: 'jetbrains', name: 'JetBrains Mono', family: "'JetBrains Mono', ui-monospace, monospace" },
  { id: 'fraunces',  name: 'Fraunces',       family: "'Fraunces', Georgia, serif" },
];

export const CARD_STYLES = [['degradado', 'Degradado'], ['solido', 'Sólido'], ['cristal', 'Cristal']];
export const DENSITIES = [['comfy', 'Cómodo'], ['compact', 'Compacto']];

export const NAV_STYLES = [['pill', 'Píldora'], ['flat', 'Plano']];

export const DEFAULTS = Object.freeze({
  theme: 'glass', accent: 'azul', pnl: 'clasico', cards: 'degradado', font: 'inter', density: 'comfy',
  nav: 'pill',      // barra superior: píldora o plana
  mesa: true,       // columna "Mesa" abierta (false = recogida en barrita)
  hidePnl: false,   // enmascarar importes y porcentajes de P&L
});

let prefs = { ...DEFAULTS };
const listeners = new Set();

function sanitize(p) {
  const out = { ...DEFAULTS };
  if (!p || typeof p !== 'object') return out;
  if (THEMES[p.theme]) out.theme = p.theme;
  if (ACCENTS.some(a => a.id === p.accent)) out.accent = p.accent;
  if (PNL[p.pnl]) out.pnl = p.pnl;
  if (CARD_STYLES.some(c => c[0] === p.cards)) out.cards = p.cards;
  if (FONTS.some(f => f.id === p.font)) out.font = p.font;
  if (DENSITIES.some(d => d[0] === p.density)) out.density = p.density;
  if (NAV_STYLES.some(n => n[0] === p.nav)) out.nav = p.nav;
  if (typeof p.mesa === 'boolean') out.mesa = p.mesa;
  if (typeof p.hidePnl === 'boolean') out.hidePnl = p.hidePnl;
  return out;
}

function readLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return sanitize(JSON.parse(raw));
  } catch (e) { /* corrupto → defaults */ }
  // Migración del ajuste antiguo (solo oscuro/claro): claro → Light,
  // oscuro → Liquid Glass (el nuevo tema por defecto).
  const legacy = storage.getTheme();
  return { ...DEFAULTS, theme: legacy === 'light' ? 'light' : 'glass' };
}

function writeLocal() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(prefs)); } catch (e) { /* sin espacio */ }
}

function applyDom() {
  const root = document.documentElement;
  const t = THEMES[prefs.theme];
  root.setAttribute('data-skin', prefs.theme);
  root.setAttribute('data-accent', prefs.accent);
  root.setAttribute('data-pnl', prefs.pnl);
  root.setAttribute('data-cards', prefs.cards);
  root.setAttribute('data-font', prefs.font);
  root.setAttribute('data-density', prefs.density);
  root.setAttribute('data-nav', prefs.nav);
  if (document.body) {
    document.body.classList.toggle('hide-pnl', !!prefs.hidePnl);
    document.body.classList.toggle('mesa-closed', !prefs.mesa);
  }
  // Esquema claro/oscuro: lo siguen leyendo las hojas antiguas y heatmap.js.
  theme.apply(t.dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t.bg);
}

export const appearance = {
  init() {
    prefs = readLocal();
    applyDom();
    installGlare();
  },
  get() { return { ...prefs }; },
  isDark() { return !!THEMES[prefs.theme].dark; },
  isGlass() { return !!THEMES[prefs.theme].glass; },
  // Aplica un parche y avisa (persistencia en nube vía onChange).
  set(patch, { silent = false } = {}) {
    const next = sanitize({ ...prefs, ...patch });
    const changed = Object.keys(next).some(k => next[k] !== prefs[k]);
    prefs = next;
    writeLocal();
    applyDom();
    if (changed && !silent) listeners.forEach(fn => fn(this.get()));
    return this.get();
  },
  // Al cargar la config del usuario desde la nube: aplica sin re-guardar.
  applyFromCloud(saved) {
    if (!saved || typeof saved !== 'object') return;
    this.set(saved, { silent: true });
  },
  reset() { return this.set({ ...DEFAULTS }); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // Resumen para la cabecera del panel: "Liquid Glass · Azul TV · Inter"
  summary() {
    const a = ACCENTS.find(x => x.id === prefs.accent);
    const f = FONTS.find(x => x.id === prefs.font);
    return `${THEMES[prefs.theme].name} · ${a ? a.name : ''} · ${f ? f.name : ''}`;
  },
  pnlColors() {
    const p = PNL[prefs.pnl] || PNL.clasico;
    return this.isDark() ? p.dark : p.light;
  },
};

// Brillo que sigue al ratón en las tarjetas KPI (temas glass). Un solo
// listener delegado: las tarjetas se re-crean en cada render.
let glareInstalled = false;
function installGlare() {
  if (glareInstalled) return;
  glareInstalled = true;
  document.addEventListener('mousemove', e => {
    if (!appearance.isGlass()) return;
    const card = e.target && e.target.closest ? e.target.closest('.kpi-card') : null;
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    card.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}
