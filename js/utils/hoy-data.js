// Datos públicos de la columna "Hoy": noticias de alto impacto de la semana y
// próximos directos de la formación. Los genera una tarea de GitHub
// (.github/workflows/datos-hoy.yml) y los deja en la rama `data` del repo de
// pruebas; desde ahí se leen con CORS abierto. Son iguales para todos los
// usuarios (no llevan nada personal) y los usan pruebas y producción.
//
// Caché: memoria + localStorage, 30 min. Si la descarga falla se sigue
// enseñando lo último que hubiera; si nunca hubo nada, la columna
// simplemente no muestra esos bloques.

const DATA_URL = 'https://raw.githubusercontent.com/Tradinverso/panelprueba/data/hoy.json';
const LS_KEY = 'tradinverso_hoy_data';
const TTL_MS = 30 * 60 * 1000;

let mem = null;          // { at, data }
let inflight = null;
const listeners = new Set();

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY));
    if (raw && raw.data && typeof raw.at === 'number') return raw;
  } catch (e) { /* corrupto */ }
  return null;
}

function valid(d) {
  return d && typeof d === 'object' && Array.isArray(d.news) && Array.isArray(d.directos);
}

async function refresh() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const r = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      if (!valid(d)) throw new Error('formato');
      mem = { at: Date.now(), data: d };
      try { localStorage.setItem(LS_KEY, JSON.stringify(mem)); } catch (e) { /* sin espacio */ }
      listeners.forEach(fn => { try { fn(d); } catch (e) { console.error(e); } });
    } catch (e) {
      // Sin red o aún sin publicar: se reintenta pasado un rato, no en cada render.
      if (mem) mem.at = Date.now() - TTL_MS + 5 * 60 * 1000;
      else mem = { at: Date.now() - TTL_MS + 5 * 60 * 1000, data: null };
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

// Devuelve lo que haya (puede ser null la primera vez) y, si está caducado,
// lanza la descarga en segundo plano; al llegar avisa a los suscritos.
export function getHoyData() {
  if (!mem) mem = readLocal();
  if (!mem || Date.now() - mem.at > TTL_MS) refresh();
  return mem ? mem.data : null;
}

export function onHoyData(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// ── Ayudas de fecha en el huso del usuario ──
function ymd(date, tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
  catch (e) { return date.toISOString().substring(0, 10); }
}
export function horaEn(iso, tz) {
  try { return new Intl.DateTimeFormat('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); }
  catch (e) { return new Date(iso).toISOString().substring(11, 16); }
}
export function diaCortoEn(iso, tz) {
  try {
    const s = new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'short', day: 'numeric' }).format(new Date(iso));
    return s.charAt(0).toUpperCase() + s.slice(1).replace('.', '');
  } catch (e) { return new Date(iso).toISOString().substring(5, 10); }
}

// Noticias de HOY (en el huso del usuario) y la siguiente a partir de mañana.
export function noticiasDeHoy(data, tz, now = new Date()) {
  if (!data) return { hoy: [], proxima: null };
  const hoyStr = ymd(now, tz);
  const hoy = data.news.filter(n => ymd(new Date(n.t), tz) === hoyStr);
  const proxima = data.news.find(n => ymd(new Date(n.t), tz) > hoyStr) || null;
  return { hoy, proxima };
}

// Noticias de hoy en adelante, agrupadas por día (en el huso del usuario):
// [{ label: 'Jue 12', esHoy, items: [...] }]
export function noticiasDeLaSemana(data, tz, now = new Date()) {
  if (!data) return [];
  const hoyStr = ymd(now, tz);
  const grupos = new Map();
  for (const n of data.news) {
    const dia = ymd(new Date(n.t), tz);
    if (dia < hoyStr) continue;
    if (!grupos.has(dia)) grupos.set(dia, { label: diaCortoEn(n.t, tz), esHoy: dia === hoyStr, items: [] });
    grupos.get(dia).items.push(n);
  }
  return [...grupos.values()];
}

// Próximos directos: los que no han terminado todavía (o empezaron hace < 90 min).
export function proximosDirectos(data, max = 3, now = new Date()) {
  if (!data) return [];
  return data.directos
    .filter(d => {
      const fin = d.end ? Date.parse(d.end) : Date.parse(d.t) + 90 * 60000;
      return fin > now.getTime();
    })
    .slice(0, max);
}
