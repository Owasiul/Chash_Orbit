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

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

const panelClass =
  'absolute z-50 mt-2 w-full rounded-2xl border border-white/10 bg-card/95 shadow-2xl backdrop-blur-md';

export function LocationSearch({ onSelect, className, autoFocus }: Props) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false); // a search finished for the current query
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const skipNextSearch = React.useRef(false);

  const listId = React.useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Debounced search
  React.useEffect(() => {
    // After picking a result we set q to the result name — don't search for it again
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const query = q.trim();

    if (query.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      setSearched(false);
      setError(false);
      setActive(-1);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(false);

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/location?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Location request failed: ${res.status}`);
        const json = (await res.json()) as { results?: GeoResult[] };
        if (controller.signal.aborted) return;

        setResults(json.results ?? []);
        setSearched(true);
        setActive(-1);
        // Only open if the user is still interacting with the search box
        setOpen(containerRef.current?.contains(document.activeElement) ?? false);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setResults([]);
        setError(true);
        setSearched(true);
        setActive(-1);
        setOpen(containerRef.current?.contains(document.activeElement) ?? false);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [q]);

  // Click-outside to close
  React.useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);

  const select = (r: GeoResult) => {
    onSelect(r);
    // If the name is identical, setQ is a no-op and the effect won't run,
    // so only arm the skip flag when q will actually change.
    if (r.name !== q) skipNextSearch.current = true;
    setQ(r.name);
    setResults([]);
    setSearched(false);
    setError(false);
    setLoading(false);
    setActive(-1);
    setOpen(false);
  };

  const moveActive = (next: number) => {
    setActive(next);
    requestAnimationFrame(() => {
      document.getElementById(optionId(next))?.scrollIntoView({ block: 'nearest' });
    });
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Don't hijack keys while an IME (Bangla, Japanese, etc.) is composing text
    if (e.nativeEvent.isComposing) return;

    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(Math.min(active + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      moveActive(Math.max(active - 1, 0));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      const r = results[active] ?? results[0];
      if (r) select(r);
    }
  };

  const statusMessage = error
    ? "Couldn't load locations. Check your connection and try again."
    : searched && !loading && results.length === 0
      ? 'No locations found. Try a different spelling or a nearby city.'
      : null;

  const showList = open && results.length > 0;
  const showStatus = open && !showList && statusMessage !== null;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-amber-300/80" />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={handleKey}
          onFocus={() => (results.length > 0 || statusMessage) && setOpen(true)}
          placeholder="Search your farm, city, district or region..."
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-12 py-4 font-sans text-base text-foreground placeholder:text-muted-foreground/60 backdrop-blur-md outline-none transition-all focus:border-amber-400/40 focus:bg-black/50 focus:ring-2 focus:ring-amber-400/20"
          aria-label="Search location"
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground/70" />
        )}
        {!loading && q && (
          <button
            type="button"
            onClick={() => {
              setQ('');
              setResults([]);
              setOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={cn(panelClass, 'max-h-80 overflow-y-auto p-1 fs-scroll')}
        >
          {results.map((r, i) => (
            <li
              key={`${r.id}-${r.latitude}-${r.longitude}`}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              // keep focus on the input so keyboard navigation keeps working
              onMouseDown={e => e.preventDefault()}
              onClick={() => select(r)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
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
              <div className="shrink-0 text-right font-mono text-[10px] leading-4 text-muted-foreground/70">
                <div>
                  {Math.abs(r.latitude).toFixed(2)}° {r.latitude >= 0 ? 'N' : 'S'}
                </div>
                <div>
                  {Math.abs(r.longitude).toFixed(2)}° {r.longitude >= 0 ? 'E' : 'W'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showStatus && (
        <div
          role="status"
          className={cn(
            panelClass,
            'px-4 py-3 text-sm',
            error ? 'text-red-300' : 'text-muted-foreground',
          )}
        >
          {statusMessage}
        </div>
      )}
    </div>
  );
}