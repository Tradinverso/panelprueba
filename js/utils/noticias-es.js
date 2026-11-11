// Titulares del calendario de Forex Factory en español.
//
// El feed solo publica el nombre del dato en inglés ("Core CPI m/m"). Aquí se
// traduce por piezas: país delante ("German …" → "Alemania: …"), fase del dato
// ("Prelim", "Flash", "Final"…), nombre del indicador y periodo detrás
// ("m/m" → "(mensual)"). Lo que no se reconoce se deja tal cual, en inglés:
// mejor el nombre original que una traducción inventada. El original siempre
// queda en el tooltip (así se puede buscar igual en Forex Factory o Investing).

const PERIODO = {
  'm/m': 'mensual',
  'q/q': 'trimestral',
  'y/y': 'anual',
  'q/y': 'interanual',
  '3m/y': 'media 3 meses, anual',
};

const PAIS = {
  german: 'Alemania', french: 'Francia', italian: 'Italia', spanish: 'España',
};

// Fase del dato: va detrás del nombre, entre paréntesis junto al periodo.
const FASE = {
  prelim: 'preliminar', flash: 'preliminar', advance: 'avance',
  final: 'final', revised: 'revisado', second: '2.ª estimación',
};

// Nombre del indicador (en minúsculas, sin país, fase ni periodo).
const BASE = {
  // Inflación
  'cpi': 'IPC',
  'core cpi': 'IPC subyacente',
  'ppi': 'IPP (precios de producción)',
  'core ppi': 'IPP subyacente',
  'ppi input': 'IPP de insumos',
  'ppi output': 'IPP de salida',
  'pce price index': 'Índice de precios PCE',
  'core pce price index': 'PCE subyacente',
  'employment cost index': 'Índice de costes laborales',
  // Empleo
  'non-farm employment change': 'Nóminas no agrícolas (NFP)',
  'adp non-farm employment change': 'Empleo privado ADP',
  'unemployment rate': 'Tasa de desempleo',
  'unemployment claims': 'Peticiones de subsidio por desempleo',
  'average hourly earnings': 'Salario medio por hora',
  'jolts job openings': 'Ofertas de empleo JOLTS',
  'claimant count change': 'Solicitantes de subsidio por desempleo',
  'average earnings index': 'Salarios medios',
  'employment change': 'Variación del empleo',
  // Actividad
  'gdp': 'PIB',
  'gdp price index': 'Deflactor del PIB',
  'retail sales': 'Ventas minoristas',
  'core retail sales': 'Ventas minoristas subyacentes',
  'durable goods orders': 'Pedidos de bienes duraderos',
  'core durable goods orders': 'Pedidos de bienes duraderos subyacentes',
  'industrial production': 'Producción industrial',
  'manufacturing production': 'Producción manufacturera',
  'factory orders': 'Pedidos de fábrica',
  'trade balance': 'Balanza comercial',
  'building permits': 'Permisos de construcción',
  'housing starts': 'Viviendas iniciadas',
  'new home sales': 'Ventas de viviendas nuevas',
  'existing home sales': 'Ventas de viviendas de segunda mano',
  'pending home sales': 'Ventas pendientes de viviendas',
  // PMI y confianza
  'manufacturing pmi': 'PMI manufacturero',
  'services pmi': 'PMI de servicios',
  'construction pmi': 'PMI de construcción',
  'composite pmi': 'PMI compuesto',
  'ism manufacturing pmi': 'PMI manufacturero ISM',
  'ism services pmi': 'PMI de servicios ISM',
  'ism manufacturing prices': 'Precios manufactureros ISM',
  'chicago pmi': 'PMI de Chicago',
  'cb consumer confidence': 'Confianza del consumidor (Conference Board)',
  'uom consumer sentiment': 'Confianza del consumidor (Univ. de Míchigan)',
  'uom inflation expectations': 'Expectativas de inflación (Univ. de Míchigan)',
  'consumer confidence': 'Confianza del consumidor',
  'gfk consumer confidence': 'Confianza del consumidor GfK',
  'empire state manufacturing index': 'Índice manufacturero Empire State',
  'philly fed manufacturing index': 'Índice manufacturero de la Fed de Filadelfia',
  'richmond manufacturing index': 'Índice manufacturero de Richmond',
  'ifo business climate': 'Clima empresarial ifo',
  'zew economic sentiment': 'Sentimiento económico ZEW',
  // Bancos centrales
  'federal funds rate': 'Tipos de interés de la Fed',
  'fomc statement': 'Comunicado del FOMC',
  'fomc meeting minutes': 'Actas del FOMC',
  'fomc economic projections': 'Proyecciones económicas del FOMC',
  'fomc press conference': 'Rueda de prensa del FOMC',
  'main refinancing rate': 'Tipos de interés del BCE',
  'deposit facility rate': 'Tipo de depósito del BCE',
  'monetary policy statement': 'Comunicado de política monetaria',
  'ecb press conference': 'Rueda de prensa del BCE',
  'ecb monetary policy meeting accounts': 'Actas del BCE',
  'official bank rate': 'Tipos de interés del Banco de Inglaterra',
  'mpc official bank rate votes': 'Votos del MPC sobre los tipos',
  'monetary policy summary': 'Resumen de política monetaria',
  'monetary policy report': 'Informe de política monetaria',
  'monetary policy report hearings': 'Comparecencia: informe de política monetaria',
  'boe monetary policy report': 'Informe de política monetaria del BoE',
  'bank stress test results': 'Resultados de los test de estrés bancarios',
  'jackson hole symposium': 'Simposio de Jackson Hole',
  // Otros
  'crude oil inventories': 'Inventarios de petróleo crudo',
  'annual budget release': 'Presupuesto anual',
  'autumn forecast statement': 'Declaración de otoño (presupuesto)',
  'spring forecast statement': 'Declaración de primavera (presupuesto)',
  'presidential election': 'Elecciones presidenciales',
  'congressional elections': 'Elecciones al Congreso',
  'parliamentary elections': 'Elecciones parlamentarias',
  'bank holiday': 'Festivo bancario',
  'opec meetings': 'Reunión de la OPEP',
  'opec-jmmc meetings': 'Reunión OPEP+ (JMMC)',
  'g7 meetings': 'Reunión del G7',
  'g20 meetings': 'Reunión del G20',
  'eu economic summit': 'Cumbre económica de la UE',
  'ecofin meetings': 'Reunión del Ecofin',
  'eurogroup meetings': 'Reunión del Eurogrupo',
};

// "Fed Chair Powell Speaks" → "Habla Powell (Fed)". El cargo se resume en la
// institución: así no depende de quién lo ocupe.
const CARGO = [
  ['fed chair', 'Fed'],
  ['fomc member', 'FOMC'],
  ['ecb president', 'BCE'],
  ['boe gov', 'Banco de Inglaterra'],
  ['mpc member', 'Banco de Inglaterra'],
  ['treasury sec', 'Tesoro de EE. UU.'],
  ['german buba president', 'Bundesbank'],
  ['president', 'Casa Blanca'],
  ['prime minister', 'Gobierno'],
];

function comparecencia(title) {
  const m = /^(.+?)\s+(Speaks|Testifies)$/i.exec(title);
  if (!m) return null;
  const quien = m[1];
  const verbo = /testifies/i.test(m[2]) ? 'Comparece' : 'Habla';
  const low = quien.toLowerCase();
  for (const [cargo, org] of CARGO) {
    if (low.startsWith(cargo + ' ')) return `${verbo} ${quien.slice(cargo.length + 1)} (${org})`;
  }
  return `${verbo} ${quien}`;
}

/** Titular en español, o el original si no se reconoce. */
export function tituloEs(title) {
  const original = String(title || '').trim();
  if (!original) return '';

  const habla = comparecencia(original);
  if (habla) return habla;

  let resto = original;
  const detalles = [];

  // Periodo al final: "… m/m"
  const mp = /\s+(3m\/y|[mqy]\/[mqy])$/i.exec(resto);
  let periodo = '';
  if (mp) { periodo = PERIODO[mp[1].toLowerCase()] || ''; resto = resto.slice(0, mp.index); }

  // País delante: "German …"
  let pais = '';
  const primera = resto.split(' ')[0].toLowerCase();
  if (PAIS[primera] && resto.includes(' ')) { pais = PAIS[primera]; resto = resto.slice(primera.length + 1); }

  // Fase delante: "Prelim …", "Flash …" (salvo que el nombre entero ya esté en la lista)
  if (!BASE[resto.toLowerCase()]) {
    const p = resto.split(' ')[0].toLowerCase();
    if (FASE[p] && resto.includes(' ')) { detalles.push(FASE[p]); resto = resto.slice(p.length + 1); }
  }

  // "CPI Flash Estimate" (zona euro) → "CPI" + preliminar
  const mf = /^(.*)\s+Flash Estimate$/i.exec(resto);
  if (mf) { resto = mf[1]; detalles.push('preliminar'); }

  const base = BASE[resto.toLowerCase()];
  if (!base) return original;          // no reconocido: se deja en inglés

  if (periodo) detalles.push(periodo);
  // Si el nombre ya acaba en parentesis, los detalles entran en el mismo.
  const cola = detalles.join(', ');
  const cuerpo = !cola ? base
    : base.endsWith(')') ? `${base.slice(0, -1)}, ${cola})`
    : `${base} (${cola})`;
  return (pais ? pais + ': ' : '') + cuerpo;
}
