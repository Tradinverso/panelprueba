// Checklist pre-sesión. Hay una lista de Tradinverso (la que definió el coach)
// y cada alumno puede cambiarla por la suya: se guarda en su cuenta
// (config.checklist) y le sigue a cualquier dispositivo.
// El estado (marcado/no) es local al navegador de cada alumno y se REACTIVA
// por tramos de sesión, no solo a diario (se opera en dos sesiones).

import { storage } from '../storage.js';
import { auth } from '../auth.js';
import { state } from '../state.js';
import { tzHourDiff } from './timezone.js';

// daily: true → se responde UNA vez al día, en el primer checklist que se haga
// (en el tramo que sea); ya no vuelve a salir en las siguientes sesiones.
// daily: false → se repite en cada tramo (Londres y NY re-arman).
export const CHECKLIST_ITEMS = [
  { id: 'd0', text: 'He dormido bien', daily: true },
  { id: 'd1', text: 'Noticias del día revisadas', daily: false },
  { id: 'd2', text: 'Estado emocional OK', daily: false },
  { id: 'd3', text: 'Cuentas y gestión del riesgo revisadas', daily: false },
  { id: 'd4', text: 'Protocolo preoperativo hecho', daily: false },
];
export const CHECKLIST_MAX = 12;       // puntos como mucho
export const CHECKLIST_TEXTO_MAX = 90; // caracteres por punto

// Deja una lista en condiciones: textos recortados, sin vacíos, con id.
export function limpiarChecklist(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  return lista
    .filter(x => x && typeof x.text === 'string' && x.text.trim())
    .slice(0, CHECKLIST_MAX)
    .map((x, i) => {
      let id = String(x.id || '').replace(/[^\w-]/g, '').slice(0, 24) || `c${i}`;
      while (vistos.has(id)) id += 'x';
      vistos.add(id);
      return { id, text: x.text.trim().replace(/\s+/g, ' ').slice(0, CHECKLIST_TEXTO_MAX), daily: x.daily === true };
    });
}

// La lista en uso: la del alumno si tiene una, y si no la de Tradinverso.
export function checklistItems() {
  const propia = limpiarChecklist(state.config && state.config.checklist);
  return propia.length ? propia : CHECKLIST_ITEMS;
}
export const checklistEsPropia = () => limpiarChecklist(state.config && state.config.checklist).length > 0;

// Guarda la lista del alumno (o vuelve a la de Tradinverso con `null`). Las
// marcas se guardan por POSICIÓN, así que las de ahora se recolocan para que
// lo ya marcado hoy siga marcado aunque se reordene o se borre algún punto.
export function guardarChecklist(nueva) {
  const antes = checklistItems();
  const despues = nueva == null ? CHECKLIST_ITEMS : limpiarChecklist(nueva);
  const tramoKey = currentChecklistKey(), dailyKey = dailyChecklistKey();
  const tramo = storage.getChecklist(tramoKey), daily = storage.getChecklist(dailyKey);
  const marcado = new Map(antes.map((it, i) => [it.id, !!(it.daily ? daily[i] : tramo[i])]));
  storage.setChecklist(tramoKey, despues.map(it => !it.daily && !!marcado.get(it.id)));
  storage.setChecklist(dailyKey, despues.map(it => it.daily && !!marcado.get(it.id)));
  state.setConfig({ checklist: nueva == null ? null : despues });
}

// Re-armados del checklist en HORA MADRID: apertura de Londres (7:30) y de
// Nueva York (14:00). Se trasladan al huso del alumno igual que las sesiones
// del diagnóstico. La medianoche LOCAL re-arma siempre (cambia la fecha).
const REARME_MADRID = [7.5, 14];

// Fecha y hora ACTUALES en el huso del perfil del alumno (no el del navegador:
// si viaja o usa un PC con otro huso, los re-armados dispararían a deshora
// porque los límites sí están convertidos al huso del perfil).
function nowInUserTz() {
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: auth.timezone(), hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(d);
    const get = t => (parts.find(p => p.type === t) || {}).value;
    return {
      date: `${get('year')}-${get('month')}-${get('day')}`,
      hour: (+get('hour') % 24) + (+get('minute')) / 60,
    };
  } catch (e) {
    // Huso inválido o no configurado → hora local del navegador
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      hour: d.getHours() + d.getMinutes() / 60,
    };
  }
}

// Clave del tramo actual: 'YYYY-MM-DD|pN'. Completar el checklist vale para
// este tramo; al cruzar medianoche o un re-armado, la clave cambia y el
// checklist vuelve a "pendiente" aunque ya se hubiera hecho antes.
export function currentChecklistKey() {
  const now = nowInUserTz();
  const d = tzHourDiff('Europe/Madrid', auth.timezone());
  const bounds = REARME_MADRID
    .map(h => ((h + d) % 24 + 24) % 24)
    .sort((a, b) => a - b);
  let period = 0;
  for (const b of bounds) if (now.hour >= b) period++;
  return `${now.date}|p${period}`;
}

// Clave de los puntos DIARIOS (ej. "he dormido bien"): una por día natural.
export function dailyChecklistKey() {
  return `${nowInUserTz().date}|daily`;
}

// ¿Está completo el checklist ACTUAL? Cada punto se comprueba en su ámbito:
// los diarios contra la clave del día, los de sesión contra la del tramo.
export function checklistCompleto() {
  const p = checklistProgress();
  return p.done === p.total;
}

// Puntos marcados / total del checklist actual (botón "Checklist n/5" y anillo
// de la Mesa recogida).
export function checklistProgress() {
  const items = checklistItems();
  const tramo = storage.getChecklist(currentChecklistKey());
  const daily = storage.getChecklist(dailyChecklistKey());
  const done = items.filter((it, i) => (it.daily ? daily[i] : tramo[i])).length;
  return { done, total: items.length };
}
