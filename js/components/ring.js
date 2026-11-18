// Ruedas (donuts y anillos de progreso) en SVG, con el mismo estilo en toda la
// app: cada tramo es un arco independiente con los extremos redondeados, hay un
// hueco transparente entre tramos y cada arco lleva un degradado suave de su
// propio color (más claro arriba, más oscuro abajo). El anillo es fino para que
// el texto del centro respire; ese texto lo pone quien llama, encima del SVG.
//
//   ringSvg({ segments: [{ value, color, label }] })  → rueda de varios tramos
//   ringSvg({ progress: 0.65, color })                → anillo de progreso (0–1)
//
// Los colores son CSS (var(--green)…): el degradado se hace con color-mix, así
// que sigue al tema. Un tramo muy pequeño nunca desaparece: se le reserva lo
// justo para verse como un punto redondo sin tocar el hueco de al lado.

let uid = 0;
const R0 = 50;                       // centro del viewBox 100×100

const claro = c => `color-mix(in srgb, ${c} 74%, #fff)`;
const oscuro = c => `color-mix(in srgb, ${c} 84%, #000)`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function punto(r, th) {
  const a = th - Math.PI / 2;        // 0 = arriba, sentido horario
  return [(R0 + r * Math.cos(a)).toFixed(3), (R0 + r * Math.sin(a)).toFixed(3)];
}
function arco(r, t0, t1) {
  if (t1 - t0 >= Math.PI * 2 - 1e-6) return null;      // vuelta entera: círculo
  const [x0, y0] = punto(r, t0), [x1, y1] = punto(r, t1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${t1 - t0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * @param {object} o
 * @param {{value:number,color:string,label?:string}[]} [o.segments]
 * @param {number} [o.progress]   0–1, anillo de un solo valor sobre un carril gris
 * @param {string} [o.color]      color del anillo de progreso
 * @param {number} [o.width=8]    grosor, en unidades del viewBox (100 = diámetro)
 * @param {number} [o.gap=7]      hueco entre tramos, en grados
 * @param {string} [o.className]
 */
export function ringSvg({ segments, progress, color = 'var(--accent)', width = 8, gap = 7, className = '' } = {}) {
  const id = 'rg' + (++uid);
  const r = R0 - width / 2 - 0.5;
  const C = 2 * Math.PI * r;
  const defs = [];
  const capas = [];
  const grad = (c) => {
    const gid = `${id}g${defs.length}`;
    defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="100">
      <stop offset="0" style="stop-color:${claro(c)}"/><stop offset="1" style="stop-color:${oscuro(c)}"/></linearGradient>`);
    return `url(#${gid})`;
  };
  const trazo = (d, c, title) => d
    ? `<path d="${d}" fill="none" stroke="${grad(c)}" stroke-width="${width}" stroke-linecap="round">${title ? `<title>${esc(title)}</title>` : ''}</path>`
    : `<circle cx="${R0}" cy="${R0}" r="${r}" fill="none" stroke="${grad(c)}" stroke-width="${width}">${title ? `<title>${esc(title)}</title>` : ''}</circle>`;
  const carril = `<circle cx="${R0}" cy="${R0}" r="${r}" fill="none" stroke="var(--ring-track, var(--line))" stroke-width="${width}"/>`;

  if (segments == null) {
    // Anillo de progreso
    const p = Math.max(0, Math.min(1, +progress || 0));
    capas.push(carril);
    if (p > 0) {
      const t1 = Math.max(p * Math.PI * 2, 0.0005);   // un valor mínimo se ve como un punto
      capas.push(trazo(arco(r, 0, t1), color));
    }
  } else {
    const segs = segments.filter(s => s && s.value > 0);
    const total = segs.reduce((a, s) => a + s.value, 0);
    if (!total) capas.push(carril);
    else if (segs.length === 1) capas.push(trazo(null, segs[0].color, segs[0].label));
    else {
      const gapRad = gap * Math.PI / 180;
      const tapa = width / r;                          // lo que añaden las dos puntas redondas
      // Hueco reservado para cada tramo: al menos su punto redondo y un margen.
      const minRad = tapa + gapRad + 0.04;
      let fr = segs.map(s => s.value / total * Math.PI * 2);
      const faltan = fr.map(f => Math.max(0, minRad - f));
      const deuda = faltan.reduce((a, b) => a + b, 0);
      if (deuda > 0) {
        const mayor = fr.indexOf(Math.max(...fr));
        fr = fr.map((f, i) => f + faltan[i] - (i === mayor ? deuda : 0));
      }
      let t = 0;
      segs.forEach((s, i) => {
        const t0 = t + (gapRad + tapa) / 2;
        const t1 = Math.max(t0 + 0.0005, t + fr[i] - (gapRad + tapa) / 2);
        capas.push(trazo(arco(r, t0, t1), s.color, s.label));
        t += fr[i];
      });
    }
  }
  return `<svg class="ring-svg ${className}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs>${defs.join('')}</defs>${capas.join('')}</svg>`;
}

// Hueco interior libre (diámetro en px) de una rueda de `size` px con este grosor:
// para comprobar que el texto del centro cabe.
export const huecoInterior = (size, width = 8) => size * (100 - 2 * width - 1) / 100;
