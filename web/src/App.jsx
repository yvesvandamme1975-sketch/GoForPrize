import { useEffect, useCallback, useRef, useState } from 'react';
import './App.css';

import { useStore } from './hooks/useStore';
import { ToastProvider, useToast } from './components/Toast';
import Header from './components/Header';
import InstallBanner from './components/InstallBanner';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import MappingDialog from './components/MappingDialog';
import SettingsDialog from './components/SettingsDialog';

import { parseFile } from './lib/fileReader';
import { autoMap, missingRequired, applyMapping } from './lib/columnMapper';
import { coerceRow } from './lib/fileReader';
import { getHistory, addHistory } from './lib/history';
import { checkPrintServer, printLabel as printLabelApi } from './lib/printClient';
import { generateLabel, generateA4, mergePdfs, downloadPdf } from './lib/pdfGenerator';
import { getLabelSizeInfo, getConfig } from './lib/config';
import { rowKey } from './components/ProductTable';

function AppInner() {
  const store = useStore();
  const toast = useToast();

  const [dragging, setDragging] = useState(false);
  const [bgImage, setBgImage] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingHeaders, setPendingHeaders] = useState([]);
  const [pendingMapping, setPendingMapping] = useState({});

  const dragCounter = useRef(0);

  // Load history on mount
  useEffect(() => {
    store.setHistory(getHistory());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load A4 background image
  useEffect(() => {
    const img = new Image();
    img.src = '/a4layout_bg.png';
    img.onload = () => setBgImage(img);
    img.onerror = () => {
      // Try PDF? No, we need a PNG. Just leave null.
      setBgImage(null);
    };
  }, []);

  // Printer status check every 10s
  useEffect(() => {
    const check = async () => {
      const status = await checkPrintServer();
      store.setPrinterStatus(status);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // File loading
  const handleFileLoad = useCallback(
    async (file) => {
      try {
        const { headers, rows, mapping } = await parseFile(file);
        if (rows.length === 0) {
          toast('Fichier vide ou non reconnu', 'error');
          return;
        }
        const missing = missingRequired(mapping);
        if (missing.length > 0) {
          // Show mapping dialog
          setPendingFile(file);
          setPendingHeaders(headers);
          setPendingMapping(mapping);
          store.setShowMapping(true);
        } else {
          store.setHeaders(headers);
          store.setRows(rows);
          store.setMapping(mapping);
          store.setFileName(file.name);
          store.setSelectedProduct(null);
          toast(`${rows.length} produits charges`);
        }
      } catch (err) {
        toast('Erreur de lecture: ' + err.message, 'error');
      }
    },
    [store, toast]
  );

  // Mapping confirm
  const handleMappingConfirm = useCallback(
    async (newMapping) => {
      store.setShowMapping(false);
      if (!pendingFile) return;
      try {
        const { headers, rows } = await parseFile(pendingFile, newMapping);
        store.setHeaders(headers);
        store.setRows(rows);
        store.setMapping(newMapping);
        store.setFileName(pendingFile.name);
        store.setSelectedProduct(null);
        toast(`${rows.length} produits charges`);
      } catch (err) {
        toast('Erreur: ' + err.message, 'error');
      }
      setPendingFile(null);
    },
    [pendingFile, store, toast]
  );

  const handleMappingCancel = useCallback(() => {
    store.setShowMapping(false);
    setPendingFile(null);
  }, [store]);

  // History select
  const handleHistorySelect = useCallback(
    (entry) => {
      store.setSelectedProduct(entry);
      store.setFormat(entry.format || 'label');
    },
    [store]
  );

  // Selection helpers
  const handleSelectAll = useCallback(
    (keys) => {
      store.selectAll(keys);
    },
    [store]
  );

  const handleDeselectAll = useCallback(
    (keys) => {
      store.setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.delete(k);
        return next;
      });
    },
    [store]
  );

  // Get selected products from rows
  const getSelectedProducts = useCallback(() => {
    return store.rows.filter((r) => store.selectedKeys.has(rowKey(r)));
  }, [store.rows, store.selectedKeys]);

  // Action handlers
  const handlePrintLabel = useCallback(async () => {
    if (!store.selectedProduct) return;
    try {
      const sizeOpts = getLabelSizeInfo();
      const pdfBytes = await generateLabel(store.selectedProduct, sizeOpts);
      const printer = getConfig('selected_printer');
      await printLabelApi(pdfBytes, printer);
      const newHistory = addHistory(store.selectedProduct, 'label');
      store.setHistory(newHistory);
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  }, [store, toast]);

  const handleExportA4 = useCallback(async () => {
    if (!store.selectedProduct) return;
    try {
      const pdfBytes = await generateA4(store.selectedProduct);
      const name = (store.selectedProduct.article || 'produit').slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
      downloadPdf(pdfBytes, `A4_${name}.pdf`);
      const newHistory = addHistory(store.selectedProduct, 'a4');
      store.setHistory(newHistory);
      toast('PDF A4 exporte');
    } catch (err) {
      toast('Erreur export: ' + err.message, 'error');
    }
  }, [store, toast]);

  const handlePrintA4 = useCallback(async () => {
    if (!store.selectedProduct) return;
    try {
      const pdfBytes = await generateA4(store.selectedProduct);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      const newHistory = addHistory(store.selectedProduct, 'a4');
      store.setHistory(newHistory);
      toast('A4 ouvert pour impression');
    } catch (err) {
      toast('Erreur: ' + err.message, 'error');
    }
  }, [store, toast]);

  const handleBatchLabels = useCallback(async () => {
    const products = getSelectedProducts();
    if (products.length === 0) return;
    try {
      const sizeOpts = getLabelSizeInfo();
      const printer = getConfig('selected_printer');
      for (const p of products) {
        const pdfBytes = await generateLabel(p, sizeOpts);
        await printLabelApi(pdfBytes, printer);
        addHistory(p, 'label');
      }
      toast(`${products.length} etiquettes imprimees`);
      store.setHistory(getHistory());
    } catch (err) {
      toast('Erreur batch: ' + err.message, 'error');
    }
  }, [getSelectedProducts, store, toast]);

  const handleBatchA4 = useCallback(async () => {
    const products = getSelectedProducts();
    if (products.length === 0) return;
    try {
      const pdfArrays = [];
      for (const p of products) {
        const pdfBytes = await generateA4(p);
        pdfArrays.push(pdfBytes);
        addHistory(p, 'a4');
      }
      const merged = await mergePdfs(pdfArrays);
      const blob = new Blob([merged], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      store.setHistory(getHistory());
      toast(`${products.length} A4 generes`);
    } catch (err) {
      toast('Erreur batch A4: ' + err.message, 'error');
    }
  }, [getSelectedProducts, store, toast]);

  // Drag & drop
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (['xlsx', 'xls', 'csv'].includes(ext)) {
          handleFileLoad(file);
        } else {
          toast('Format non supporte. Utilisez .xlsx, .xls ou .csv', 'error');
        }
      }
    },
    [handleFileLoad, toast]
  );

  return (
    <div
      className="flex flex-col h-screen"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Header
        fileName={store.fileName}
        onFileLoad={handleFileLoad}
        printerStatus={store.printerStatus}
        onOpenSettings={() => store.setShowSettings(true)}
      />
      <InstallBanner />

      {/* Drop zone banner */}
      {dragging && (
        <div
          className="py-3 text-center text-white font-semibold text-sm"
          style={{ backgroundColor: 'var(--p)' }}
        >
          Deposez votre fichier Excel ici
        </div>
      )}

      {/* Main two-column layout */}
      <div className="flex flex-1 min-h-0">
        <LeftPanel
          rows={store.rows}
          selectedProduct={store.selectedProduct}
          onSelectProduct={store.setSelectedProduct}
          selectedKeys={store.selectedKeys}
          onToggleSelection={store.toggleSelection}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          history={store.history}
          onHistorySelect={handleHistorySelect}
        />
        <RightPanel
          selectedProduct={store.selectedProduct}
          format={store.format}
          onSetFormat={store.setFormat}
          bgImage={bgImage}
          selectionCount={store.selectedKeys.size}
          onPrintLabel={handlePrintLabel}
          onExportA4={handleExportA4}
          onPrintA4={handlePrintA4}
          onBatchLabels={handleBatchLabels}
          onBatchA4={handleBatchA4}
          onClearSelection={store.clearSelection}
        />
      </div>

      {/* Dialogs */}
      {store.showMapping && (
        <MappingDialog
          headers={pendingHeaders}
          mapping={pendingMapping}
          onConfirm={handleMappingConfirm}
          onCancel={handleMappingCancel}
        />
      )}

      {store.showSettings && (
        <SettingsDialog
          onClose={() => store.setShowSettings(false)}
          onStatusUpdate={store.setPrinterStatus}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
