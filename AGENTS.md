# Instrucciones del proyecto

- Lee `README.md` antes de modificar la aplicacion.
- `origin` apunta al repositorio de pruebas `Tradinverso/panelprueba`.
- Esta carpeta es solo de pruebas: no tiene remoto de produccion. La
  promocion a `Tradinverso/panel` se hace desde la carpeta hermana
  `..\tradinverso - panel principal`, en su propio hilo y con autorizacion
  explicita.
- La aplicacion es estatica y usa modulos ES. Sirvela por HTTP para probarla.
- Conserva la compatibilidad del modelo de datos de `localStorage`; un cambio de
  esquema necesita una ruta de migracion o exportacion.
- No versionar datos reales de trading, alumnos, credenciales ni configuraciones
  locales. `.claude/settings.local.json` debe seguir ignorado.
- Revisa las vistas principales, importacion y exportacion antes de dar por
  terminado un cambio.
- Ayuda dentro de la app: cada cambio actualiza, en el mismo commit, la ayuda
  de la pagina que toca y anade una linea a Novedades (todo en
  `js/utils/ayuda.js`, la mas reciente arriba). El manual nunca va por detras.
