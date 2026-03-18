import { useState, useRef, useEffect, useCallback } from 'react';

export default function SearchBar({ onSearch, suggestions, onSelect }) {
  const [value, setValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);

  const debouncedSearch = useCallback(
    (q) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onSearch(q), 150);
    },
    [onSearch]
  );

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setValue(v);
    debouncedSearch(v);
    setShowSuggestions(true);
  };

  const handleSelect = (text) => {
    setValue(text);
    setShowSuggestions(false);
    onSearch(text);
    if (onSelect) onSelect(text);
  };

  return (
    <div className="relative px-3 py-2">
      <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>
        Recherche article
      </label>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        className="w-full px-3 py-2 rounded-md border text-sm outline-none"
        style={{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
          transition: 'border-color 200ms ease',
        }}
        placeholder="Tapez pour rechercher..."
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute left-3 right-3 mt-1 rounded-md shadow-lg border z-40 overflow-hidden"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {suggestions.slice(0, 8).map((s, i) => (
            <li
              key={i}
              className="px-3 py-2 text-sm cursor-pointer"
              style={{ transition: 'background-color 150ms ease' }}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--row-alt)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
