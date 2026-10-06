"use client";

import * as React from 'react';
import { Search, Loader2, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GeoResult } from '@/lib/location';

interface Props {
  onSelect: (r: GeoResult) => void;
  className?: string;
  autoFocus?: boolean;
}

export function LocationSearch({ onSelect, className, autoFocus }: Props) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/location?q=${encodeURIComponent(q)}`);
        const json = (await res.json()) as { results: GeoResult[] };
        if (!cancelled) {
          setResults(json.results || []);
          setOpen(true);
          setActive(-1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  // Click-outside to close
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const select = (r: GeoResult) => {
    onSelect(r);
    setQ(r.name);
    setOpen(false);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[active] ?? results[0];
      if (r) select(r);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-amber-300/80" />
        <input
          type="text"
          autoFocus={autoFocus}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search your farm, city, district or region..."
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-12 py-4 font-sans text-base text-foreground placeholder:text-muted-foreground/60 backdrop-blur-md outline-none transition-all focus:border-amber-400/40 focus:bg-black/50 focus:ring-2 focus:ring-amber-400/20"
          aria-label="Search location"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-results"
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground/70" />
        )}
        {!loading && q && (
          <button
            type="button"
            onClick={() => { setQ(''); setResults([]); setOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id="location-results"
          role="listbox"
          className="absolute z-50 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-white/10 bg-card/95 p-1 shadow-2xl backdrop-blur-md fs-scroll"
        >
          {results.map((r, i) => (
            <li key={`${r.id}-${r.latitude}-${r.longitude}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => select(r)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  i === active ? 'bg-amber-400/15 text-amber-200' : 'hover:bg-white/5',
                )}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-amber-300/80" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {[r.admin2, r.admin1, r.country].filter(Boolean).join(', ')}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                  {Math.abs(r.latitude).toFixed(2)}° {r.latitude >= 0 ? 'N' : 'S'}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
