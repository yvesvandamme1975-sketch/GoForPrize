import { useMemo, useCallback } from 'react';
import { formatPrice } from '../lib/fileReader';

function rowKey(row) {
  return `${row.article}|${row.pvente}`;
}

const MAX_VISIBLE = 200;

export default function ProductTable({
  rows,
  selectedProduct,
  onSelectProduct,
  selectedKeys,
  onToggleSelection,
  onSelectAll,
}) {
  const visibleRows = useMemo(() => rows.slice(0, MAX_VISIBLE), [rows]);
  const visibleKeys = useMemo(() => visibleRows.map(rowKey), [visibleRows]);

  const allChecked = useMemo(() => {
    if (visibleKeys.length === 0) return false;
    return visibleKeys.every((k) => selectedKeys.has(k));
  }, [visibleKeys, selectedKeys]);

  const handleSelectAll = useCallback(() => {
    if (allChecked) {
      // Deselect visible
      const next = new Set(selectedKeys);
      for (const k of visibleKeys) next.delete(k);
      // We need a way to set the full set; use onSelectAll with empty to signal
      // Instead, toggle: if all checked, remove them
      onSelectAll(visibleKeys, true);
    } else {
      onSelectAll(visibleKeys, false);
    }
  }, [allChecked, visibleKeys, selectedKeys, onSelectAll]);

  const selectedKey = selectedProduct ? rowKey(selectedProduct) : null;

  return (
    <div className="flex-1 overflow-auto min-h-0">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--surface)' }}>
          <tr className="border-b" style={{ borderColor: 'var(--border)' }}>
            <th className="w-10 px-2 py-2 text-center">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={handleSelectAll}
                className="w-5 h-5 cursor-pointer accent-[var(--p)]"
              />
            </th>
            <th className="text-left px-2 py-2 font-semibold">Article</th>
            <th className="text-left px-2 py-2 font-semibold w-16">P/L</th>
            <th className="text-right px-2 py-2 font-semibold w-20">Pvente</th>
            <th className="text-right px-2 py-2 font-semibold w-20">PPHT</th>
            <th className="text-right px-2 py-2 font-semibold w-20">PPTTC</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, i) => {
            const key = visibleKeys[i];
            const isSelected = selectedKey === key;
            const isChecked = selectedKeys.has(key);
            return (
              <tr
                key={key}
                className="cursor-pointer"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--row-sel)'
                    : i % 2 === 1
                    ? 'var(--row-alt)'
                    : 'var(--surface)',
                  minHeight: '48px',
                  transition: 'background-color 150ms ease',
                }}
                onClick={() => onSelectProduct(row)}
              >
                <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleSelection(key)}
                    className="w-5 h-5 cursor-pointer accent-[var(--p)]"
                  />
                </td>
                <td className="px-2 py-2 truncate max-w-[200px]">{row.article}</td>
                <td className="px-2 py-2">{row.p_l || ''}</td>
                <td className="px-2 py-2 text-right font-bold" style={{ color: 'var(--p)' }}>
                  {formatPrice(row.pvente)}
                </td>
                <td className="px-2 py-2 text-right">{formatPrice(row.ppro_htva)}</td>
                <td className="px-2 py-2 text-right">{formatPrice(row.ppro)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="text-center py-12" style={{ color: 'var(--muted)' }}>
          Aucun produit charge. Utilisez &quot;Charger Excel&quot; pour commencer.
        </div>
      )}
    </div>
  );
}

export { rowKey };
