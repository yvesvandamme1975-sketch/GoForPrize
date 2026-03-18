import { useState, useCallback, useMemo } from 'react';
import SearchBar from './SearchBar';
import ProductTable, { rowKey } from './ProductTable';
import HistoryPanel from './HistoryPanel';
import { searchProducts } from '../lib/search';

export default function LeftPanel({
  rows,
  selectedProduct,
  onSelectProduct,
  selectedKeys,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  history,
  onHistorySelect,
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleSearch = useCallback(
    (q) => {
      setQuery(q);
      const { suggestions: s } = searchProducts(rows, q);
      setSuggestions(s);
    },
    [rows]
  );

  const filteredRows = useMemo(() => {
    const { results } = searchProducts(rows, query);
    return results;
  }, [rows, query]);

  const handleSelectAll = useCallback(
    (visibleKeys, isRemove) => {
      if (isRemove) {
        // Need to remove these keys from selection
        onDeselectAll(visibleKeys);
      } else {
        onSelectAll(visibleKeys);
      }
    },
    [onSelectAll, onDeselectAll]
  );

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ width: '420px', borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
    >
      <SearchBar onSearch={handleSearch} suggestions={suggestions} />
      <ProductTable
        rows={filteredRows}
        selectedProduct={selectedProduct}
        onSelectProduct={onSelectProduct}
        selectedKeys={selectedKeys}
        onToggleSelection={onToggleSelection}
        onSelectAll={handleSelectAll}
      />
      <HistoryPanel history={history} onSelect={onHistorySelect} />
    </div>
  );
}
