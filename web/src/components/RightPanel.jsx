import FormatToggle from './FormatToggle';
import PreviewCanvas from './PreviewCanvas';
import ActionButtons from './ActionButtons';

export default function RightPanel({
  selectedProduct,
  format,
  onSetFormat,
  bgImage,
  selectionCount,
  onPrintLabel,
  onExportA4,
  onPrintA4,
  onBatchLabels,
  onBatchA4,
  onClearSelection,
}) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto" style={{ backgroundColor: 'var(--bg)' }}>
      <FormatToggle format={format} onSetFormat={onSetFormat} />
      <PreviewCanvas product={selectedProduct} format={format} bgImage={bgImage} />
      <ActionButtons
        selectedProduct={selectedProduct}
        selectionCount={selectionCount}
        onPrintLabel={onPrintLabel}
        onExportA4={onExportA4}
        onPrintA4={onPrintA4}
        onBatchLabels={onBatchLabels}
        onBatchA4={onBatchA4}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}
