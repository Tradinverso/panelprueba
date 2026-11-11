# Tradinverso · Trading Journal

SPA local de trading journal y dashboard para David Rosell y la academia Tradinverso.

Reemplaza el dashboard estático `v17.html` con una app completa de:
- Dashboard con franja Pulso (hoy, semana, mes, últimas 4 semanas), KPIs, equity, mensual, por estrategia, timing, heatmap, rachas y duración
- Formulario de entrada de trades por secciones, con atajos TP/SL/BE y resumen lateral en vivo con avisos del plan
- Plan de trading en dos recuadros: documento de Drive embebido + plan escrito (Leer / Editar)
- Vistas dedicadas para Zonas, Liquidez y Nasdaq
- Calendario interactivo
- Diagnóstico técnico y emocional con alertas automáticas
- Importación masiva tipo spreadsheet con paste-from-Excel
- Apariencia: 6 temas (Liquid Glass por defecto), acento, colores TP/SL, letra y densidad
- Persistencia local en `localStorage`

Sin build step, sin npm, sin servidor. Solo HTML/JS/CSS modular.

---

## Cómo arrancar

La app usa ES modules, así que necesita servirse vía HTTP (no funciona abriendo `index.html` directamente).

**Opción 1 — Python (siempre disponible en Windows con Python instalado):**
```
cd tradinverso
python -m http.server 8000
```
Abre `http://localhost:8000`.

**Opción 2 — VSCode Live Server:**
- Instala la extensión "Live Server" de Ritwick Dey
- Click derecho sobre `index.html` → "Open with Live Server"

**Opción 3 — Cualquier hosting estático:**
- Sube la carpeta `tradinverso/` a Netlify, Vercel, GitHub Pages, etc.
- No requiere configuración: solo arrastrar la carpeta.

---

## Cómo importar tus datos del Google Sheet

1. Abre la app y ve a **Importar** en la barra lateral.
2. Tres opciones:

### A) Tabla / Pegar desde Excel (recomendado)
1. Selecciona la estrategia (ZONAS / LIQUIDEZ / NASDAQ).
2. En Google Sheets, copia un rango de filas de la pestaña correspondiente.
3. En la app, click en cualquier celda de la primera columna y pulsa **Ctrl+V**.
4. Las celdas se distribuyen automáticamente. Las columnas calculadas (BALANCE, DD, etc.) aparecen en gris y se ignoran al importar.
5. Revisa el estado por fila (✓ válida · ✗ con errores).
6. Click en **Importar trades**. Los duplicados se ignoran automáticamente.

### B) Desde Apps Script (URL)
1. Pega la URL pública de tu Apps Script (la misma que usaba el `v17.html`).
2. Click en **Importar**.
3. La app trabaja siempre en porcentaje. La conversión interna desde el importe que devuelve el Apps Script es automática y no requiere configuración.

### C) Subir archivo
- Acepta `.json` (formato Apps Script o export propio) y `.csv` (formato export propio).

---

## Configuración

En **Ajustes** puedes:
- Guardar la URL del Apps Script para reimportar más tarde.
- Abrir el panel **Apariencia** (también desde la paleta de la barra lateral): tema, color de acento, colores de TP/SL, estilo de tarjeta, tipo de letra y densidad. Se guarda en la cuenta del usuario (`config.appearance`) y en el navegador.
- Exportar todos tus trades a JSON (backup).
- Borrar trades de una estrategia concreta o borrar todos los datos.

> La gestión de cuentas y la conversión a importes monetarios reales se hará en una sección dedicada más adelante. Aquí toda la operativa va en porcentaje.

---

## Estructura de archivos

```
tradinverso/
  index.html              shell + sidebar
  css/
    themes.css            variables dark/light
    styles.css            layout base
    forms.css             formulario + tabla import
    calendar.css          calendario + heatmap + trade-table
  js/
    app.js                bootstrap + router init
    storage.js            wrapper localStorage
    state.js              estado en memoria + suscripciones
    theme.js              dark/light toggle
    router.js             hash-based router
    views/
      dashboard.js        replica del v17 completo
      new-trade.js        formulario dinámico
      strategy.js         vista parametrizada por sheet
      calendar.js         calendario mensual + lista trades
      diagnostic.js       alertas técnico + emocional
      import-table.js     tabla editable + paste-from-Excel
      settings.js         ajustes + export/wipe
    components/
      topbar.js           barra superior: navegación en píldora, reloj, Apariencia, avatar
      mesa.js             columna "Hoy": checklist, noticias de alto impacto, cuentas, próximos directos, regla del día; recogible a barrita
      footer.js           pie: versión, Formación, Ajustes
      checklist-modal.js  pop-up del checklist pre-sesión
      novedades.js        aviso de novedades, una vez por cuenta (config.novedadesVista)
      appearance-panel.js panel Apariencia (tema, acento, TP/SL, letra, densidad)
      toast.js            toast de confirmación
      pills.js            selector de pills
      modal.js            modal genérico
      kpi-card.js         tarjetas KPI
      charts.js           wrappers de Chart.js
      heatmap.js          heatmap día×hora
      trade-table.js      tabla de trades reutilizable
    utils/
      uuid.js             UUID v4
      date-helpers.js     fechas, horas, slots horarios, días
      pair-normalize.js   EURUSD → EUR/USD, etc.
      number-format-es.js parser de "1.000,50 €" / "2,00%"
      calculations.js     WR, P&L, PF, DD, rachas
      sensaciones.js      grupos y stats por sensación
      diagnostics.js      alertas (buildAlerts), semáforo del día y bloque informativo por par/franja/día (buildPatrones).
                          Umbrales revisados en nov 2026 con datos reales: ver la cabecera del fichero
      paste-parser.js     distribuye contenido pegado
      sheet-parsers.js    columnas exactas por pestaña + validación
      apps-script-import.js mapeo del JSON del endpoint
      csv.js              CSV reader/writer + descarga
      hoy-data.js         lee hoy.json (noticias y directos) de la rama data
      noticias-es.js      titulares de Forex Factory en español
      pnl-mask.js         "Ocultar P&L": tapa importes y porcentajes con •••
```

---

## Modelo de datos (canónico interno)

Cada trade se almacena así en `localStorage.tradinverso_trades`:

```js
{
  id: string,           // UUID
  sheet: 'ZONAS' | 'LIQUIDEZ' | 'NASDAQ',
  date: 'YYYY-MM-DD',
  result: 'TP' | 'SL' | 'BE',
  pnl_pct: number,      // % directo (+2.0 = +2%)
  open_str: 'HH:MM',
  close_str: 'HH:MM',
  open_hour: number,    // decimal
  dur: number,          // minutos
  setup: 'LONG' | 'SHORT',
  pair: 'EUR/USD' | 'GBP/USD' | 'XAU/USD' | 'NQ',
  zone: string,
  entry: string,
  rr: number | null,
  pips: number | null,
  sensacion: string,
  url1: string,
  url2: string,
  reflexion: string,
  createdAt: number
}
```

Resultado derivado: `pnl_pct > 0.2` → `TP`, `pnl_pct < -0.2` → `SL`, resto → `BE`.

---

## Personalización para alumnos

Cada alumno tiene su propio `localStorage`, así que la app es self-contained. Para distribuir:

1. Comparte la carpeta `tradinverso/` (zip, GitHub, hosting estático).
2. Cada alumno empieza a registrar sus trades.
3. Si tienen histórico en Google Sheets, lo pueden importar pegándolo o vía URL del Apps Script.

---

## Stack

- HTML5 + ES6 modules
- CSS variables (sin frameworks CSS)
- Chart.js 4.4.1 vía CDN
- Google Fonts (Inter + DM Mono)
- Sin dependencias de build, sin npm, sin servidor

---

## Diferencias respecto al v17.html

- **Nuevas vistas:** Nuevo trade, vistas dedicadas por estrategia, calendario interactivo, diagnóstico estructurado, importación masiva, ajustes.
- **Persistencia local:** los trades se guardan en `localStorage`, no dependen de Google Sheets para visualizarse.
- **Apariencia:** 6 temas (Midnight, Onyx, Platinum, Light, Liquid Glass y Liquid Glass claro) + acento, TP/SL, letra y densidad. Tokens en `css/themes.css`, temas y componentes en `css/skins.css`, lógica en `js/appearance.js`.
- **Solo porcentaje:** toda la operativa se mide en %; la gestión de cuentas y conversión a importes monetarios se hará en su propia sección.
- **Diagnóstico granular:** alertas técnicas y emocionales separadas en bloques con umbrales explícitos.

---

## Datos de la columna "Hoy" (noticias y directos)

La app es estática, así que no puede leer Forex Factory ni Google Calendar desde el navegador (CORS).
Lo hace una tarea de GitHub Actions del repo de pruebas:

- `.github/workflows/datos-hoy.yml` se ejecuta cada 6 horas (y a mano desde la pestaña Actions).
- `.github/scripts/datos-hoy.mjs` descarga el export semanal de Forex Factory (solo alto impacto, USD/EUR/GBP)
  y, si existe el secreto `CLASES_ICS_URL`, las próximas clases del calendario "Tradinverso Clases"
  (título, hora y el enlace de Zoom del evento: `CLASES_PUBLICAR_ENLACES: 'si'` en el workflow;
  la app solo enseña el enlace desde 30 min antes de empezar).
- El resultado (`hoy.json`) se publica en la rama `data` (un único commit que se sobrescribe).
- La app lo lee en `js/utils/hoy-data.js` desde `raw.githubusercontent.com`, con caché de 10 min
  y una recarga en cada carga de página. Los titulares llegan en inglés y se traducen en
  `js/utils/noticias-es.js` (lo no reconocido se deja en inglés; el original va en el tooltip).
  Producción lee el mismo archivo: `.github/` no se promociona.
