import { getConfig } from './config';

export async function checkPrintServer() {
  const url = getConfig('printer_url');
  if (!url) return { online: false, printers: [], hostname: '' };
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/status`, { signal: controller.signal });
    return await res.json();
  } catch {
    return { online: false, printers: [], hostname: '' };
  }
}

export async function printLabel(pdfBytes, printerName, copies = 1) {
  const url = getConfig('printer_url');
  if (!url) throw new Error("Configurez le serveur dans Parametres");
  // Convert Uint8Array to base64
  let binary = '';
  const bytes = new Uint8Array(pdfBytes);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const res = await fetch(`${url}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdf: base64, printer: printerName, copies }),
  });
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message || 'Erreur impression');
  return data;
}
