import { useState } from 'react';
import { getConfig, setConfig, LABEL_SIZES } from '../lib/config';
import { checkPrintServer } from '../lib/printClient';

export default function SettingsDialog({ onClose, onStatusUpdate }) {
  const [printerUrl, setPrinterUrl] = useState(() => getConfig('printer_url') || '');
  const [selectedPrinter, setSelectedPrinter] = useState(() => getConfig('selected_printer') || '');
  const [labelSize, setLabelSize] = useState(() => getConfig('label_size') || '89x36');
  const [printers, setPrinters] = useState([]);
  const [testStatus, setTestStatus] = useState('');
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestStatus('');
    // Temporarily save URL for test
    const prevUrl = getConfig('printer_url');
    setConfig('printer_url', printerUrl);
    try {
      const status = await checkPrintServer();
      if (status.online) {
        setTestStatus('Connecte');
        setPrinters(status.printers || []);
        if (onStatusUpdate) onStatusUpdate(status);
      } else {
        setTestStatus('Echec de connexion');
        setPrinters([]);
      }
    } catch {
      setTestStatus('Erreur de connexion');
      setPrinters([]);
    }
    // Restore previous URL if not saving
    setConfig('printer_url', prevUrl);
    setTesting(false);
  };

  const handleSave = () => {
    setConfig('printer_url', printerUrl);
    setConfig('selected_printer', selectedPrinter);
    setConfig('label_size', labelSize);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="rounded-xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <h2 className="text-lg font-bold mb-4">Parametres</h2>

        <div className="flex flex-col gap-4">
          {/* Printer URL */}
          <div>
            <label className="block text-sm font-medium mb-1">URL du serveur d&apos;impression</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={printerUrl}
                onChange={(e) => setPrinterUrl(e.target.value)}
                placeholder="http://192.168.1.x:5000"
                className="flex-1 px-3 py-2 rounded-md border text-sm outline-none"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              />
              <button
                onClick={handleTest}
                disabled={testing || !printerUrl}
                className="px-4 py-2 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--navy)',
                  transition: 'background-color 200ms ease',
                }}
              >
                {testing ? '...' : 'Tester'}
              </button>
            </div>
            {testStatus && (
              <p
                className="text-xs mt-1 font-medium"
                style={{ color: testStatus === 'Connecte' ? '#16A34A' : '#DC2626' }}
              >
                {testStatus}
              </p>
            )}
          </div>

          {/* Printer selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Imprimante</label>
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              <option value="">-- Selectionner --</option>
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Label size */}
          <div>
            <label className="block text-sm font-medium mb-1">Taille d&apos;etiquette</label>
            <select
              value={labelSize}
              onChange={(e) => setLabelSize(e.target.value)}
              className="w-full px-3 py-2 rounded-md border text-sm"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
            >
              {Object.entries(LABEL_SIZES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer"
            style={{
              backgroundColor: 'var(--p)',
              transition: 'background-color 200ms ease',
            }}
          >
            Enregistrer
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold cursor-pointer"
            style={{
              backgroundColor: 'var(--border)',
              color: 'var(--text)',
              transition: 'background-color 200ms ease',
            }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
