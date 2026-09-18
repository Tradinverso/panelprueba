// Configuración de estrategias compartida entre new-trade, strategy view y edit modal.
// Todas las opciones de pills (par / zona / entrada) viven aquí para mantener
// consistencia entre formularios.

// Zonas de la operativa de liquidez (LIQUIDEZ)
const LIQ_ZONES = [
  'BSL/SSL', 'ASIA', 'LONDON', 'PDH/PDL', 'PWH/PWL',
  'CONT', 'IRL', 'ORB', 'FVG', 'MECHA', 'VOL',
];

// Entradas de la operativa de liquidez (LIQUIDEZ)
const LIQ_ENTRIES = [
  'BPR', 'FVG', 'IFVG', 'ENVOL', 'MARKET', 'LIMIT', 'CHOCH',
];

// NASDAQ tiene las suyas: sin MECHA/VOL en zonas ni LIMIT/CHOCH/MARKET en entradas.
// Listas propias, no un filtrado de las de LIQUIDEZ, para que cada estrategia
// pueda evolucionar sin arrastrar a la otra. Los trades ya guardados con esos
// valores NO se tocan: se siguen viendo y filtrando (las opciones de los
// filtros salen de los datos, no de esta config).
// FVG se parte por temporalidad: no es lo mismo un FVG de 15 min que uno de 1H,
// 4H o diario. Ocupan el sitio del FVG genérico. Los trades antiguos con "FVG"
// a secas se conservan tal cual (no se puede saber de cuál eran).
const NQ_ZONES = LIQ_ZONES
  .filter(z => z !== 'MECHA' && z !== 'VOL')
  .flatMap(z => z === 'FVG' ? ['FVG LTF', 'FVG HTF'] : [z]);
const NQ_ENTRIES = [...LIQ_ENTRIES.filter(e => !['LIMIT', 'CHOCH', 'MARKET'].includes(e)), 'BAG'];

// Modelos de entrada de NASDAQ. Se guarda el código (M1…M4), no el texto: si
// mañana se renombra un modelo, los trades ya registrados siguen apuntando al
// mismo y cambian de nombre solos.
const NQ_MODELS = [
  { value: 'M1', label: '1 · ORB' },
  { value: 'M2', label: '2 · AMD + IFVG' },
  { value: 'M3', label: '3 · Liquidez externa' },
  { value: 'M4', label: '4 · Continuación' },
];

// Nombre visible de un modelo guardado. Códigos desconocidos se muestran tal
// cual (nunca se pierden) y vacío es "sin modelo" — los trades anteriores a que
// existiera este campo.
const MODEL_LABELS = Object.fromEntries(NQ_MODELS.map(m => [m.value, m.label]));
export function modelLabel(code) {
  if (!code) return 'Sin modelo';
  return MODEL_LABELS[code] || code;
}

export const STRATEGIES = {
  ZONAS: {
    label: 'Zonas',
    color: 'var(--zonas)',
    cls: 'zonas',
    desc: 'Reacciones en zonas técnicas en EUR/USD, GBP/USD y XAU/USD',
    pairs: ['EUR/USD', 'GBP/USD', 'XAU/USD'],
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
    desc: 'Operativa de liquidez en EUR/USD y GBP/USD · puntos líquidos, rangos y noticias',
    pairs: ['EUR/USD', 'GBP/USD'],
    pairFixed: false,
    zones: LIQ_ZONES,
    entries: LIQ_ENTRIES,
    zonesMulti: true,
    entriesMulti: true,
    showRR: true,
    showPip: false,
    showEntry: true,
    links: [
      { key: 'url1', label: 'Link HTF' },
      { key: 'url2', label: 'Link LTF' },
    ],
  },
  NASDAQ: {
    label: 'Nasdaq',
    color: 'var(--nasdaq)',
    cls: 'nasdaq',
    desc: 'Operativa de liquidez en NQ Futuros · sesión Nueva York',
    pairs: ['NQ'],
    pairFixed: true,
    zones: NQ_ZONES,
    zonesHint: 'FVG LTF = 15 min · FVG HTF = 1H, 4H o diario',
    entries: NQ_ENTRIES,
    // Solo NASDAQ tiene modelos: en el resto de estrategias el campo no aparece.
    models: NQ_MODELS,
    zonesMulti: true,
    entriesMulti: true,
    showRR: true,
    showPip: false,
    showEntry: true,
    links: [
      { key: 'url1', label: 'Link HTF' },
      { key: 'url2', label: 'Link LTF' },
    ],
  },
};
