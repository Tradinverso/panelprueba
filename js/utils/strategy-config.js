// Configuración de estrategias compartida entre new-trade, strategy view y edit modal.
// Todas las opciones de pills (par / zona / entrada) viven aquí para mantener
// consistencia entre formularios.

// Zonas de LIQUIDEZ, en cuadrícula fija de 3 columnas (zonesCols): cada grupo
// de 3 es una fila. Sin CONT ni ORB, y el FVG es solo el de temporalidad alta.
// Los trades antiguos con valores retirados (CONT, ORB, "FVG" a secas) se
// conservan tal cual y se siguen pudiendo filtrar.
const LIQ_ZONES = [
  'ASIA',    'LONDON',  'MECHA',
  'PDH/PDL', 'PWH/PWL', 'BSL/SSL',
  'IRL',     'FVG HTF', 'VOL',
];

// Entradas de LIQUIDEZ, cuadrícula de 3: ENVOL y LIMIT abren fila
// (entriesRowStarts) → IFVG · FVG · BPR / ENVOL · CHOCH / LIMIT. Sin MARKET.
const LIQ_ENTRIES = ['IFVG', 'FVG', 'BPR', 'ENVOL', 'CHOCH', 'LIMIT'];

// NASDAQ tiene las suyas: sin MECHA/VOL/CONT en zonas ni LIMIT/CHOCH/MARKET en
// entradas. CONT sale porque la continuación ya es un modelo de entrada (M4):
// tenerla también como zona duplicaba el dato.
// Listas propias, no un filtrado de las de LIQUIDEZ, para que cada estrategia
// pueda evolucionar sin arrastrar a la otra. Los trades ya guardados con esos
// valores NO se tocan: se siguen viendo y filtrando (las opciones de los
// filtros salen de los datos, no de esta config).
// FVG se parte por temporalidad: no es lo mismo un FVG de 15 min que uno de 1H,
// 4H o diario. Los trades antiguos con "FVG" a secas se conservan tal cual (no
// se puede saber de cuál eran).
//
// Lista explícita y en este ORDEN: se pinta como una cuadrícula fija de 3
// columnas (zonesCols), así que cada grupo de 3 es una fila del formulario.
const NQ_ZONES = [
  'ORB',     'ASIA',    'LONDON',     // sesiones / rango de apertura
  'BSL/SSL', 'PDH/PDL', 'PWH/PWL',    // liquidez
  'IRL',     'FVG M15', 'FVG HTF',    // interna / imbalances
  // CONT: entrada en continuación, que no sale de ninguna zona concreta.
  // Sola en la última fila.
  'CONT',
];
// Orden explícito, en cuadrícula de 3 columnas: IFVG · ENVOL arriba y
// FVG · BPR · BAG abajo (FVG abre fila: entriesRowStarts).
const NQ_ENTRIES = ['IFVG', 'ENVOL', 'FVG', 'BPR', 'BAG'];

// Modelos de entrada de NASDAQ. Se guarda el código (M1…M4), no el texto: si
// mañana se renombra un modelo, los trades ya registrados siguen apuntando al
// mismo y cambian de nombre solos.
const NQ_MODELS = [
  { value: 'M1', label: '1 · ORB' },
  { value: 'M2', label: '2 · AMD + IFVG' },
  { value: 'M3', label: '3 · Liquidez externa' },
  { value: 'M4', label: '4 · Continuación' },
];

// Modelos de LIQUIDEZ. Códigos propios (L1…L3), distintos de los de Nasdaq,
// para que nunca se mezclen en filtros ni estadísticas.
//   MRA = manipulación del rango asiático.
const LIQ_MODELS = [
  { value: 'L1', label: '1 · MRA Limit' },
  { value: 'L2', label: '2 · MRA Confirm' },
  { value: 'L3', label: '3 · Puntos líquidos' },
];

// Qué entradas y zona implica cada modelo de Liquidez:
//   entries   → las ÚNICAS entradas posibles (si es una, se marca sola)
//   noEntries → entradas que no se pueden elegir con ese modelo
//   zone      → zona que se marca sola al elegirlo (se pueden añadir más)
// MRA Limit es por definición entrada LIMIT: la orden va por encima o por
// debajo de Asia, en una mecha, un FVG u otra zona (se añade a ASIA). MRA
// Confirm y Puntos líquidos son siempre con confirmaciones: nunca LIMIT.
const LIQ_MODEL_RULES = {
  L1: { entries: ['LIMIT'], zone: 'ASIA' },
  L2: { noEntries: ['LIMIT'], zone: 'ASIA' },
  L3: { noEntries: ['LIMIT'] },
};

// Nombre visible de un modelo guardado. Códigos desconocidos se muestran tal
// cual (nunca se pierden) y vacío es "sin modelo" — los trades anteriores a que
// existiera este campo.
const MODEL_LABELS = Object.fromEntries([...NQ_MODELS, ...LIQ_MODELS].map(m => [m.value, m.label]));

// Entradas que NO se pueden elegir con el modelo `model` de la estrategia.
export function entradasBloqueadas(meta, model) {
  const r = meta && meta.modelRules && meta.modelRules[model];
  if (!r) return [];
  if (r.entries) return (meta.entries || []).filter(e => !r.entries.includes(e));
  return r.noEntries || [];
}

// Error de coherencia modelo ↔ entrada al guardar ('' si todo bien).
export function errorModeloEntrada(meta, model, entry) {
  const bloq = entradasBloqueadas(meta, model);
  const mal = (entry || []).filter(e => bloq.includes(e));
  if (!mal.length) return '';
  return `${modelLabel(model).replace(/^\d+ · /, '')} no admite la entrada ${mal.join(', ')}.`;
}
export function modelLabel(code) {
  if (!code) return 'Sin modelo';
  return MODEL_LABELS[code] || code;
}

// Objetivo de TP de cada estrategia, en R: [mínimo, máximo].
// Zonas va a TP fijo de 2R; Liquidez se mueve entre 2R y 3R; Nasdaq entre 1,5R
// y 2R. Lo usan los atajos de resultado de Nuevo trade y el diagnóstico de
// "cierres antes del objetivo" (un TP por debajo del mínimo).
export const TP_RANGE = { ZONAS: [2, 2], LIQUIDEZ: [2, 3], NASDAQ: [1.5, 2], NQ_LONDRES: [1.5, 2] };
// Tope de cordura del % P&L (va en R): por encima de esto es casi seguro que
// se han apuntado pips o dólares.
export const R_MAXIMO = 10;
export const fmtR = n => String(n).replace('.', ',');
export function tpRangeLabel(sheet) {
  const r = TP_RANGE[sheet];
  if (!r) return '';
  return r[0] === r[1] ? `${fmtR(r[0])}R` : `${fmtR(r[0])}–${fmtR(r[1])}R`;
}

// Motivo de salida de un trade (campo opcional `exit_reason`).
//   tp / sl / be        → salió donde estaba previsto (se deduce del resultado)
//   miedo / noticia / tiempo → lo cerró el trader a mano antes de tiempo
// Sirve para saber POR QUÉ se cierran trades antes del objetivo.
export const MOTIVOS_SALIDA = [
  { value: 'tp', label: 'TP' }, { value: 'sl', label: 'SL' }, { value: 'be', label: 'Break even' },
  { value: 'miedo', label: 'Manual · miedo' }, { value: 'noticia', label: 'Manual · noticia' }, { value: 'tiempo', label: 'Manual · tiempo' },
];
export const esMotivoManual = v => v === 'miedo' || v === 'noticia' || v === 'tiempo';
export const motivoLabel = v => { const m = MOTIVOS_SALIDA.find(x => x.value === v); return m ? m.label : ''; };
export function motivoPorResultado(pnl) {
  if (typeof pnl !== 'number' || !isFinite(pnl)) return '';
  return pnl > 0.2 ? 'tp' : pnl < -0.2 ? 'sl' : 'be';
}

const BASE = {
  ZONAS: {
    label: 'Zonas',
    color: 'var(--zonas)',
    cls: 'zonas',
    colorVar: '--zonas', route: '#/zonas', btRoute: '#/bt-zonas', sub: 'Forex, Oro y Oil', corto: 'Z',
    desc: 'Reacciones en zonas técnicas en EUR/USD, GBP/USD, ORO y OIL',
    pairs: ['EUR/USD', 'GBP/USD', 'ORO', 'OIL'],
    // Dos filas: divisas arriba (EUR/USD · GBP/USD), ORO · OIL abajo.
    pairsCols: 3,
    pairsRowStarts: ['ORO'],
    pairFixed: false,
    zones: ['> 7 días', 'Entre 2 y 7 días', '< 2 días', 'Retest'],
    entries: ['Clásica', 'Otras', 'Volumen'],
    zonesMulti: false,
    entriesMulti: false,
    showRR: false,
    showPip: false,
    showEntry: true,
    links: [
      { key: 'url1', label: 'Link M1' },
      { key: 'url2', label: 'Link M15' },
    ],
  },
  LIQUIDEZ: {
    label: 'Liquidez',
    color: 'var(--liquidez)',
    cls: 'liquidez',
    colorVar: '--liquidez', route: '#/liquidez', btRoute: '#/bt-liquidez', sub: 'EUR/USD', corto: 'L',
    desc: 'Operativa de liquidez en EUR/USD y GBP/USD · puntos líquidos, rangos y noticias',
    pairs: ['EUR/USD', 'GBP/USD'],
    pairFixed: false,
    zones: LIQ_ZONES,
    zonesCols: 3,
    entries: LIQ_ENTRIES,
    entriesCols: 3,
    entriesRowStarts: ['ENVOL', 'LIMIT'],
    models: LIQ_MODELS,
    modelRules: LIQ_MODEL_RULES,
    // Varias zonas (p. ej. ASIA + PDH/PDL en un MRA) y varias confirmaciones
    // (p. ej. IFVG + CHOCH): en las estadísticas por zona y por entrada el
    // trade cuenta en cada una. MRA Limit sigue siendo solo LIMIT (modelRules).
    zonesMulti: true,
    entriesMulti: true,
    // Sin campo RR: el % P&L ya es la R conseguida, y el RR planeado no aporta
    // (el "RR medio" se calcula de los TP realizados, ver calculations.avgRR).
    showRR: false,
    showPip: false,
    showEntry: true,
    links: [
      { key: 'url1', label: 'Link HTF' },
      { key: 'url2', label: 'Link LTF' },
    ],
  },
  NASDAQ: {
    // Antes "Nasdaq". La clave interna (NASDAQ) no cambia: los trades guardados
    // siguen siendo suyos.
    label: 'NQ Nueva York',
    color: 'var(--nasdaq)',
    cls: 'nasdaq',
    colorVar: '--nasdaq', route: '#/nasdaq', btRoute: '#/bt-nasdaq', sub: 'NQ Futuros · Nueva York', corto: 'NY',
    desc: 'Operativa de liquidez en NQ Futuros · sesión Nueva York',
    pairs: ['NQ'],
    pairFixed: true,
    zones: NQ_ZONES,
    zonesCols: 3,   // cuadrícula fija de 3 columnas: mismas filas en cualquier ancho
    entries: NQ_ENTRIES,
    entriesCols: 3,
    entriesRowStarts: ['FVG'],
    models: NQ_MODELS,
    // Una sola zona por trade; varios tipos de entrada (p. ej. IFVG + BPR): en
    // las estadísticas por entrada el trade cuenta en cada una.
    zonesMulti: false,
    entriesMulti: true,
    // Sin campo RR: el % P&L ya es la R conseguida, y el RR planeado no aporta
    // (el "RR medio" se calcula de los TP realizados, ver calculations.avgRR).
    showRR: false,
    showPip: false,
    showEntry: true,
    links: [
      { key: 'url1', label: 'Link HTF' },
      { key: 'url2', label: 'Link LTF' },
    ],
  },
};

// NQ Londres: la misma operativa de NQ (zonas, entradas, modelos, objetivo de
// 1,5–2R y campos), en la sesión de Londres. Es una copia de NQ Nueva York con
// su nombre, su color y sus rutas; lo que haya que quitarle se cambia aquí.
BASE.NQ_LONDRES = {
  ...BASE.NASDAQ,
  label: 'NQ Londres',
  color: 'var(--nqlondres)',
  cls: 'nqlondres',
  colorVar: '--nqlondres', route: '#/nq-londres', btRoute: '#/bt-nq-londres', sub: 'NQ Futuros · Londres', corto: 'LD',
  desc: 'Operativa de liquidez en NQ Futuros · sesión Londres',
};

// Orden en toda la app (pestañas, tarjetas, tablas, exportación).
export const SHEETS = ['ZONAS', 'NQ_LONDRES', 'NASDAQ', 'LIQUIDEZ'];
export const STRATEGIES = Object.fromEntries(SHEETS.map(k => [k, BASE[k]]));

// ¿Es una estrategia de NQ? (par fijo "NQ", mismos campos al importar y exportar)
export const esNQ = sheet => sheet === 'NASDAQ' || sheet === 'NQ_LONDRES';
export const sheetLabel = sheet => (STRATEGIES[sheet] && STRATEGIES[sheet].label) || sheet || '';
export const sheetCls = sheet => (STRATEGIES[sheet] && STRATEGIES[sheet].cls) || '';
// Estrategias que se enseñan a quien está usando la app (o al alumno que el admin
// está viendo). Liquidez solo sale si la tiene activa: lo decide `state`
// (utils/liquidez.js), que registra aquí su respuesta para no cruzar imports.
let liquidezActiva = () => true;
export function setProveedorLiquidez(fn) { liquidezActiva = fn; }
export const sheetsVisibles = () => (liquidezActiva() ? SHEETS : SHEETS.filter(k => k !== 'LIQUIDEZ'));
export const sheetVisible = sheet => sheetsVisibles().includes(sheet);
