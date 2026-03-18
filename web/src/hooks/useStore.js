import { useState, useCallback, useRef } from 'react';

export function useStore() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [fileName, setFileName] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [format, setFormat] = useState('label');
  const [printerStatus, setPrinterStatus] = useState({ online: false, printers: [], hostname: '' });
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showMapping, setShowMapping] = useState(false);

  // Use a ref for stable key-set mutations
  const selectedKeysRef = useRef(selectedKeys);
  selectedKeysRef.current = selectedKeys;

  const toggleSelection = useCallback((key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const selectAll = useCallback((keys) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }, []);

  return {
    rows, setRows,
    headers, setHeaders,
    mapping, setMapping,
    fileName, setFileName,
    selectedProduct, setSelectedProduct,
    selectedKeys, setSelectedKeys,
    format, setFormat,
    printerStatus, setPrinterStatus,
    history, setHistory,
    showSettings, setShowSettings,
    showMapping, setShowMapping,
    toggleSelection,
    clearSelection,
    selectAll,
  };
}
