// Cortacircuitos de riesgo (módulo opcional, se activa en la cuenta →
// Módulos): al apuntar el primer SL del día en una cuenta, la app marca una
// pausa de 5 minutos con cuenta atrás antes del siguiente trade.
// No bloquea nada: es un recordatorio visible para no reentrar en caliente.

const KEY = 'tradinverso_breaker_until';
const PAUSA_MS = 5 * 60 * 1000;
let el = null;
let timer = null;

const hasta = () => { try { return Number(localStorage.getItem(KEY)) || 0; } catch (e) { return 0; } };

function pintar() {
  const quedan = hasta() - Date.now();
  if (quedan <= 0) {
    if (el) { el.remove(); el = null; }
    if (timer) { clearInterval(timer); timer = null; }
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = 'tv-breaker';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="tv-breaker-dot"></span><span><b>Cortacircuitos</b> · pausa tras el SL · <b data-t></b></span><button type="button" aria-label="Quitar la pausa">×</button>`;
    el.querySelector('button').addEventListener('click', clearBreaker);
    document.body.appendChild(el);
  }
  const s = Math.ceil(quedan / 1000);
  el.querySelector('[data-t]').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  if (!timer) timer = setInterval(pintar, 1000);
}

export function armBreaker() {
  try { localStorage.setItem(KEY, String(Date.now() + PAUSA_MS)); } catch (e) { /* sin almacenamiento: no hay pausa */ }
  pintar();
}

export function clearBreaker() {
  try { localStorage.removeItem(KEY); } catch (e) { /* nada */ }
  pintar();
}

// Si se recarga la página en mitad de la pausa, la cuenta atrás sigue.
export function initBreaker() { pintar(); }
