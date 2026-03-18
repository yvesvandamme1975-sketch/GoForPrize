import { useRef } from 'react';

export default function Header({ fileName, onFileLoad, onChangeFile, printerStatus, onOpenSettings }) {
  const fileRef = useRef(null);

  const handleFileClick = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileLoad(file);
    e.target.value = '';
  };

  return (
    <header className="h-16 flex items-center px-4 gap-3 shrink-0" style={{ backgroundColor: 'var(--navy)' }}>
      <img src="/logo.png" alt="Logo" className="h-11" />

      <button
        onClick={handleFileClick}
        className="px-4 py-2 rounded-md text-white font-semibold text-sm cursor-pointer"
        style={{ backgroundColor: 'var(--p)', transition: 'background-color 200ms ease' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--p-dk)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--p)')}
      >
        Charger Excel
      </button>

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {fileName && (
        <>
          <span className="text-green-400 text-sm font-medium truncate max-w-48">{fileName}</span>
          <button
            onClick={handleFileClick}
            className="px-3 py-1.5 rounded-md text-white text-sm cursor-pointer border border-white/30"
            style={{ transition: 'background-color 200ms ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Changer
          </button>
        </>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2 text-sm text-white/80">
        <span
          className="w-2.5 h-2.5 rounded-full inline-block"
          style={{ backgroundColor: printerStatus.online ? '#22C55E' : '#EF4444' }}
        />
        <span>{printerStatus.online ? printerStatus.hostname || 'Connecte' : 'Hors ligne'}</span>
      </div>

      <button
        onClick={onOpenSettings}
        className="px-3 py-1.5 rounded-md text-white text-sm cursor-pointer border border-white/30"
        style={{ transition: 'background-color 200ms ease' }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        Parametres
      </button>
    </header>
  );
}
