// Firmas de fondeo y herramientas que usamos en Tradinverso, con el enlace de
// afiliado de la academia. Se ven en Cuentas (js/components/firmas.js).
//
// Para añadir, quitar o cambiar una: editar esta lista. El orden es el de aquí.
//   mercados   'Futuros' y/o 'CFD' (los mismos valores que el tipo de cuenta)
//   codigos    [{ codigo, nota }] — sin descuentos: cambian a menudo
//   destacada  la que recomendamos primero (tarjeta grande); solo una.
//              `insignia` y `lema` son los dos textos de esa tarjeta
//   tipo       'firma' (por defecto) o 'herramienta'
//   logo       icono cuadrado en assets/firmas; `fondo` es el color de su baldosa
//              y `lleno` marca los que ya traen fondo propio (sin margen)

export const FIRMAS = [
  {
    id: 'earn2trade', nombre: 'Earn2Trade', mercados: ['Futuros'], destacada: true,
    insignia: 'Empresa colaboradora oficial', lema: 'La que recomendamos para escalar',
    url: 'https://www.earn2trade.com/?a_pid=davidrosellfx',
    codigos: [], logo: 'assets/firmas/earn2trade.png', fondo: '#ffffff',
  },
  {
    id: 'orion', nombre: 'Orion Funded', mercados: ['CFD'],
    url: 'https://shop.orionfunded.com/?ref=10713',
    codigos: [{ codigo: 'TRADINVERSO50', nota: 'primera compra' }, { codigo: 'TRADINVERSO', nota: 'siguientes' }],
    logo: 'assets/firmas/orion.png', lleno: true, fondo: '#000000',
  },
  {
    id: 'wsfunded', nombre: 'WSFunded', mercados: ['CFD'],
    url: 'https://purchase.wsfunded.com/?sp_rid=694ba5a115299b253517eb53',
    codigos: [], logo: 'assets/firmas/wsfunded.png', fondo: '#ffffff',
  },
  {
    id: 'nys', nombre: 'NYS Markets', mercados: ['Futuros', 'CFD'],
    url: 'https://nysmarkets.com/signup?cxd=JRDIWUVU+253374_67',
    codigos: [{ codigo: 'TRADINVERSO' }], logo: 'assets/firmas/nys.png', fondo: '#ffffff',
  },
  {
    id: 'fundednext', nombre: 'FundedNext', mercados: ['Futuros', 'CFD'],
    url: 'https://fundednext.com/?fpr=INVERSO',
    codigos: [{ codigo: 'INVERSO' }], logo: 'assets/firmas/fundednext.png', lleno: true, fondo: '#ffffff',
  },
  {
    id: 'tradingpit', nombre: 'The Trading Pit', mercados: ['Futuros', 'CFD'],
    url: 'https://affiliate.thetradingpit.com/visit/?bta=37192&brand=thetradingpit',
    codigos: [{ codigo: 'TRADINVERSO' }], logo: 'assets/firmas/tradingpit.png', lleno: true, fondo: '#000000',
  },
  {
    id: 'the5ers', nombre: 'The5ers', mercados: ['Futuros', 'CFD'],
    url: 'https://www.the5ers.com/?afmc=8p8',
    codigos: [{ codigo: 'PMSME1K9' }], logo: 'assets/firmas/the5ers.png', fondo: '#ffffff',
  },
  {
    id: 'alpha', nombre: 'Alpha Futures', mercados: ['Futuros'],
    url: 'https://app.alpha-futures.com/signup/Jose_David021098/',
    codigos: [{ codigo: 'Jose_David021098' }], logo: 'assets/firmas/alpha.png', lleno: true, fondo: '#06231a',
  },
  {
    id: 'tradecopia', nombre: 'Tradecopia', tipo: 'herramienta', descripcion: 'Copiador de cuentas', mercados: ['Futuros'],
    url: 'https://tradecopia.com/',
    codigos: [{ codigo: 'jRcv2Grv' }], logo: 'assets/firmas/tradecopia.png', lleno: true, fondo: '#ffffff',
  },
];

// filtro: 'all' | 'Futuros' | 'CFD'
export function firmasDe(filtro = 'all') {
  return FIRMAS.filter(f => filtro === 'all' || f.mercados.includes(filtro));
}

export const mercadoLabel = m => (m === 'CFD' ? 'CFDs' : m);
