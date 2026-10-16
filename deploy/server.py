"""Private static preview; immutable release mounted read-only, no directory listings."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit
from functools import partial
import os


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if any(part.startswith('.') for part in unquote(urlsplit(self.path).path).split('/')):
            self.send_error(403)
            return
        super().do_GET()

    def do_HEAD(self):
        if any(part.startswith('.') for part in unquote(urlsplit(self.path).path).split('/')):
            self.send_error(403)
            return
        super().do_HEAD()

    def list_directory(self, path):
        self.send_error(403)
        return None

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()


if __name__ == '__main__':
    ThreadingHTTPServer(('0.0.0.0', 8080), partial(Handler, directory=os.environ['SITE_ROOT'])).serve_forever()
