export default function ActionButtons({
  selectedProduct,
  selectionCount,
  onPrintLabel,
  onExportA4,
  onPrintA4,
  onBatchLabels,
  onBatchA4,
  onClearSelection,
}) {
  const hasProduct = !!selectedProduct;
  const hasBatch = selectionCount > 0;

  return (
    <div className="px-4 py-3 flex flex-col gap-2">
      {/* Row 1: single product actions */}
      <div className="flex gap-2">
        <button
          onClick={onPrintLabel}
          disabled={!hasProduct}
          className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--p)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--p-dk)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--p)'; }}
        >
          Imprimer etiquette
        </button>
        <button
          onClick={onExportA4}
          disabled={!hasProduct}
          className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--navy)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--nav2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--navy)'; }}
        >
          Exporter PDF A4
        </button>
        <button
          onClick={onPrintA4}
          disabled={!hasProduct}
          className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--navy)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--nav2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--navy)'; }}
        >
          Imprimer A4
        </button>
      </div>

      {/* Row 2: batch actions */}
      <div className="flex gap-2">
        <button
          onClick={onBatchLabels}
          disabled={!hasBatch}
          className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--p)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--p-dk)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--p)'; }}
        >
          Etiquettes ({selectionCount})
        </button>
        <button
          onClick={onBatchA4}
          disabled={!hasBatch}
          className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--navy)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
          onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = 'var(--nav2)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--navy)'; }}
        >
          A4 ({selectionCount})
        </button>
        <button
          onClick={onClearSelection}
          disabled={!hasBatch}
          className="py-2.5 px-4 rounded-md text-sm font-semibold cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'var(--border)',
            color: 'var(--text)',
            transition: 'background-color 200ms ease, opacity 200ms ease',
          }}
        >
          Decocher tout
        </button>
      </div>
    </div>
  );
}
