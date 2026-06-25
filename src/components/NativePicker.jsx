import { useState } from 'react';
import { ChevronDown, X, Check, Search } from 'lucide-react';

/**
 * NativePicker — replaces <select> with a mobile-native bottom sheet.
 * Props:
 *   value, onChange, options: [{value, label}], placeholder, label
 */
export default function NativePicker({ value, onChange, options, placeholder = 'Select…', label }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selected = options.find(o => o.value === value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const pick = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between border border-sand-300 dark:border-border rounded-2xl px-4 py-3 bg-white dark:bg-card text-left focus:outline-none focus:ring-2 focus:ring-terracotta/50 select-none min-h-[44px]"
      >
        <span className={selected ? 'text-foreground font-body' : 'text-muted-foreground font-body'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={close}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative w-full bg-card rounded-t-3xl shadow-2xl flex flex-col"
            style={{ maxHeight: '75vh', paddingBottom: 'var(--safe-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h3 className="font-heading font-semibold text-foreground">{label || placeholder}</h3>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Accept selection"
                  onClick={close}
                  className="p-2 rounded-full bg-moss text-white min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Close picker"
                  onClick={close}
                  className="p-2 rounded-full hover:bg-muted transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Search */}
            {options.length > 12 && (
              <div className="px-4 pt-3 pb-1">
                <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && filtered[0]) {
                        e.preventDefault();
                        pick(filtered[0].value);
                      } else if (e.key === 'Escape') {
                        close();
                      }
                    }}
                    placeholder="Search..."
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none font-body"
                  />
                </div>
              </div>
            )}

            {/* Options list */}
            <div className="overflow-y-auto flex-1 px-2 py-2">
              {filtered.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt.value)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-2xl hover:bg-muted transition-all text-left min-h-[44px] select-none"
                >
                  <span className="text-sm text-foreground font-body">{opt.label}</span>
                  {value === opt.value && <Check className="w-4 h-4 text-terracotta flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
