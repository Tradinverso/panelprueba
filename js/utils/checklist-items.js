// Checklist pre-sesión — puntos definidos por el coach, iguales para todos
// los alumnos. Para cambiarlos, edita esta lista (igual que protocolos-fijos).
// El estado (marcado/no) es local al navegador de cada alumno y se REACTIVA
// por tramos de sesión, no solo a diario (se opera en dos sesiones).

import { storage } from '../storage.js';
import { auth } from '../auth.js';
import { tzHourDiff } from './timezone.js';

export const CHECKLIST_ITEMS = [
  'He dormido bien',
  'Noticias del día revisadas',
  'Estado emocional OK',
  'Cuentas y gestión del riesgo revisadas',
  'Protocolo preoperativo hecho',
];

// Re-armados del checklist en HORA MADRID: apertura de Londres (7:30) y de
// Nueva York (14:00). Se trasladan al huso del alumno igual que las sesiones
// del diagnóstico. La medianoche LOCAL re-arma siempre (cambia la fecha).
const REARME_MADRID = [7.5, 14];

// Clave del tramo actual: 'YYYY-MM-DD|pN'. Completar el checklist vale para
// este tramo; al cruzar medianoche o un re-armado, la clave cambia y el
// checklist vuelve a "pendiente" aunque ya se hubiera hecho antes.
export function currentChecklistKey() {
  const now = new Date();
  const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const d = tzHourDiff('Europe/Madrid', auth.timezone());
  const bounds = REARME_MADRID
    .map(h => ((h + d) % 24 + 24) % 24)
    .sort((a, b) => a - b);
  const nowH = now.getHours() + now.getMinutes() / 60;
  let period = 0;
  for (const b of bounds) if (nowH >= b) period++;
  return `${dateKey}|p${period}`;
}

// ¿Está completo el checklist del tramo ACTUAL?
export function checklistCompleto() {
  const done = storage.getChecklist(currentChecklistKey());
  return CHECKLIST_ITEMS.every((_, i) => done[i]);
}
