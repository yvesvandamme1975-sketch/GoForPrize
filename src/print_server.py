"""
Embedded HTTP print server for the GoForPrice web app.
Runs in a background thread alongside the desktop GUI.
Listens on port 9100, accepts print jobs from the web app.
"""

import json
import os
import socket
import tempfile
import threading
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler

from src.printer import DymoPrinter

PORT = 9100


class PrintHandler(BaseHTTPRequestHandler):
    """Handles /status and /print endpoints for the web app."""

    def log_message(self, format, *args):
        """Suppress default stderr logging."""
        pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def _json(self, status, body):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self._cors()
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == '/status':
            printers = DymoPrinter.list_dymo_printers()
            # Filter out placeholder
            printers = [p for p in printers if p != '(aucune)']
            self._json(200, {
                'online': True,
                'printers': printers,
                'hostname': socket.gethostname(),
            })
        else:
            self._json(404, {'status': 'error', 'message': 'Route introuvable'})

    def do_POST(self):
        if self.path == '/print':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                pdf_b64 = data.get('pdf', '')
                printer = data.get('printer', '')
                copies = data.get('copies', 1)

                if not pdf_b64 or not printer:
                    return self._json(400, {
                        'status': 'error',
                        'message': 'Champs "pdf" et "printer" requis.',
                    })

                pdf_bytes = base64.b64decode(pdf_b64)
                tmp = tempfile.NamedTemporaryFile(
                    suffix='.pdf', prefix='goforprice-', delete=False
                )
                tmp.write(pdf_bytes)
                tmp.close()

                try:
                    for _ in range(copies):
                        DymoPrinter.print_label_pdf(tmp.name, printer)
                    self._json(200, {'status': 'ok'})
                finally:
                    try:
                        os.unlink(tmp.name)
                    except OSError:
                        pass

            except Exception as e:
                self._json(500, {
                    'status': 'error',
                    'message': str(e),
                })
        else:
            self._json(404, {'status': 'error', 'message': 'Route introuvable'})


def start_print_server():
    """Start the print server in a daemon thread. Returns the thread."""
    def run():
        try:
            server = HTTPServer(('0.0.0.0', PORT), PrintHandler)
            print(f"[PrintServer] Listening on port {PORT}")
            server.serve_forever()
        except OSError as e:
            print(f"[PrintServer] Could not start: {e}")

    thread = threading.Thread(target=run, daemon=True, name='PrintServer')
    thread.start()
    return thread
