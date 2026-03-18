import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const PORT = 9100;

// ── CORS helpers ──────────────────────────────────────────────────────────────
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  setCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ── Printer helpers ───────────────────────────────────────────────────────────
function listPrinters() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('wmic', ['printer', 'get', 'Name'], {
        encoding: 'utf8',
      });
      return out
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && l !== 'Name');
    } else {
      const out = execFileSync('lpstat', ['-e'], { encoding: 'utf8' });
      return out
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } catch {
    return [];
  }
}

function printPdf(pdfPath, printerName) {
  if (process.platform === 'win32') {
    // Try common SumatraPDF locations
    const candidates = [
      path.join(
        process.env.LOCALAPPDATA || '',
        'SumatraPDF',
        'SumatraPDF.exe',
      ),
      path.join(
        process.env['ProgramFiles'] || '',
        'SumatraPDF',
        'SumatraPDF.exe',
      ),
      path.join(
        process.env['ProgramFiles(x86)'] || '',
        'SumatraPDF',
        'SumatraPDF.exe',
      ),
    ];
    const sumatraPath = candidates.find(
      (p) => p && fs.existsSync(p),
    );
    if (!sumatraPath) {
      throw new Error(
        'SumatraPDF introuvable. Installez-le ou ajoutez-le au PATH.',
      );
    }
    execFileSync(sumatraPath, [
      '-print-to',
      printerName,
      '-silent',
      pdfPath,
    ]);
  } else {
    execFileSync('lp', [
      '-d',
      printerName,
      '-o',
      'media=Custom.36x89mm',
      '-o',
      'orientation-requested=4',
      '-o',
      'fit-to-page',
      pdfPath,
    ]);
  }
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  // GET /status
  if (req.method === 'GET' && req.url === '/status') {
    const printers = listPrinters();
    return json(res, 200, {
      online: true,
      printers,
      hostname: os.hostname(),
    });
  }

  // POST /print
  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const { pdf, printer, copies = 1 } = JSON.parse(body);

        if (!pdf || !printer) {
          return json(res, 400, {
            status: 'error',
            message: 'Champs "pdf" et "printer" requis.',
          });
        }

        const pdfBuffer = Buffer.from(pdf, 'base64');
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(
          tmpDir,
          `goforprice-${Date.now()}.pdf`,
        );

        fs.writeFileSync(tmpFile, pdfBuffer);

        try {
          for (let i = 0; i < copies; i++) {
            printPdf(tmpFile, printer);
          }
          return json(res, 200, { status: 'ok' });
        } finally {
          try {
            fs.unlinkSync(tmpFile);
          } catch {
            // ignore cleanup errors
          }
        }
      } catch (err) {
        return json(res, 500, {
          status: 'error',
          message: err.message || 'Erreur inconnue',
        });
      }
    });
    return;
  }

  // 404 fallback
  json(res, 404, { status: 'error', message: 'Route introuvable' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Print server listening on port ${PORT}`);
  console.log('');
  console.log('Adresses locales :');
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  http://${iface.address}:${PORT}`);
      }
    }
  }
  console.log('');
});
