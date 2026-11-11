// Chart.js wrappers — each destroys any chart on the canvas before creating a new one
// Charts are destroyed via Chart.getChart(canvas)?.destroy() to avoid memory leaks on re-render.
// Estilo "Glass Command Center": degradados, curvas suaves, barras redondeadas,
// tooltips de cristal. Solo estética — datos y firmas intactos.

const READ = key => getComputedStyle(document.documentElement).getPropertyValue(key).trim();

// Desactivar la animación de Chart.js globalmente. El motor de animación daba
// "this._fn is not a function" y dejaba el gráfico en blanco hasta refrescar.
// Sin animación, cada gráfico se dibuja entero y al instante (más fiable).
if (typeof Chart !== 'undefined') Chart.defaults.animation = false;

// Convierte un color (#rgb / #rrggbb) a rgba con alpha. Si ya es rgb/rgba lo deja.
function rgba(color, a) {
  const c = (color || '').trim();
  if (c.startsWith('rgb')) return c;
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  if (isNaN(n)) return c;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Degradado vertical para rellenos de área / barras.
function vGrad(canvas, color, a0, a1) {
  const ctx = canvas.getContext('2d');
  const h = canvas.clientHeight || canvas.height || 240;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, rgba(color, a0));
  g.addColorStop(1, rgba(color, a1));
  return g;
}

// Degradado vertical entre DOS colores sólidos (para los aros del donut).
function grad2(canvas, c0, c1) {
  const ctx = canvas.getContext('2d');
  const h = canvas.clientHeight || canvas.height || 200;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

// Con un tema nuevo (data-skin) las etiquetas van en la letra de la interfaz;
// en el tema clásico se mantiene DM Mono.
const hasSkin = () => document.documentElement.hasAttribute('data-skin');
const uiFont = () => hasSkin() ? (READ('--font') || "'Inter', sans-serif") : "'DM Mono', monospace";

// Radio de barra según el signo: redondeada por el lado que crece desde el 0.
const BAR_RADIUS = v => v >= 0
  ? { topLeft: 12, topRight: 12, bottomLeft: 4, bottomRight: 4 }
  : { topLeft: 4, topRight: 4, bottomLeft: 12, bottomRight: 12 };

function defaults() {
  Chart.defaults.color = READ('--muted');
  Chart.defaults.borderColor = READ('--border');
  Chart.defaults.font.family = uiFont();
  Chart.defaults.font.size = 11;
  // Tooltips de cristal, legibles (cuerpo en Inter)
  const tt = Chart.defaults.plugins.tooltip;
  tt.backgroundColor = rgba(READ('--card'), 0.92);
  tt.titleColor = READ('--text-strong');
  tt.bodyColor = READ('--text');
  tt.borderColor = READ('--glass-border');
  tt.borderWidth = 1;
  tt.cornerRadius = 10;
  tt.padding = 10;
  tt.titleFont = { family: READ('--font') || "'Inter', sans-serif", weight: '600', size: 12 };
  tt.bodyFont = { family: READ('--font') || "'Inter', sans-serif", size: 12 };
  tt.usePointStyle = true;
}

// Fechas 'YYYY-MM-DD' → 'dd/mm' en el eje X (las etiquetas largas no caben).
const shortDate = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? `${v.slice(8, 10)}/${v.slice(5, 7)}` : v;

// Valor encima (o debajo) de cada barra: 10 px, negrita, del color de la barra.
const BAR_VALUES = {
  id: 'tvBarValues',
  afterDatasetsDraw(chart, _args, opts) {
    const fmt = opts && opts.fmt ? opts.fmt : (v => v);
    const { ctx } = chart;
    const GREEN = READ('--green'), RED = READ('--red');
    ctx.save();
    ctx.font = `700 10px ${uiFont()}`;
    ctx.textAlign = 'center';
    chart.data.datasets.forEach((ds, di) => {
      if (!chart.isDatasetVisible(di)) return;
      const meta = chart.getDatasetMeta(di);
      meta.data.forEach((bar, i) => {
        const v = ds.data[i];
        if (v == null || isNaN(v)) return;
        ctx.fillStyle = v >= 0 ? GREEN : RED;
        ctx.textBaseline = v >= 0 ? 'bottom' : 'top';
        ctx.fillText(fmt(v), bar.x, v >= 0 ? bar.y - 4 : bar.y + 4);
      });
    });
    ctx.restore();
  },
};

// Eje X tenue (sin líneas verticales), eje Y con rejilla suave.
function softScales(yFmt) {
  return {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true, callback(v) { return shortDate(this.getLabelForValue(v)); } }, border: { display: false } },
    y: { ticks: yFmt ? { callback: yFmt } : {}, grid: { color: READ('--border') }, border: { display: false } },
  };
}

export function createEquity(canvas, datasets, opts = {}) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const GREEN = READ('--green'), Z = READ('--zonas'), L = READ('--liquidez'), N = READ('--nasdaq');
  const palette = { ALL: GREEN, ZONAS: Z, LIQUIDEZ: L, NASDAQ: N, PORT: READ('--cyan') };
  const fmt = typeof opts.formatter === 'function' ? opts.formatter : (v => v.toFixed(1) + '%');
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: datasets.map(d => {
        const primary = d.key === 'ALL' || d.key === 'PORT';
        const color = palette[d.key] || GREEN;
        const last = (d.data || []).length - 1;
        return {
          label: d.label,
          data: d.data,
          borderColor: color,
          backgroundColor: primary ? vGrad(canvas, color, 0.30, 0) : 'transparent',
          tension: 0.35,
          // Punto solo al final de cada línea (relleno tarjeta, borde del color)
          pointRadius: ctx => ctx.dataIndex === last ? 4 : 0,
          pointBackgroundColor: READ('--card'),
          pointBorderColor: color,
          pointBorderWidth: 2,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: color,
          pointHoverBorderColor: rgba(color, 0.3),
          pointHoverBorderWidth: 6,
          borderWidth: primary ? 3 : 2,
          borderDash: primary ? [] : [5, 5],
          fill: primary,
        };
      }),
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y)}` } },
      },
      scales: softScales(fmt),
    },
  });
}

export function createDonut(canvas, tp, sl, be) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const DIM = READ('--dim');
  // El centro va vacío a propósito: el WR y el nº de trades ya se muestran
  // arriba en la tarjeta, no hace falta repetirlos dentro del aro.
  // Aros anchos con degradado; se descartan segmentos a 0 (sin punto flotante).
  const defs = [
    { v: tp, label: 'TP', color: grad2(canvas, READ('--donut-tp-1'), READ('--donut-tp-2')) },
    { v: sl, label: 'SL', color: grad2(canvas, READ('--donut-sl-1'), READ('--donut-sl-2')) },
    { v: be, label: 'BE', color: rgba(DIM, 0.55) },
  ].filter(d => d.v > 0);
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: defs.map(d => d.label),
      datasets: [{
        data: defs.map(d => d.v),
        backgroundColor: defs.map(d => d.color),
        borderWidth: 0,
        spacing: defs.length > 1 ? 4 : 0,
        hoverOffset: 6,
        borderRadius: 22,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '64%',
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw}` } } },
    },
  });
}

export function createBar(canvas, labels, data, opts = {}) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const GREEN = READ('--green'), RED = READ('--red');
  // Degradado vertical color → color al 25 %; radio grande por el lado que crece.
  const colors = data.map(v => v >= 0 ? vGrad(canvas, GREEN, 1, 0.25) : vGrad(canvas, RED, 0.25, 1));
  const fmt = typeof opts.formatter === 'function' ? opts.formatter : (v => v + '%');
  const { formatter, ...restOpts } = opts;
  return new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: ctx => BAR_RADIUS(ctx.raw), borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.82 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 16, bottom: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y)}` } },
        tvBarValues: { fmt: v => (v > 0 ? '+' : '') + fmt(v) },
      },
      scales: softScales(fmt),
      ...restOpts,
    },
    plugins: [BAR_VALUES],
  });
}

export function createHourBar(canvas, hourData) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const GREEN = READ('--green'), RED = READ('--red'), BLUE = READ('--cyan');
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: hourData.map(h => h.label),
      datasets: [
        {
          label: 'WR %',
          data: hourData.map(h => +h.wr.toFixed(1)),
          // Verde si WR ≥ 50 %, rojo si no; gris si no hay trades en esa franja.
          backgroundColor: hourData.map(h => h.n === 0 ? rgba(READ('--dim'), 0.35) : vGrad(canvas, h.wr >= 50 ? GREEN : RED, 1, 0.25)),
          borderRadius: { topLeft: 12, topRight: 12, bottomLeft: 4, bottomRight: 4 }, borderSkipped: false, yAxisID: 'y', categoryPercentage: 0.7, barPercentage: 0.82,
        },
        {
          label: 'N°',
          data: hourData.map(h => h.n),
          type: 'line', borderColor: BLUE,
          backgroundColor: 'transparent',
          tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
          pointBackgroundColor: BLUE,
          borderWidth: 2, yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        // Bandas de 1h → hasta ~17+ etiquetas. Sin autoSkip:false, Chart.js
        // esconde etiquetas silenciosamente.
        x: { grid: { display: false }, border: { display: false }, ticks: { autoSkip: false, maxRotation: 90, minRotation: 0, font: { size: 9 } } },
        y: { ticks: { callback: v => v + '%' }, grid: { color: READ('--border') }, border: { display: false }, min: 0, max: 110 },
        y2: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: BLUE } },
      },
    },
  });
}

export function createDayBar(canvas, dayData) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const GREEN = READ('--green'), RED = READ('--red'), BLUE = READ('--cyan');
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dayData.map(d => d.label),
      datasets: [
        {
          label: 'WR %',
          data: dayData.map(d => +d.wr.toFixed(1)),
          backgroundColor: dayData.map(d => d.n === 0 ? rgba(READ('--dim'), 0.35) : vGrad(canvas, d.wr >= 50 ? GREEN : RED, 1, 0.25)),
          borderRadius: { topLeft: 12, topRight: 12, bottomLeft: 4, bottomRight: 4 }, borderSkipped: false, yAxisID: 'y', categoryPercentage: 0.7, barPercentage: 0.82,
        },
        {
          label: 'N°',
          data: dayData.map(d => d.n),
          type: 'line', borderColor: BLUE,
          backgroundColor: 'transparent',
          tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
          pointBackgroundColor: BLUE,
          borderWidth: 2, yAxisID: 'y2',
        },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { ticks: { callback: v => v + '%' }, grid: { color: READ('--border') }, border: { display: false }, min: 0, max: 100 },
        y2: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { color: BLUE } },
      },
    },
  });
}

export function createLongShort(canvas, lsData) {
  // Sin lienzo (la vista cambio antes de pintar): no hay nada que dibujar.
  if (!canvas) return null;
  defaults();
  Chart.getChart(canvas)?.destroy();
  const GREEN = READ('--green'), RED = READ('--red');
  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels: lsData.map(d => d.label),
      datasets: [
        { label: 'Long', data: lsData.map(d => +d.long.wr.toFixed(1)), backgroundColor: vGrad(canvas, GREEN, 1, 0.25), borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 4, bottomRight: 4 }, borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.85 },
        { label: 'Short', data: lsData.map(d => +d.short.wr.toFixed(1)), backgroundColor: vGrad(canvas, RED, 1, 0.25), borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 4, bottomRight: 4 }, borderSkipped: false, categoryPercentage: 0.7, barPercentage: 0.85 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 10, boxHeight: 10, padding: 16, usePointStyle: true, font: { family: uiFont(), size: 11 } } } },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { ticks: { callback: v => v + '%' }, grid: { color: READ('--border') }, border: { display: false }, min: 0, max: 100 },
      },
    },
  });
}
