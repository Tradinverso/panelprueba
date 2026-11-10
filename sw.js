// Service worker mínimo: solo habilita la instalación como app (PWA).
// NO cachea nada → siempre sirve la última versión de la red (sin contenido obsoleto
// mientras seguimos subiendo cambios). El handler de 'fetch' es lo único que Chrome
// exige para mostrar "Instalar app".
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  // Las peticiones con Range (audio/vídeo al buscar/avanzar) NO se interceptan:
  // pasarlas por fetch() dentro del SW rompe la reproducción y el seek, sobre
  // todo en iOS/Safari. Se dejan al navegador, que las sirve nativamente (206).
  if (e.request.headers.has('range')) return;
  // Archivos propios (html, js, css): se revalidan SIEMPRE con el servidor
  // (cache: 'no-cache' → petición condicional; si no ha cambiado, 304 y listo).
  // GitHub Pages manda max-age=600 y el navegador seguía sirviendo la versión
  // anterior hasta 10 min después de cada subida (había que hacer Ctrl+F5).
  // Lo de fuera (fuentes, Chart.js, Firebase) se deja como está.
  const sameOrigin = new URL(e.request.url).origin === self.location.origin;
  e.respondWith(sameOrigin ? fetch(e.request, { cache: 'no-cache' }) : fetch(e.request));
});
