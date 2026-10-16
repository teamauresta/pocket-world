"""Serve the portable site on this computer's loopback address, then open its browser."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import webbrowser


def main():
    here = Path(__file__).resolve().parent
    site = here / 'site'
    if not (site / 'index.html').is_file():
        site = here.parent / 'dist'
    if not (site / 'index.html').is_file():
        raise SystemExit('Missing site/index.html. Keep this launcher next to the portable site folder.')
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(site)))
    url = f'http://127.0.0.1:{server.server_port}/'
    print(f'Pocket World: {url}\nStop with Ctrl+C.', flush=True)
    if '--check' in sys.argv:
        server.server_close()
        return
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
