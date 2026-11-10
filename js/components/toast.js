// Toast de confirmación: píldora centrada abajo ("Trade guardado", "Plan guardado"…).
// Solo uno a la vez; se cierra solo a los 3 s o con la ×.

let el = null;
let timer = null;

export function showToast(msg, { duration = 3000 } = {}) {
  if (!el) {
    el = document.createElement('div');
    el.className = 'tv-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span class="tv-toast-msg"></span><button type="button" aria-label="Cerrar">×</button>`;
    el.querySelector('button').addEventListener('click', hideToast);
    document.body.appendChild(el);
  }
  el.querySelector('.tv-toast-msg').textContent = msg;
  el.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(hideToast, duration);
}

export function hideToast() {
  if (el) el.classList.remove('show');
  clearTimeout(timer);
}
