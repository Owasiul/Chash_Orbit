"use client";

import { cn } from '@/lib/utils';

// 'derived' = computed from a NASA source via a model (e.g. soil moisture
// derived from POWER precipitation + water-balance). This is distinct from
// 'demo' (no NASA source at all) and from 'live' (directly measured by NASA).
export type DataSource = 'live' | 'cached' | 'demo' | 'derived';

const STYLES: Record<DataSource, { label: string; dot: string; text: string; bg: string }> = {
  live: {
    label: 'LIVE NASA DATA',
    dot: 'bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]',
    text: 'text-emerald-300',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
  },
  cached: {
    label: 'CACHED DATA',
    dot: 'bg-amber-400 shadow-[0_0_8px_2px_rgba(251,191,36,0.5)]',
    text: 'text-amber-300',
    bg: 'bg-amber-500/10 border-amber-500/30',
  },
  derived: {
    label: 'DERIVED ESTIMATE',
    dot: 'bg-sky-400 shadow-[0_0_8px_2px_rgba(56,189,248,0.5)]',
    text: 'text-sky-300',
    bg: 'bg-sky-500/10 border-sky-500/30',
  },
  demo: {
    label: 'DEMO DATA',
    dot: 'bg-rose-400 shadow-[0_0_8px_2px_rgba(251,113,133,0.5)]',
    text: 'text-rose-300',
    bg: 'bg-rose-500/10 border-rose-500/30',
  },
};

interface Props {
  source: DataSource;
  size?: 'sm' | 'md';
  className?: string;
  showLabel?: boolean;
}

export function DataSourceBadge({ source, size = 'md', className, showLabel = true }: Props) {
  const s = STYLES[source] ?? STYLES.demo; // safe fallback so we never crash
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-wider',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-[11px]',
        s.bg,
        s.text,
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        {source === 'live' && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', s.dot)} />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', s.dot)} />
      </span>
      {showLabel && <span>{s.label}</span>}
    </span>
  );
}
