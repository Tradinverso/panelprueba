// Esquema claro/oscuro (data-theme). Desde el rediseño de nov 2026 lo decide
// el tema elegido en Apariencia (js/appearance.js): este módulo solo mantiene
// el atributo, el valor en localStorage y los listeners que ya existían.
import { storage } from './storage.js';

let current = 'dark';
const listeners = new Set();

export const theme = {
  apply(t) {
    current = t === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', current);
    storage.setTheme(current);
    listeners.forEach(fn => fn(current));
  },
  current() { return current; },
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};
