"use client";

import * as React from 'react';
import { Search, Loader2, MapPin, X, Navigation, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasBengaliScript, type GeoResult } from '@/lib/location';
import { useTranslation } from '@/lib/locale';

interface Props {
  onSelect: (r: GeoResult) => void;
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
  resolving?: boolean;
  selectionError?: string | null;
  onQueryChange?: () => void;
  dropdownPosition?: 'top' | 'bottom';
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

const panelBaseClass =
  'absolute z-50 w-full rounded-2xl border border-white/20 bg-slate-900/98 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl ring-1 ring-black/50';

export function LocationSearch({
  onSelect,
  onClear,
  className,
  autoFocus,
  resolving = false,
  selectionError,
  onQueryChange,
  dropdownPosition = 'bottom',
}: Props) {
  const { locale, t, number } = useTranslation();
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState<GeoResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [locating, setLocating] = React.useState(false);
  const [geoNotice, setGeoNotice] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState(false); // a search finished for the current query
  const [error, setError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(-1);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const skipNextSearch = React.useRef(false);

  const listId = React.useId();
  const optionId = (i: number) => `${listId}-option-${i}`;

  // Geolocation trigger
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoNotice(t('Geolocation is not supported by your browser'));
      setTimeout(() => setGeoNotice(null), 3000);
      return;
    }
    setLocating(true);
    setGeoNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        const gpsResult: GeoResult = {
          id: 888888,
          name: `${t('My Location')} (${lat}°, ${lng}°)`,
          latitude: lat,
          longitude: lng,
          country: t('Current GPS Position'),
          countryCode: '',
          featureCode: 'GPS',
        };
        select(gpsResult);
      },
      (err) => {
        setLocating(false);
        setGeoNotice(err.message || t('Could not acquire GPS position'));
        setTimeout(() => setGeoNotice(null), 4000);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  // Debounced search & coordinate detection
  React.useEffect(() => {
    // After picking a result we set q to the result name — don't search for it again
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    const query = q.trim();

    // Check direct coordinate input: "24.3745, 88.6042" or "24.3745 88.6042"
    const coordMatch = query.match(/^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setResults([
          {
            id: 999999,
            name: `${t('Coordinates')}: ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
            latitude: lat,
            longitude: lng,
            country: t('Direct Coordinate FlyTo'),
            countryCode: '',
            featureCode: 'COORD',
          },
        ]);
        setSearched(true);
        setActive(0);
        setOpen(true);
        setLoading(false);
        return;
      }
    }

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

    const timer = setTimeout(async () => {
      try {
        const language = hasBengaliScript(query) ? 'bn' : locale === 'bn-BD' ? 'bn' : 'en';
        const res = await fetch(
          `/api/location?q=${encodeURIComponent(query)}&language=${language}`,
          {
            signal: controller.signal,
          },
        );
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
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, locale, t]);

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
    ? t('errors.couldn-t-load-locations-check-your-connectio')
    : searched && !loading && results.length === 0
      ? t('No locations found. Try a different spelling or a nearby city.')
      : null;

  const showList = open && results.length > 0;
  const showStatus = open && !showList && statusMessage !== null;

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      <div className="group relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-amber-300" />
        <input
          ref={inputRef}
          type="text"
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          value={q}
          onChange={e => {
            onQueryChange?.();
            setQ(e.target.value);
          }}
          onKeyDown={handleKey}
          onFocus={() => (results.length > 0 || statusMessage) && setOpen(true)}
          placeholder={t('Search city, region, or enter lat, lng (e.g. 24.37, 88.60)...')}
          className="w-full rounded-2xl border border-white/10 bg-black/60 pl-10 pr-28 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 backdrop-blur-md outline-none transition-all focus:border-amber-400/50 focus:bg-black/80 focus:ring-2 focus:ring-amber-400/20"
          aria-label={t('Search location')}
          role="combobox"
          aria-expanded={showList}
          aria-controls={showList ? listId : undefined}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          aria-autocomplete="list"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {(loading || resolving || locating) && (
            <Loader2 className="size-4 animate-spin text-amber-400" />
          )}

          {!loading && !resolving && !locating && q && (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setResults([]);
                setOpen(false);
                onClear?.();
                inputRef.current?.focus();
              }}
              className="rounded-full p-1 text-muted-foreground/70 transition-colors hover:bg-white/10 hover:text-foreground"
              aria-label={t('Clear search')}
            >
              <X className="size-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            title={t('Use my current GPS device location')}
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:border-amber-400/40 hover:bg-amber-400/15 hover:text-amber-200 transition-colors shrink-0"
          >
            <Navigation className={cn("size-3 text-amber-400", locating && "animate-pulse")} />
            <span className="hidden sm:inline text-[10px] font-medium">{t('My GPS')}</span>
          </button>
        </div>
      </div>

      {geoNotice && (
        <div className="absolute top-full mt-2 z-50 rounded-xl border border-amber-400/30 bg-amber-950/95 px-3 py-1.5 text-xs text-amber-200 shadow-xl backdrop-blur-md">
          {geoNotice}
        </div>
      )}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            panelBaseClass,
            dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            'max-h-80 overflow-y-auto p-1 fs-scroll'
          )}
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
                  {number(Math.abs(r.latitude), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}° {r.latitude >= 0 ? 'N' : 'S'}
                </div>
                <div>
                  {number(Math.abs(r.longitude), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}° {r.longitude >= 0 ? 'E' : 'W'}
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
            'px-4 py-3 text-sm',
            error ? 'text-red-300' : 'text-muted-foreground',
          )}
        >
          {statusMessage}
        </div>
      )}

      {resolving && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 text-sm text-muted-foreground"
        >
          {t('Finding exact coordinates and country...')}
        </div>
      )}
      {!resolving && selectionError && (
        <div
          role="status"
          aria-live="polite"
          className="px-4 py-3 text-sm text-amber-200"
        >
          {t(selectionError)}
        </div>
      )}
    </div>
  );
}