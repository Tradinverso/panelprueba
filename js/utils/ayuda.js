// Textos de AYUDA de la app, todos aquí: una entrada por página, los Primeros
// pasos, lo que ha cambiado para los alumnos de antes y las Novedades.
//
// NORMA: cada cambio en la app actualiza, en el mismo commit, la ayuda de la
// página que toca y añade una línea a NOVEDADES (la más reciente arriba). Así
// el manual se escribe solo y nunca se queda por detrás.
//
// Formato de los textos: frases cortas, para alumnos, explicando el porqué.
// Se puede usar <b>…</b>; nada más de HTML (lo pintan components/ayuda.js y,
// si algún día hace falta, un generador de PDF).
//
// Base: el manual de Pablo (nov 2026), revisado contra el código.

// Cambia cuando haya un aviso nuevo que enseñar al entrar (ver components/ayuda.js).
export const AVISO_ID = '2026-11-v3';

// ── Ayuda de cada página ──────────────────────────────────────────────────
// bloques: [{ t: título, p: párrafo } | { t, lista: [...] }]
export const AYUDA_PAGINAS = {
  dashboard: {
    titulo: 'Dashboard',
    intro: 'Tu resumen de un vistazo: cómo vas hoy, esta semana y este mes, y cómo estás ejecutando. Si solo miras una página al día, que sea esta.',
    bloques: [
      { t: 'La barra de arriba', lista: [
        '<b>Desde / Hasta</b>: elige el periodo que quieres analizar. Todo el Dashboard se recalcula.',
        '<b>Checklist</b>: tu lista antes de operar. Ámbar mientras te falten puntos, verde cuando la completas.',
        '<b>Diario</b>: te dice cuántos pasos del diario de hoy llevas (0/2, 1/2 o completo).',
        '<b>Semáforo</b>: no es un botón de acción, es un aviso. Pulsarlo te lleva al Diagnóstico para ver el porqué.',
        '<b>+ Nuevo trade</b>: para apuntar una operación.',
      ] },
      { t: 'El semáforo: ¿hoy puedo operar?', lista: [
        '<b>Vía libre</b> (verde): no hay nada que te frene hoy. Respeta tu plan.',
        '<b>Precaución</b> (naranja): estás cerca de un límite. Por ejemplo, 2 SL hoy, 4 trades, una reentrada rápida tras un SL, un trade fuera del plan o una alerta importante en tu Diagnóstico.',
        '<b>Hoy no se opera</b> (rojo): has llegado a una regla de parada. 3 SL en el día, 5 trades, un -3 % real en el día, una sensación negativa al entrar o un trade de venganza.',
        'Mira solo el día de hoy, aunque tengas otro periodo elegido arriba. Su trabajo es protegerte la sesión.',
      ] },
      { t: 'La franja de resumen', lista: [
        '<b>Hoy, esta semana y el mes</b>: resultado, número de trades y winrate.',
        '<b>Últimas 4 semanas</b>: tu winrate reciente frente al histórico. Te dice si vas a mejor o a peor.',
        '<b>Disciplina</b>: tu nota de 0 a 100 (más abajo, cómo se calcula).',
        '<b>Sistema 1R / Real</b>: cambia todos los datos entre el resultado del sistema (como si arriesgaras siempre 1R) y el real (con el riesgo que pusiste de verdad).',
        '<b>Ocultar P&L</b>: tapa importes y porcentajes en toda la app. Útil para compartir pantalla o grabar.',
      ] },
      { t: 'Puntuación de Disciplina (0 a 100)', p: 'Mide cómo ejecutas, no cuánto ganas. Un mal día de mercado apenas la mueve; saltarte el plan sí. Pulsa <b>Ver desglose</b> para ver cada parte y por dónde empezar a mejorar.' },
      { t: 'Qué pesa cada parte', lista: [
        '<b>Dentro del plan · 40</b>: trades marcados como dentro de tu plan.',
        '<b>Sensación al entrar · 20</b>: trades en los que entraste tranquilo y con confianza.',
        '<b>Riesgo constante · 15</b>: que tu riesgo no se dispare respecto a tu riesgo habitual.',
        '<b>Diario del día · 15</b>: días operados con el diario inverso y el diario del trader hechos.',
        '<b>Resultado del sistema · 10</b>: tu rendimiento medio por trade. Pesa poco a propósito.',
        'Hacen falta <b>10 trades</b> para calcularla. Si una parte no tiene datos (por ejemplo, nunca marcas la sensación), no cuenta y el resto se ajusta a 100.',
      ] },
      { t: 'Gráficos', lista: [
        '<b>Curva de equity</b>: una línea por estrategia y la global. Pulsa en la leyenda para enseñar u ocultar líneas.',
        '<b>P&L mensual</b>: una barra por mes con su cifra. En rojo los meses negativos.',
        '<b>Por estrategia</b>: una tarjeta por estrategia con su winrate y el desglose TP / SL / BE. La rueda pinta los TP en verde, los SL en rojo y los BE en gris; el número del centro es el winrate sin contar los BE.',
        '<b>Timing y dirección</b>: en qué horas y días rindes mejor, y Long frente a Short.',
        '<b>Mapa de calor</b>: tu resultado por día y hora, con lo más importante de tu Diagnóstico al lado.',
      ] },
      { t: '¿Cómo dejo de ver mis importes al compartir pantalla?', p: 'Pulsa <b>Ocultar P&L</b> en el Dashboard, o actívalo en Ajustes → Preferencias.' },
    ],
  },

  nuevo: {
    titulo: 'Nuevo trade',
    intro: 'Aquí apuntas cada operación. Cuanto más completo lo rellenes, mejor te podrá decir la app qué te funciona y qué no.',
    bloques: [
      { t: 'Paso a paso', lista: [
        '<b>Elige la estrategia</b> en las pestañas de arriba: Zonas, NQ Londres o NQ Nueva York.',
        '<b>Operativa</b>: par o modelo, setup, zona y tipo de entrada.',
        '<b>Resultado y cuenta</b>: los atajos TP / SL / BE rellenan el % P&L de un clic. Indica también tu riesgo real y, si llevas tus cuentas en la app, a cuál va el trade.',
        '<b>Ejecución y psicología</b>: si has seguido el plan, cómo te sentías al entrar, el motivo de salida y si entraste justo después de una pérdida.',
        '<b>Tiempos y notas</b>: fecha, horas, enlaces a los gráficos y tu reflexión.',
      ] },
      { t: 'Por qué importan las preguntas de psicología', p: '<b>¿Has seguido el plan?</b> y <b>la sensación al entrar</b> son lo que más avisa de un problema. Con tus propios trades, la app te enseña cómo te va cuando entras fuera del plan o con miedo. Si no las rellenas, ese aviso no puede existir.' },
      { t: 'Motivo de salida', p: 'Se marca solo según el resultado (TP, SL o Break even). Cámbialo si cerraste a mano: por miedo, por una noticia o por tiempo. Así sabrás cuánto te cuestan los cierres a mano.' },
      { t: '¿Entrada tras una pérdida?', p: 'Opcional. Marcarlo ayuda a detectar los trades de venganza, que suelen salir peor que el resto.' },
      { t: 'Cuentas y Resultado en $', lista: [
        'Si asignas el trade a una cuenta o a un grupo de copiado, el resultado en dólares sale de ahí.',
        'Si no llevas esa cuenta en la app, puedes escribir el <b>Resultado en $</b> a mano. Es opcional y solo aparece cuando el trade no tiene cuentas.',
        'Sirve para ver el Calendario en dólares.',
      ] },
      { t: 'El resumen de la derecha', p: 'Se actualiza mientras escribes y te dice qué campos obligatorios faltan antes de poder guardar.' },
      { t: 'Si tienes el cortacircuitos activado', p: 'Al guardar el SL que lleva una cuenta a tu límite del día, sale un aviso de parar. Y si el trade va a una cuenta que ya está parada hoy, la confirmación te lo advierte antes de guardar.' },
      { t: '¿Y la estrategia Liquidez?', p: 'Solo la ven los alumnos que ya la usaban antes de esta versión, y solo si la tienen activada en Ajustes → Módulos. Si eres nuevo, no la verás: ya no forma parte de la formación.' },
    ],
  },

  calendario: {
    titulo: 'Calendario',
    intro: 'Tu mes día a día. Sirve para ver de un vistazo qué días te fueron bien, cuáles mal y si sobreoperas.',
    bloques: [
      { t: 'Qué ves en cada día', lista: [
        'Arriba eliges qué cifra quieres ver: <b>% Sistema</b>, <b>% Real</b> o <b>Dólares ($)</b>. Cada día enseña esa cifra en grande y sus trades.',
        'Verde, rojo o naranja según el día sea positivo, negativo o break even.',
        'Un <b>círculo naranja</b> con un número marca los días con 5 trades o más: es sobreoperar.',
        'Los días con diario llevan un icono para abrirlo.',
      ] },
      { t: 'La columna de la semana', p: 'Enseña los tres resultados de la semana a la vez: sistema, real y dólares. El que tengas elegido arriba sale más grande.' },
      { t: 'El resumen del mes', p: 'Arriba tienes los trades y el winrate del mes, y los tres P&L: sistema, real y en dólares.' },
      { t: 'Filtrar por cuentas', lista: [
        'El botón <b>Todas las cuentas</b> te deja elegir una cuenta, varias o un grupo de copiado entero.',
        'Con el filtro puesto, el calendario usa solo los trades de esas cuentas y los dólares suman solo lo de esas cuentas.',
        'Cada cuenta tiene un botón <b>Ver calendario</b> que te trae aquí ya filtrado por ella.',
      ] },
      { t: '¿De dónde salen los dólares?', p: 'De tus cuentas asignadas (con un grupo, la suma de todas) o, si el trade no tiene cuentas, del Resultado en $ que escribiste a mano. Los días sin ningún dato en dólares salen con «—».' },
      { t: 'Abajo', p: 'Pulsa un día o una semana para ver sus trades. Sin nada elegido ves los del mes.' },
    ],
  },

  estrategias: {
    titulo: 'Estrategias',
    intro: 'El análisis de cada estrategia por separado. Mezclarlas esconde lo que funciona en una y falla en otra.',
    bloques: [
      { t: 'Las pestañas', lista: [
        '<b>Zonas</b>, <b>NQ Londres</b> y <b>NQ Nueva York</b>.',
        'NQ Londres y NQ Nueva York son la misma operativa de Nasdaq separada por sesión. Así ves en cuál rindes mejor.',
        'Lo que antes era «Nasdaq» es ahora NQ Nueva York: tus trades siguen ahí.',
      ] },
      { t: 'Qué encuentras en cada una', p: 'Filtros, KPI, rendimiento por par, zona, entrada y modelo, Long frente a Short, timing, mapa de calor, duración y la tabla de trades.' },
      { t: '¿He perdido mis trades de Liquidez?', p: 'No. Si ya usabas Liquidez antes de esta versión, tus trades siguen guardados. Activa <b>Estrategia Liquidez</b> en Ajustes → Módulos y vuelve a aparecer su pestaña. Los alumnos nuevos no tienen Liquidez: ya no forma parte de la formación.' },
    ],
  },

  diagnostico: {
    titulo: 'Diagnóstico',
    intro: 'Tu análisis automático: qué está fallando y qué va bien, calculado con tus propios trades.',
    bloques: [
      { t: 'Cómo está organizado', p: 'En <b>Técnico</b> y <b>Emocional</b>. Cada parte tiene sus <b>Alertas</b> y <b>Lo que va bien</b>.' },
      { t: 'Cómo leer las alertas', lista: [
        'Comparan cada cosa con tu media dentro de la misma estrategia.',
        'Si hay pocos trades, te lo dice: «todavía puede ser casualidad».',
        'No cambies tu operativa por una sola alerta. Vigílala y espera a tener más muestra.',
      ] },
      { t: 'Qué alertas pesan más', lista: [
        '<b>Seguir el plan</b> y <b>la sensación al entrar</b> sí avisan de algo real. Si tus trades fuera del plan o con miedo salen peor, es la señal más clara de qué cambiar.',
        'Las <b>rachas de SL</b> y la <b>«peor franja»</b> u horario suelen ser ruido cuando hay pocas muestras. Una racha de pérdidas entra dentro de lo normal con cualquier winrate.',
      ] },
      { t: 'Otros análisis', p: 'Cuántos TP llegan al objetivo, tu mejor sesión y tu mejor estrategia, la duración de los TP frente a los SL, los días sin FOMO, venganza ni miedo, y los días sin operar que apuntaste. No operar cuando no toca también es seguir el plan.' },
      { t: 'El semáforo del Dashboard', p: 'Si el Diagnóstico tiene una alerta importante, el semáforo del Dashboard no se pone en verde. Por eso al pulsarlo llegas aquí.' },
    ],
  },

  backtesting: {
    titulo: 'Backtesting',
    intro: 'Para registrar trades de práctica y los que viste pero no tomaste, sin mezclarlos con tus resultados reales.',
    bloques: [
      { t: 'Las pestañas', lista: [
        'Una por estrategia, para tus backtests.',
        '<b>No tomados</b>: operaciones válidas que viste y no entraste. Sirven para medir lo que te dejas por miedo o duda.',
        '<b>Importar</b>: para traer backtests desde una hoja de cálculo.',
      ] },
      { t: 'Cómo se usa', p: 'Pulsa <b>+ Nuevo backtest</b> para registrar uno. Los backtests y los no tomados <b>no cuentan</b> en tus estadísticas reales ni en tu Disciplina.' },
    ],
  },

  psicotrading: {
    titulo: 'Psicotrading',
    intro: 'Tu trabajo mental: el diario de cada día, meditaciones guiadas y protocolos para los momentos difíciles.',
    bloques: [
      { t: 'Reflexiones', lista: [
        'Un calendario con tus días y, a la derecha, el panel de <b>Hoy</b>: los tres pasos del día (Diario inverso, Trades y Diario del trader).',
        '<b>Días seguidos con diario</b>: tu racha, con un punto por día.',
        '<b>Una lección tuya</b>: te recuerda una de las lecciones que guardaste.',
        'Arriba cambias entre reflexión <b>Diaria</b>, <b>Semanal</b> y <b>Mensual</b>.',
      ] },
      { t: 'Diario inverso: antes de abrir la plataforma', p: 'Dos minutos para decidir cómo vas a operar antes de que el mercado decida por ti: qué no harás, qué mejorarás, qué harás si pasa algo concreto, tu regla de hoy y cómo llegas. Cada campo tiene dictado por voz.' },
      { t: 'Diario del trader: al cerrar el día', p: 'Si respetaste el plan, qué hiciste bien, dónde te saboteaste y qué quieres mejorar mañana (te lo recuerda en el diario inverso del día siguiente). La lección de hoy es opcional y te volverá otro día.' },
      { t: 'Meditaciones y Protocolos', p: 'Audios guiados para preparar la sesión, y los protocolos de Tradinverso más los tuyos propios para saber qué hacer en cada situación.' },
    ],
  },

  plan: {
    titulo: 'Plan de trading',
    intro: 'Tu plan siempre a mano. Operar con el plan delante evita decidir en caliente.',
    bloques: [
      { t: 'Documento del plan', p: 'Enlaza tu plan de Google Drive y lo verás dentro de la app. Tiene que estar compartido como <b>«Cualquiera con el enlace»</b>. Botones Abrir, Cambiar y Quitar.' },
      { t: 'Plan escrito', p: 'Tu plan en texto dentro de la app, con contador de palabras y modos Leer y Editar.' },
    ],
  },

  cuentas: {
    titulo: 'Cuentas',
    intro: 'Tus cuentas de fondeo o propias: su capital, cómo van y en qué fase están.',
    bloques: [
      { t: 'Qué ves', lista: [
        'Cada cuenta con su capital, su equity, el drawdown y los días que lleva sin operar. Las cuentas de fondeo caducan por inactividad: el aviso sale en naranja a los 7 días y en rojo a los 14.',
        'Dentro de cada cuenta: la curva de equity, el P&L mensual, sus trades, los retiros y los ajustes.',
        '<b>Ver calendario</b>: abre el Calendario con solo esa cuenta.',
      ] },
      { t: 'Riesgo y rotación', p: 'Si tienes activada la gestión de riesgo, verás las pestañas <b>Riesgo CFD</b> (escalado por niveles según el drawdown) y <b>Riesgo Futuros</b> (riesgo fijo y rotación por grupos de copiado). Con un SL, la rotación pasa a la siguiente cuenta. La etiqueta <b>Toca</b> de la columna Hoy te dice cuál usar.' },
      { t: 'Cortacircuitos: límite de SL por cuenta y día', lista: [
        'Actívalo en Ajustes → Módulos y elige tu límite (de 1 a 5 SL; si no eliges, 1).',
        'Cuando una cuenta llega al límite, la app te avisa en grande de que pares y la cuenta sale <b>Parada hoy</b> aquí y en la columna Hoy.',
        'Si apuntas otro trade en esa cuenta el mismo día, la confirmación te lo advierte antes de guardar. Apúntalo igual si ya está hecho: el diario tiene que reflejar lo que pasó.',
        'No bloquea tu plataforma: es tu regla puesta delante de tus ojos. Las cuentas se queman fuera del plan, no por un SL.',
      ] },
      { t: 'Retiros', p: 'Al registrar un retiro, la app te pide el saldo con el que queda la cuenta. Así el equity cuadra con lo que ves en tu prop firm.' },
      { t: 'Firmas que usamos en Tradinverso', lista: [
        'Al final de la página, filtrables por Futuros o CFDs.',
        '<b>Earn2Trade</b> es la empresa colaboradora oficial: la que recomendamos para escalar.',
        'Cada firma lleva su código con botón Copiar y el enlace a su web. Si no tiene código, entra desde el enlace.',
      ] },
      { t: 'Si no llevas tus cuentas en la app', p: 'En Ajustes → Módulos puedes desactivar el <b>Seguimiento de trades en cuentas</b>. Las cuentas se quedan para la Contabilidad, sin equity. No se borra nada.' },
    ],
  },

  contabilidad: {
    titulo: 'Contabilidad',
    intro: 'Lo que has gastado en cuentas, lo que has retirado y lo que te queda en el bolsillo. Es la cuenta de resultados real de tu trading.',
    bloques: [
      { t: 'Qué cuenta', lista: [
        '<b>Compras</b>: lo que pagaste por cada cuenta, también los resets.',
        '<b>Retiros</b>: lo que has cobrado.',
        'El neto: lo que de verdad has ganado o perdido con las prop firms.',
      ] },
      { t: 'Las acciones de cada cuenta', p: 'Reset, Editar y Borrar son iconos. Pasa el ratón por encima para ver qué hace cada uno.' },
      { t: 'Si no la usas', p: 'Puedes ocultar la pestaña en Ajustes → Módulos → Contabilidad. No se borra nada.' },
    ],
  },
};

// Qué página de ayuda corresponde a cada ruta (las pestañas comparten ayuda).
const RUTAS = [
  ['dashboard', ['#/dashboard']],
  ['nuevo', ['#/nuevo']],
  ['calendario', ['#/calendario']],
  ['estrategias', ['#/zonas', '#/nq-londres', '#/nasdaq', '#/liquidez']],
  ['diagnostico', ['#/diagnostico']],
  ['backtesting', ['#/bt-']],
  ['psicotrading', ['#/psicologia', '#/meditaciones', '#/protocolos']],
  ['plan', ['#/plan']],
  ['cuentas', ['#/cuentas', '#/cuenta', '#/riesgo']],
  ['contabilidad', ['#/contabilidad']],
];
export function ayudaDeRuta(hash) {
  const ruta = String(hash || '').split('?')[0];
  for (const [clave, prefijos] of RUTAS) {
    if (prefijos.some(p => p.endsWith('-') ? ruta.startsWith(p) : (ruta === p || ruta.startsWith(p + '/')))) return clave;
  }
  return null;
}

// ── Primeros pasos: solo lo del primer día ──────────────────────────────────
export const PRIMEROS_PASOS = [
  { t: 'Mira la columna Hoy', p: 'A la izquierda tienes tu día: el estado del diario, las noticias de alto impacto, los directos de la semana y tus cuentas. Antes de operar, échale un vistazo: si hay noticia fuerte, mejor no estar dentro.' },
  { t: 'Haz el diario inverso', p: 'Antes de abrir la plataforma, en el botón <b>Diario</b> del Dashboard. Son dos minutos para decidir qué no vas a hacer hoy y cómo vas a reaccionar. Así operas con un plan y no con lo que pida el momento.' },
  { t: 'Completa el checklist', p: 'Antes de la primera operación, en el botón <b>Checklist</b>. Se reactiva cada día y en las aperturas de Londres y Nueva York. Puedes poner tus propios puntos con <b>Editar mi lista</b>.' },
  { t: 'Apunta cada trade', p: 'En <b>Nuevo trade</b>, al cerrarlo. No te saltes «¿has seguido el plan?» ni la sensación al entrar: son las dos preguntas que más te van a enseñar sobre ti.' },
  { t: 'Cierra con el diario del trader', p: 'Al acabar el día, otra vez en <b>Diario</b>. Qué hiciste bien, dónde te saboteaste y qué mejorarás mañana. La app te lo recuerda al día siguiente.' },
  { t: 'Mira tu Disciplina', p: 'En el Dashboard. Mide cómo ejecutas, no cuánto ganas. Aparece a partir de 10 trades. Si un día pierdes siguiendo el plan, apenas baja.' },
];

// ── Qué ha cambiado (para los alumnos que ya usaban la app) ────────────────
export const QUE_HA_CAMBIADO = [
  { t: 'Tus trades de Liquidez siguen ahí', p: 'No se ha borrado nada. Liquidez ya no forma parte de la formación, pero si la usabas puedes activarla o desactivarla en Ajustes → Módulos.' },
  { t: 'Nasdaq ahora son dos', p: '<b>NQ Londres</b> y <b>NQ Nueva York</b>: la misma operativa separada por sesión. Tus trades de Nasdaq están en NQ Nueva York.' },
  { t: 'El menú está arriba', p: 'Todas las páginas están en la barra de arriba. Los Ajustes se abren pulsando tu foto o tu nombre, arriba a la derecha.' },
  { t: 'Una rutina diaria nueva', p: 'La columna <b>Hoy</b> a la izquierda, el <b>diario inverso</b> antes de operar, el <b>diario del trader</b> al cerrar y tu puntuación de <b>Disciplina</b> en el Dashboard.' },
  { t: 'Ayuda en cada página', p: 'Pulsa el botón <b>?</b> junto al título de cualquier página para ver cómo funciona.' },
];

// ── Novedades: la más reciente arriba ───────────────────────────────────────
// Cada cambio de la app añade aquí su línea, en el mismo commit.
export const NOVEDADES = [
  { fecha: '2026-11-20', titulo: 'Cortacircuitos: límite de SL por cuenta', puntos: [
    'El cortacircuitos ahora es un <b>límite de SL por cuenta y día</b> (de 1 a 5). Se activa en Ajustes → Módulos.',
    'Al llegar al límite: aviso grande de parar, la cuenta sale <b>Parada hoy</b> en la columna Hoy y en Mis cuentas, y Nuevo trade te lo advierte si vuelves a apuntar en ella.',
    'Desaparece la pausa de 5 minutos tras el primer SL.',
  ] },
  { fecha: '2026-11-20', titulo: 'Ruedas de winrate con BE', puntos: [
    'Dashboard: las ruedas de cada estrategia enseñan también los <b>BE en gris</b>, junto a los TP en verde y los SL en rojo.',
  ] },
  { fecha: '2026-11-20', titulo: 'Versión 3.0: lo nuevo', puntos: [
    '<b>Rutina diaria</b>: columna Hoy, diario inverso, diario del trader, checklist editable y puntuación de Disciplina.',
    '<b>Estrategias</b>: Nasdaq se divide en NQ Londres y NQ Nueva York. Liquidez pasa a ser un módulo opcional para quien ya la usaba.',
    '<b>Dinero real</b>: resultado en $ en cada trade, calendario en dólares y tus cuentas siempre a la vista.',
    '<b>A tu gusto</b>: 6 temas, colores, letra, módulos activables, trofeos y exportación a Excel, CSV o PDF.',
    'También cambia el aspecto: menú arriba, iconos limpios y un estilo más moderno.',
  ] },
  { fecha: '2026-11-20', titulo: 'Ayuda y calendario en dólares', puntos: [
    'Ayuda dentro de la app: botón <b>?</b> en cada página, y Primeros pasos y Novedades en Ajustes → Ayuda.',
    'Calendario: elige entre <b>% Sistema</b>, <b>% Real</b> o <b>Dólares</b>, con números más grandes. El resumen del mes enseña los tres.',
    'Calendario: filtro por <b>una cuenta, varias o un grupo</b>, y botón <b>Ver calendario</b> en cada cuenta.',
    'Nuevo trade: <b>Resultado en $</b> a mano para los trades sin cuenta.',
    'Columna Hoy: Formación con el logo de Tradinverso y Prop firms con los logos de las firmas.',
  ] },
  { fecha: '2026-11-18', titulo: 'NQ Londres, columna Hoy fija y directos', puntos: [
    'Nueva estrategia <b>NQ Londres</b>. Nasdaq pasa a llamarse <b>NQ Nueva York</b>.',
    '<b>Liquidez</b> sale de la formación: quien la usaba la conserva y puede activarla o desactivarla en Módulos.',
    'La barra de arriba y la columna Hoy se quedan fijas al bajar por la página.',
    'Columna Hoy: los <b>directos de toda la semana</b>, el de hoy resaltado y los emitidos con enlace al diferido.',
    'Columna Hoy: solo las cuentas que importan hoy (la que toca usar y las que llevan días paradas).',
    'Prop firms: entra <b>My Funded Futures</b> con el código TRADINVERSO.',
  ] },
  { fecha: '2026-11-17', titulo: 'Módulos', puntos: [
    'Puedes desactivar el <b>seguimiento de trades en cuentas</b> (por tipo) y la pestaña <b>Contabilidad</b>. No se borra nada.',
  ] },
  { fecha: '2026-11-13', titulo: 'Retiros, foto y checklist', puntos: [
    'Al registrar un <b>retiro</b>, el equity de la cuenta se cuadra con su saldo real.',
    'La <b>regla del día</b> pasa a ser un aviso al abrir la app, una vez al día.',
    '<b>Foto de perfil</b> en Ajustes → Perfil.',
    '<b>Checklist editable</b>: cada uno pone sus propios puntos.',
  ] },
  { fecha: '2026-11-12', titulo: 'Diario del día y Disciplina', puntos: [
    '<b>Diario inverso</b> por la mañana y <b>diario del trader</b> al cerrar, con racha y lecciones propias.',
    '<b>Puntuación de Disciplina</b> de 0 a 100 en el Dashboard.',
    'En cada trade: <b>motivo de salida</b> y si entraste <b>tras una pérdida</b>. También puedes apuntar un día sin operar.',
    'Nuevos diagnósticos y el bloque <b>Firmas que usamos en Tradinverso</b> en Cuentas.',
  ] },
  { fecha: '2026-11-11', titulo: 'Ajustes y Ocultar P&L', puntos: [
    'Los <b>Ajustes</b> se abren desde tu foto o nombre, con <b>Trofeos</b> y exportación con filtros (Excel, CSV o PDF).',
    '<b>Ocultar P&L</b> tapa importes y porcentajes en toda la app, gráficos incluidos.',
    'Columna Hoy con las <b>noticias de alto impacto</b> del día y de la semana.',
    'La app se ve mejor en el móvil.',
  ] },
];

// ── HTML de Primeros pasos y Novedades (Ajustes → Ayuda) ──────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaLarga(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return y && m && d ? `${d} de ${MESES[m - 1]} de ${y}` : iso;
}
export function htmlPrimerosPasos() {
  return `<ol class="ay-pasos">${PRIMEROS_PASOS.map(x => `<li><b>${x.t}</b><p>${x.p}</p></li>`).join('')}</ol>`;
}
export function htmlNovedades() {
  return NOVEDADES.map(n => `<div class="ay-nov">
    <div class="ay-nov-fecha">${fechaLarga(n.fecha)}</div>
    <div class="ay-nov-tit">${n.titulo}</div>
    <ul>${n.puntos.map(p => `<li>${p}</li>`).join('')}</ul>
  </div>`).join('');
}
