// Genera hoy.json para la columna "Hoy" de la app:
//   · news:     noticias de ALTO impacto de la semana (USD, EUR, GBP), del
//               export semanal público de Forex Factory.
//   · directos: próximas clases del calendario "Tradinverso Clases" (Google
//               Calendar), leído de su dirección iCal SECRETA, guardada en el
//               secreto CLASES_ICS_URL del repositorio. Solo se publican el
//               título y la hora — nunca enlaces ni descripciones.
// Lo ejecuta .github/workflows/datos-hoy.yml y lo publica en la rama `data`.
// La app lo lee de raw.githubusercontent.com (que sí permite CORS; las webs
// de origen no, por eso no se pueden leer desde el navegador).
//
// Si una fuente falla, se conserva lo último publicado de esa parte.

import fs from 'node:fs';

const REPO = process.env.GITHUB_REPOSITORY || 'Tradinverso/panelprueba';
const FF_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const PREV_URL = `https://raw.githubusercontent.com/${REPO}/data/hoy.json`;
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; panel-datos/1.0)' };
const DIVISAS = ['USD', 'EUR', 'GBP'];

async function previo() {
  try {
    const r = await fetch(PREV_URL, { headers: UA });
    if (r.ok) return await r.json();
  } catch (e) { /* primera ejecución: aún no existe */ }
  return null;
}

async function noticias() {
  const r = await fetch(FF_URL, { headers: UA });
  if (!r.ok) throw new Error('Forex Factory respondió ' + r.status);
  const d = await r.json();
  if (!Array.isArray(d)) throw new Error('formato inesperado');
  return d
    .filter(e => e && e.impact === 'High' && DIVISAS.includes(e.country))
    .map(e => ({
      t: new Date(e.date).toISOString(),
      cur: e.country,
      title: String(e.title || '').trim(),
      forecast: String(e.forecast || '').trim(),
      previous: String(e.previous || '').trim(),
    }))
    .filter(e => e.title && !isNaN(Date.parse(e.t)))
    .sort((a, b) => a.t.localeCompare(b.t));
}

// null = calendario sin configurar (no hay secreto).
async function directos() {
  const url = (process.env.CLASES_ICS_URL || '').trim();
  if (!url) return null;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error('el calendario respondió ' + r.status);
  const ics = await r.text();
  const { default: IcalExpander } = await import('ical-expander');
  const exp = new IcalExpander({ ics, maxIterations: 2000 });
  const desde = new Date(Date.now() - 2 * 3600e3);          // incluye el que está en curso
  const hasta = new Date(Date.now() + 21 * 86400e3);
  const { events, occurrences } = exp.between(desde, hasta);
  const todos = [
    ...events.map(e => ({ start: e.startDate, end: e.endDate, title: e.summary, comp: e.component })),
    ...occurrences.map(o => ({ start: o.startDate, end: o.endDate, title: o.item.summary, comp: o.item.component })),
  ];
  return todos
    .filter(x => x.start && !x.start.isDate)                 // fuera los de día completo
    .filter(x => String(x.comp?.getFirstPropertyValue?.('status') || '').toUpperCase() !== 'CANCELLED')
    .map(x => ({
      t: x.start.toJSDate().toISOString(),
      end: x.end ? x.end.toJSDate().toISOString() : null,
      title: String(x.title || 'Directo').trim().slice(0, 80),
    }))
    .sort((a, b) => a.t.localeCompare(b.t))
    .slice(0, 8);
}

const prev = await previo();
const out = { updatedAt: new Date().toISOString(), news: [], directos: [] };

try {
  out.news = await noticias();
  console.log(`noticias: ${out.news.length} de alto impacto`);
} catch (e) {
  console.warn('noticias: fallo, se conserva lo anterior ·', e.message);
  out.news = (prev && Array.isArray(prev.news)) ? prev.news : [];
}

try {
  const d = await directos();
  if (d === null) console.log('directos: sin configurar (falta el secreto CLASES_ICS_URL)');
  else console.log(`directos: ${d.length} próximos`);
  out.directos = d || [];
} catch (e) {
  console.warn('directos: fallo, se conserva lo anterior ·', e.message);
  out.directos = (prev && Array.isArray(prev.directos)) ? prev.directos : [];
}

fs.writeFileSync('hoy.json', JSON.stringify(out, null, 1));
console.log('hoy.json escrito');
