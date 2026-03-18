import { useState } from 'react';

const FIELDS = [
  { key: 'article', label: 'Article *', required: true },
  { key: 'pvente', label: 'Prix de vente *', required: true },
  { key: 'ppro', label: 'Prix pro TTC *', required: true },
  { key: 'ppro_htva', label: 'Prix pro HTVA *', required: true },
  { key: 'origine', label: 'Origine', required: false },
  { key: 'p_l', label: 'Prix/Litre', required: false },
];

export default function MappingDialog({ headers, mapping, onConfirm, onCancel }) {
  const [local, setLocal] = useState(() => ({ ...mapping }));

  const handleChange = (key, value) => {
    setLocal((prev) => ({ ...prev, [key]: value || null }));
  };

  const missingRequired = FIELDS.filter((f) => f.required && !local[f.key]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div
        className="rounded-xl shadow-2xl p-6 w-full max-w-md"
        style={{ backgroundColor: 'var(--surface)' }}
      >
        <h2 className="text-lg font-bold mb-4">Correspondance des colonnes</h2>

        <div className="flex flex-col gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium mb-1">{f.label}</label>
              <select
                value={local[f.key] || ''}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="w-full px-3 py-2 rounded-md border text-sm"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }}
              >
                <option value="">(ignore)</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => onConfirm(local)}
            disabled={missingRequired.length > 0}
            className="flex-1 py-2.5 rounded-md text-sm font-semibold text-white cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: 'var(--p)',
              transition: 'background-color 200ms ease',
            }}
          >
            Confirmer
          </button>
          <button
            onClick={onCancel}
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
