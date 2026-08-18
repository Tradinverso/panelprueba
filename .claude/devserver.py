# Servidor estático de desarrollo para previsualizar la app.
#
# Igual que `python -m http.server`, pero mandando Cache-Control: no-store.
# Sin eso el navegador cachea los ES modules y sigue ejecutando la versión
# anterior de un .js recién editado, aunque recargues.
#
# ThreadingHTTPServer (no TCPServer): con un solo hilo, una conexión keep-alive
# del navegador bloquea todas las demás peticiones y la página se queda colgada.
import http.server

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


http.server.ThreadingHTTPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Sirviendo en http://localhost:{PORT} (sin cache)')
    httpd.serve_forever()
