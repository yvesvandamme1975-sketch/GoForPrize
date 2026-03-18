export default function FormatToggle({ format, onSetFormat }) {
  return (
    <div className="flex gap-2 px-4 py-3">
      <button
        onClick={() => onSetFormat('label')}
        className="flex-1 py-2 rounded-md text-sm font-semibold cursor-pointer text-white"
        style={{
          backgroundColor: format === 'label' ? 'var(--p)' : 'var(--border)',
          color: format === 'label' ? '#fff' : 'var(--text)',
          transition: 'background-color 200ms ease, color 200ms ease',
        }}
      >
        Etiquette Dymo
      </button>
      <button
        onClick={() => onSetFormat('a4')}
        className="flex-1 py-2 rounded-md text-sm font-semibold cursor-pointer"
        style={{
          backgroundColor: format === 'a4' ? 'var(--p)' : 'var(--border)',
          color: format === 'a4' ? '#fff' : 'var(--text)',
          transition: 'background-color 200ms ease, color 200ms ease',
        }}
      >
        Affiche A4
      </button>
    </div>
  );
}
