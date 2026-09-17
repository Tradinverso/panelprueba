# Instrucciones del proyecto

- Lee `README.md` antes de modificar la aplicacion.
- `origin` apunta al repositorio de pruebas `Tradinverso/panelprueba`.
- `prod` apunta al repositorio de produccion `Tradinverso/panel`. Las historias
  estan divergidas; no hagas push a `prod` sin una comparacion y autorizacion
  explicitas.
- La aplicacion es estatica y usa modulos ES. Sirvela por HTTP para probarla.
- Conserva la compatibilidad del modelo de datos de `localStorage`; un cambio de
  esquema necesita una ruta de migracion o exportacion.
- No versionar datos reales de trading, alumnos, credenciales ni configuraciones
  locales. `.claude/settings.local.json` debe seguir ignorado.
- Revisa las vistas principales, importacion y exportacion antes de dar por
  terminado un cambio.
