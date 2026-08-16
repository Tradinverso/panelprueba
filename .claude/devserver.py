# Servidor estático de desarrollo para previsualizar la app.
#
# Igual que `python -m http.server`, pero mandando Cache-Control: no-store.
# Sin eso el navegador cachea los ES modules y sigue ejecutando la versión
# anterior de un .js recién editado, aunque recargues.
import http.server
import socketserver

PORT = 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(('', PORT), NoCacheHandler) as httpd:
    print(f'Sirviendo en http://localhost:{PORT} (sin cache)')
    httpd.serve_forever()
