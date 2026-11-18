// Estrategia Liquidez: retirada para los alumnos nuevos, disponible para los
// antiguos. No se borra nada: trades, backtests y resultados se quedan; lo que
// cambia es si se enseña y si cuenta en los resultados.
//
//   · Antiguo  = alta ANTERIOR al día del paso a producción (LIQUIDEZ_CORTE).
//                La ve por defecto y puede apagarla o encenderla.
//   · Nuevo    = alta desde ese día. No la ve ni tiene interruptor.
//   · `profile.liquidez` (true / false) manda sobre la fecha: lo cambia el
//     propio alumno antiguo (Ajustes → Módulos) o el admin a cualquiera.
//
// Sin fecha de corte (null), todos los alumnos actuales cuentan como antiguos.

// 'AAAA-MM-DD'. Se rellena el día que el cambio pase a producción.
export const LIQUIDEZ_CORTE = null;

// createdAt llega como Timestamp de Firestore, Date, número o texto.
function aMs(c) {
  if (c == null) return null;
  if (typeof c === 'number') return c;
  if (typeof c.seconds === 'number') return c.seconds * 1000;
  if (typeof c.toMillis === 'function') return c.toMillis();
  if (c instanceof Date) return c.getTime();
  const t = Date.parse(c);
  return isNaN(t) ? null : t;
}

// ¿Se dio de alta antes del corte? Un perfil sin fecha de alta es antiguo
// (los primeros alumnos no la tienen guardada).
export function esAntiguo(profile, corte = LIQUIDEZ_CORTE) {
  if (!corte) return true;
  const t = aMs(profile && profile.createdAt);
  if (t == null) return true;
  return t < Date.parse(corte + 'T00:00:00');
}

// ¿Puede este alumno encender o apagar Liquidez? (¿se le enseña el interruptor?)
export function liquidezDisponible(profile, corte = LIQUIDEZ_CORTE) {
  if (profile && profile.liquidez === true) return true;   // se la activó el admin
  return esAntiguo(profile, corte);
}

// ¿La tiene activa ahora mismo?
export function liquidezActivaDe(profile, corte = LIQUIDEZ_CORTE) {
  if (profile && profile.liquidez === true) return true;
  if (profile && profile.liquidez === false) return false;
  return esAntiguo(profile, corte);
}
