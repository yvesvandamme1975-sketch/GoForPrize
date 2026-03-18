const MAX_SHOWN = 20;

export default function HistoryPanel({ history, onSelect }) {
  if (history.length === 0) return null;

  return (
    <div className="border-t px-3 py-2" style={{ borderColor: 'var(--border)' }}>
      <h3 className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>
        Historique
      </h3>
      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {history.slice(0, MAX_SHOWN).map((entry, i) => (
          <button
            key={i}
            onClick={() => onSelect(entry)}
            className="flex items-center gap-2 text-left text-xs px-2 py-1.5 rounded cursor-pointer"
            style={{ transition: 'background-color 150ms ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--row-alt)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span
              className="px-1.5 py-0.5 rounded text-white font-bold shrink-0"
              style={{
                backgroundColor: entry.format === 'label' ? 'var(--p)' : '#16A34A',
                fontSize: '10px',
              }}
            >
              {entry.format === 'label' ? 'ETIQ' : 'A4'}
            </span>
            <span className="truncate flex-1">{entry.article}</span>
            <span style={{ color: 'var(--muted)' }}>{entry.timestamp}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
