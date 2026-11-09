"use client";

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Sprout,
  Sparkles,
  Plus,
  X,
  Loader2,
  Check,
  Layers,
  MapPin,
  Calendar,
  Droplets,
  Sun,
  Coins,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  Info,
  CalendarDays,
  Leaf,
  Clock,
  Sparkle,
  Gauge,
  Wheat,
  ChevronRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppStore, type FullAnalysis } from '@/lib/store';
import type { FarmerInputs } from '@/lib/decision/engine';
import { useTranslation } from '@/lib/locale';
import { FAO_CROPS } from '@/lib/crop-dataset';
import { getCropFarmingStages } from './farmingStages';

// ── Constants & helpers ─────────────────────────────────────────────────────

const DEFAULT_PILLS = ['Rice', 'Wheat', 'Potato', 'Maize'];

// Same threshold the previous design used for its "green" state.
const HIGH_FIT = 75;

type AnalysisOutcome = 'ok' | 'error' | 'skipped';

// Shared card chrome for the redesigned surface language.
const SURFACE =
  'rounded-2xl border border-stone-300/[0.08] bg-stone-900/40 backdrop-blur-sm';

// Mono micro-labels used across section headers and data footers.
const MICROLABEL = 'font-mono text-[10px] uppercase tracking-[0.18em]';
const FOOTER_LABEL = 'font-mono text-[9px] uppercase tracking-wider text-stone-500';

function clampPct(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : 0;
}

// ── Score tones ─────────────────────────────────────────────────────────────

type Tone = 'good' | 'mid' | 'bad';

function scoreTone(value: number): Tone {
  const safe = clampPct(value);
  return safe >= HIGH_FIT ? 'good' : safe >= 50 ? 'mid' : 'bad';
}

const TONE_STYLE: Record<
  Tone,
  { text: string; bar: string; dot: string; chip: string }
> = {
  good: {
    text: 'text-emerald-300',
    bar: 'bg-gradient-to-r from-emerald-500/80 to-emerald-300',
    dot: 'bg-emerald-400',
    chip: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  },
  mid: {
    text: 'text-amber-300',
    bar: 'bg-gradient-to-r from-amber-500/80 to-amber-300',
    dot: 'bg-amber-400',
    chip: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  },
  bad: {
    text: 'text-rose-300',
    bar: 'bg-gradient-to-r from-rose-500/80 to-rose-400',
    dot: 'bg-rose-400',
    chip: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  },
};

// ── Animated count-up (gauge number) ────────────────────────────────────────

function useCountUp(target: number | null, duration = 900): number | null {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    if (target == null) return;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - started) / duration);
      setDisplay(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return target == null ? null : display;
}

// ── Dimension rail (replaces the old FitBar) ────────────────────────────────

function FitRail({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const { t, number } = useTranslation();
  const safe = value == null ? null : clampPct(value);
  const tone = TONE_STYLE[safe == null ? 'mid' : scoreTone(safe)];
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400">
          {t(label)}
        </span>
        <span
          className={cn('font-mono text-[11px] font-medium tabular-nums', tone.text)}
        >
          {safe == null ? '—' : number(safe)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safe == null ? 0 : Math.max(3, safe)}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={cn('h-full rounded-full', tone.bar)}
        />
      </div>
    </div>
  );
}

// ── Radial score gauge (crop-analysis centrepiece) ──────────────────────────

function ScoreGauge({ value }: { value: number | null }) {
  const safe = value == null ? null : clampPct(value);
  const size = 216;
  const stroke = 10;
  const c = size / 2;
  const r = c - stroke / 2 - 10;
  const startDeg = 135; // ¾ arc, opening at the bottom
  const sweepDeg = 270;

  const pt = (deg: number, radius: number) => ({
    x: c + radius * Math.cos((deg * Math.PI) / 180),
    y: c + radius * Math.sin((deg * Math.PI) / 180),
  });
  const p1 = pt(startDeg, r);
  const p2 = pt(startDeg + sweepDeg, r);
  const arc = `M ${p1.x} ${p1.y} A ${r} ${r} 0 1 1 ${p2.x} ${p2.y}`;
  const arcLen = r * ((sweepDeg * Math.PI) / 180);
  const gradId = `gaugeGrad${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  const ticks = [25, 50, 75].map(pct => {
    const deg = startDeg + (sweepDeg * pct) / 100;
    return { pct, a: pt(deg, r - stroke / 2 - 4), b: pt(deg, r + stroke / 2 + 4) };
  });

  const tip = safe == null ? null : pt(startDeg + (sweepDeg * safe) / 100, r);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#d97706" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#fcd34d" />
        </linearGradient>
      </defs>
      {/* track */}
      <path
        d={arc}
        fill="none"
        stroke="rgba(231,229,228,0.08)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {/* quarter ticks */}
      {ticks.map(t => (
        <line
          key={t.pct}
          x1={t.a.x}
          y1={t.a.y}
          x2={t.b.x}
          y2={t.b.y}
          stroke="rgba(168,162,158,0.35)"
          strokeWidth={1.25}
          strokeLinecap="round"
        />
      ))}
      {/* animated progress */}
      <motion.path
        d={arc}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        style={{
          strokeDasharray: arcLen,
          filter: 'drop-shadow(0 0 7px rgba(245,158,11,0.35))',
        }}
        initial={{ strokeDashoffset: arcLen }}
        animate={{ strokeDashoffset: arcLen * (1 - (safe ?? 0) / 100) }}
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      {/* live tip */}
      {tip && (
        <circle
          cx={tip.x}
          cy={tip.y}
          r={4.5}
          fill="#fbbf24"
          stroke="#1c1917"
          strokeWidth={2}
          style={{ filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' }}
        />
      )}
    </svg>
  );
}

// ── Analysis hero card: gauge + five rails + agronomic signals ──────────────

function AnalysisHeroCard({
  crop,
  compatibility,
}: {
  crop: string;
  compatibility: FullAnalysis['cropCompatibility'][number] | null;
}) {
  const { t, number } = useTranslation();
  const overallFit = compatibility?.overallFit ?? null;
  const safe = overallFit == null ? null : clampPct(overallFit);
  const display = useCountUp(safe);
  const verdict =
    safe == null
      ? null
      : safe >= HIGH_FIT
        ? { label: t('Strong match'), tone: TONE_STYLE.good }
        : safe >= 50
          ? { label: t('Workable with adjustments'), tone: TONE_STYLE.mid }
          : { label: t('Challenging fit'), tone: TONE_STYLE.bad };

  return (
    <Card
      className={cn(
        SURFACE,
        'relative flex h-full flex-col overflow-hidden p-5 sm:p-6'
      )}
    >
      {/* ambient corner glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-amber-500/[0.08] blur-3xl" />

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25">
            <Gauge className="size-4" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {t('Overall fit')}
          </h3>
        </div>
        <Badge
          variant="outline"
          className="max-w-[50%] truncate border-amber-400/30 bg-amber-400/10 font-mono text-[10px] text-amber-200"
        >
          {t(crop)}
        </Badge>
      </div>

      {/* gauge */}
      <div className="relative mt-5 self-center">
        <ScoreGauge value={safe} />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-4xl font-light tabular-nums text-foreground sm:text-[2.75rem]">
            {display == null ? '—' : number(display)}
            {display != null && (
              <span className="text-lg text-muted-foreground">%</span>
            )}
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-stone-500">
            {t('Overall fit')}
          </span>
        </div>
      </div>

      {/* verdict pill */}
      {verdict && (
        <div className="mt-4 flex justify-center">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium',
              verdict.tone.chip
            )}
          >
            <span className={cn('size-1.5 rounded-full', verdict.tone.dot)} />
            {verdict.label}
          </span>
        </div>
      )}

      {/* key agronomic signals */}
      {compatibility?.reasons && compatibility.reasons.length > 0 && (
        <div className="relative mt-5 flex-1 border-t border-stone-300/[0.07] pt-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
            {t('Key Agronomic Signals')}
          </span>
          <ul className="mt-2 space-y-1.5">
            {compatibility.reasons.map((r, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs leading-relaxed text-foreground/75"
              >
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                <span>{t(r)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ── Section heading (numbered chip + title) ─────────────────────────────────

function SectionHeading({
  id,
  number,
  title,
  subtitle,
}: {
  id?: string;
  number: string;
  title: string;
  subtitle: string;
}) {
  const { t, number: formatNumber } = useTranslation();
  return (
    <div className="mb-5 space-y-1">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-amber-400/25 bg-amber-400/10 font-mono text-[11px] font-semibold tabular-nums text-amber-300">
          {formatNumber(Number(number)).padStart(2, '0')}
        </span>
        <h2
          id={id}
          className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
        >
          {t(title)}
        </h2>
      </div>
      <p className="pl-[38px] text-xs text-muted-foreground/80 sm:text-sm">
        {t(subtitle)}
      </p>
    </div>
  );
}

// ── Score chip for the rotation plan ────────────────────────────────────────

interface ScoreChipProps {
  icon: React.ReactNode;
  label: string;
  score: number;
  color: 'emerald' | 'cyan' | 'amber' | 'violet';
}

const CHIP_COLOR: Record<
  ScoreChipProps['color'],
  { bg: string; text: string; border: string }
> = {
  emerald: { bg: 'bg-emerald-400/10', text: 'text-emerald-200', border: 'border-emerald-400/25' },
  cyan: { bg: 'bg-cyan-400/10', text: 'text-cyan-200', border: 'border-cyan-400/25' },
  amber: { bg: 'bg-amber-400/10', text: 'text-amber-200', border: 'border-amber-400/25' },
  violet: { bg: 'bg-violet-400/10', text: 'text-violet-200', border: 'border-violet-400/25' },
};

function ScoreChip({ icon, label, score, color }: ScoreChipProps) {
  const { t, number } = useTranslation();
  const c = CHIP_COLOR[color];
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5',
        c.bg,
        c.text,
        c.border,
      )}
    >
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
        className: 'size-3.5',
      })}
      <span className="font-mono text-[10px] uppercase tracking-widest">
        {t(label)}
      </span>
      <span className="font-mono text-base font-light tabular-nums">
        {number(score)}
      </span>
    </div>
  );
}

// ── Irrigation badge colours ────────────────────────────────────────────────

const IRRIGATION_COLOR: Record<string, string> = {
  rainfed: 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100',
  limited: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
  reliable: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
};

// ── Segmented risk meter (metric card) ──────────────────────────────────────

function RiskMeter({
  score,
  colorClass,
}: {
  score: number;
  colorClass: string;
}) {
  const filled = Math.min(5, Math.ceil(clampPct(score) / 20));
  return (
    <div className="flex gap-1" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scaleY: 0.4 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
          className={cn(
            'h-1.5 flex-1 rounded-full',
            i < filled ? colorClass : 'bg-white/[0.06]'
          )}
        />
      ))}
    </div>
  );
}

// ── Rotation year card (rail node) ──────────────────────────────────────────

function YearCard({
  year,
  crop,
  coverCrop,
  irrigationLevel,
  score,
  reason,
  plantingSeason,
  harvestSeason,
  growingDays,
  isLast,
}: {
  year: number;
  crop: string;
  coverCrop: string | null;
  irrigationLevel: 'rainfed' | 'limited' | 'reliable' | null;
  score: number;
  reason: string;
  plantingSeason?: string;
  harvestSeason?: string;
  growingDays?: number;
  isLast: boolean;
}) {
  const { t, number } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: (year - 1) * 0.09 }}
      className="relative flex-1"
    >
      <Card
        className={cn(
          SURFACE,
          'h-full p-4 transition-colors hover:border-stone-300/20'
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500">
            {t('Year {year}', { year: number(year) })}
          </span>
          <span className="font-mono text-2xl font-light tabular-nums text-amber-300">
            {number(score)}
          </span>
        </div>
        <div className="mt-1.5 text-lg font-medium text-foreground">
          {t(crop)}
        </div>
        {(plantingSeason || harvestSeason) && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">
            {t('Plant')} {t(plantingSeason ?? '—')} · {t('Harvest')}{' '}
            {t(harvestSeason ?? '—')}
            {growingDays != null ? ` · ~${number(growingDays)} ${t('d')}` : ''}
          </p>
        )}
        {coverCrop && (
          <div className="mt-1.5 text-xs italic text-muted-foreground">
            {t('with {crop}', { crop: t(coverCrop) })}
          </div>
        )}
        {irrigationLevel && (
          <div className="mt-2.5">
            <Badge
              variant="outline"
              className={cn('capitalize', IRRIGATION_COLOR[irrigationLevel])}
            >
              <Droplets className="mr-1 size-3" />
              {t(irrigationLevel)}
            </Badge>
          </div>
        )}
        <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
          {t(reason)}
        </p>
      </Card>

      {/* Desktop connector: hairline + chevron centred in the 1.5rem gap */}
      {!isLast && (
        <div className="absolute -right-6 top-1/2 z-10 hidden w-6 -translate-y-1/2 items-center md:flex">
          <span className="h-px flex-1 bg-gradient-to-r from-amber-400/40 to-amber-400/10" />
          <ChevronRight className="size-4 shrink-0 text-amber-400/70" />
        </div>
      )}
      {/* Mobile connector (stacked) */}
      {!isLast && (
        <div className="my-2.5 flex items-center justify-center md:hidden">
          <ChevronRight className="size-5 rotate-90 text-amber-400/50" />
        </div>
      )}
    </motion.div>
  );
}

// ── Main Crop Workspace Component ───────────────────────────────────────────

export function CropWorkspace({ analysis }: { analysis: FullAnalysis }) {
  const { locale, t, number } = useTranslation();
  const inputs = useAppStore(s => s.inputs);
  const setInputs = useAppStore(s => s.setInputs);
  const setAnalysis = useAppStore(s => s.setAnalysis);

  // Available evaluated crops from analysis
  const evaluatedCrops = React.useMemo(() => {
    return analysis.cropCompatibility.map(c => c.crop);
  }, [analysis.cropCompatibility]);

  // Case-insensitive lookup that returns the crop name exactly as the analysis spells it.
  const findEvaluated = React.useCallback(
    (name: string) => evaluatedCrops.find(c => c.toLowerCase() === name.toLowerCase()),
    [evaluatedCrops]
  );

  // Selected focal crop to analyze and plan for
  const [selectedCropPreference, setSelectedCropPreference] = React.useState<string>(
    evaluatedCrops[0] ?? analysis.field.currentCrop ?? 'Rice'
  );
  const selectedCrop =
    findEvaluated(selectedCropPreference) ??
    evaluatedCrops[0] ??
    analysis.field.currentCrop ??
    'Rice';

  // Search input query
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const searchBoxRef = React.useRef<HTMLDivElement | null>(null);

  // Crop selection dialog state (from CropsPanel)
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [desired, setDesired] = React.useState<string[]>(evaluatedCrops);
  const [recalculating, setRecalculating] = React.useState(false);
  const [catalogFilter, setCatalogFilter] = React.useState('');
  const abortRef = React.useRef<AbortController | null>(null);

  // Active compatibility entry for the focal crop (null = no data, never a made-up score)
  const activeCompatibility = React.useMemo(() => {
    return (
      analysis.cropCompatibility.find(
        c => c.crop.toLowerCase() === selectedCrop.toLowerCase()
      ) ?? null
    );
  }, [analysis.cropCompatibility, selectedCrop]);

  const climateFit = activeCompatibility?.climateFit ?? null;
  const soilFit = activeCompatibility?.soilFit ?? null;
  const overallFit = activeCompatibility?.overallFit ?? null;

  // Quick preset pills: defaults + first evaluated crops + the active crop, de-duplicated
  const presetPills = React.useMemo(() => {
    const seen = new Set<string>();
    const pills: string[] = [];
    for (const name of [...DEFAULT_PILLS, ...evaluatedCrops.slice(0, 4), selectedCrop]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      pills.push(name);
    }
    return pills;
  }, [evaluatedCrops, selectedCrop]);

  // Filtered crops matching the search input
  const searchResults = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return FAO_CROPS.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        t(c.name).toLowerCase().includes(q) ||
        c.scientificName.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        t(c.category).toLowerCase().includes(q)
    ).slice(0, 8);
  }, [searchQuery, t]);

  // Close the autocomplete when the user clicks outside it
  React.useEffect(() => {
    if (!isSearchFocused) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isSearchFocused]);

  // Re-run analysis handler when changing crop selection
  const runAnalysisWithCrops = React.useCallback(
    async (crops: string[]): Promise<AnalysisOutcome> => {
      if (!inputs || !analysis) return 'skipped';
      if (crops.length === 0) {
        toast.error(t('You must select at least one crop to consider.'));
        return 'skipped';
      }
      const updatedInputs: FarmerInputs = { ...inputs, desiredCrops: crops };
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRecalculating(true);
      try {
        const res = await fetch('/api/field/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            latitude: inputs.latitude,
            longitude: inputs.longitude,
            locationName: analysis.field.locationName,
            country: analysis.field.country ?? undefined,
            area: inputs.area,
            areaUnit: inputs.areaUnit,
            currentCrop: inputs.currentCrop ?? null,
            desiredCrops: crops,
            irrigation: inputs.irrigation,
            soilType: inputs.soilType,
            priorities: inputs.priorities,
            locale,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          throw new Error(json.error || `Crop analysis failed with status ${res.status}.`);
        }
        if (controller.signal.aborted || abortRef.current !== controller) return 'skipped';
        setInputs(updatedInputs);
        setAnalysis(json as FullAnalysis);
        toast.success(t('Crop analysis and farming plan updated successfully.'));
        return 'ok';
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && abortRef.current === controller) {
          console.error('Crop re-analysis failed:', e);
          toast.error(t('dashboard.analysis-retry-failed'));
          return 'error';
        }
        return 'skipped';
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setRecalculating(false);
        }
      }
    },
    [inputs, analysis, setInputs, setAnalysis, locale, t]
  );

  React.useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

  const handleSelectCrop = async (cropName: string) => {
    setSearchQuery('');
    setIsSearchFocused(false);

    // Already part of the analysed mix: just switch the focal crop.
    const existing = findEvaluated(cropName);
    if (existing) {
      setSelectedCropPreference(existing);
      return;
    }

    // New crop: add it to the mix and re-run the analysis.
    const previous = selectedCrop;
    setSelectedCropPreference(cropName);
    const outcome = await runAnalysisWithCrops([...evaluatedCrops, cropName]);
    if (outcome === 'error') {
      // Roll back so the UI does not point at a crop that was never analysed.
      setSelectedCropPreference(cur => (cur === cropName ? previous : cur));
    }
  };

  // Always start the dialog from what is actually analysed right now.
  const openCropDialog = React.useCallback(() => {
    setDesired(evaluatedCrops);
    setCatalogFilter('');
    setDialogOpen(true);
  }, [evaluatedCrops]);

  const handleApplyCropMix = () => {
    setDialogOpen(false);
    const unchanged =
      desired.length === evaluatedCrops.length && desired.every(c => findEvaluated(c));
    if (unchanged) return; // nothing changed, skip a pointless network round-trip
    void runAnalysisWithCrops(desired);
  };

  const toggleDesiredCrop = (crop: string) => {
    setDesired(prev => {
      const has = prev.includes(crop);
      if (has) return prev.filter(c => c !== crop);
      return [...prev, crop];
    });
  };

  // Farming stages dynamic calculation
  const farmingStages = React.useMemo(() => {
    return getCropFarmingStages(
      selectedCrop,
      analysis.field.soilType,
      analysis.field.irrigationType ?? 'limited'
    );
  }, [selectedCrop, analysis.field.soilType, analysis.field.irrigationType]);

  // These scores are percentages; soil moisture deficit is measured in millimeters.
  const environmentalRiskScore = clampPct(
    Math.max(
      analysis.risks.heatRisk ?? 0,
      analysis.risks.floodRisk ?? 0,
      analysis.risks.droughtRisk ?? 0
    )
  );
  const environmentalRiskLevel =
    environmentalRiskScore >= 70 ? 'High' : environmentalRiskScore >= 40 ? 'Moderate' : 'Low';
  const environmentalRiskColor =
    environmentalRiskLevel === 'High'
      ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
      : environmentalRiskLevel === 'Moderate'
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
  const riskBarClass =
    environmentalRiskLevel === 'High'
      ? 'bg-gradient-to-r from-rose-500/80 to-rose-400'
      : environmentalRiskLevel === 'Moderate'
        ? 'bg-gradient-to-r from-amber-500/80 to-amber-300'
        : 'bg-gradient-to-r from-emerald-500/80 to-emerald-300';

  const rotationPlan = analysis.rotationPlan;
  const country = analysis.field.country?.trim();
  const locationIncludesCountry = country
    ? analysis.field.locationName
        .split(',')
        .some(part => part.trim().toLowerCase() === country.toLowerCase())
    : false;
  const displayLocationName =
    country && !locationIncludesCountry
      ? `${analysis.field.locationName}, ${country}`
      : analysis.field.locationName;

  // Hemisphere-aware coordinates (negative latitude = S, negative longitude = W)
  const latLabel = `${number(Math.abs(analysis.field.latitude), { maximumFractionDigits: 2 })}°${
    analysis.field.latitude >= 0 ? 'N' : 'S'
  }`;
  const lonLabel = `${number(Math.abs(analysis.field.longitude), { maximumFractionDigits: 2 })}°${
    analysis.field.longitude >= 0 ? 'E' : 'W'
  }`;

  // Never claim a soil type the analysis does not have.
  const soilLabel = analysis.field.soilType ? t(analysis.field.soilType) : '—';

  // Catalog pool for dialog (memoised so the sorted list is not rebuilt on every render)
  const extraRecs = React.useMemo(() => {
    const currentSet = new Set(desired);
    return (analysis.recommendations ?? [])
      .map(r => r.crop)
      .filter(c => !currentSet.has(c))
      .slice(0, 6);
  }, [analysis.recommendations, desired]);

  const allCropNames = React.useMemo(() => {
    return Array.from(
      new Set([...desired, ...extraRecs, ...FAO_CROPS.map(c => c.name)])
    ).sort((a, b) => t(a).localeCompare(t(b), locale));
  }, [desired, extraRecs, locale, t]);

  const normalizedCatalogFilter = catalogFilter.trim().toLowerCase();
  const filteredCatalog = normalizedCatalogFilter
    ? allCropNames.filter(
        c =>
          c.toLowerCase().includes(normalizedCatalogFilter) ||
          t(c).toLowerCase().includes(normalizedCatalogFilter)
      )
    : allCropNames.slice(0, 36);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-10 pb-12">
      {/* ══ HERO — workspace header + crop selection (was Section 1) ══ */}
      <section
        aria-label={t('Select your crop')}
        className="relative overflow-hidden rounded-3xl border border-stone-300/[0.08] bg-stone-900/30 p-5 sm:p-7"
      >
        {/* ambient amber glows */}
        <div className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-amber-500/[0.09] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-72 rounded-full bg-amber-600/[0.05] blur-3xl" />

        <div className="relative">
          {/* title row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/25">
                  <Wheat className="size-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {t('Crop Workspace')}
                </h1>
                <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                  {t('One page')}
                </span>
              </div>
              <p className="mt-2 max-w-xl text-xs text-muted-foreground sm:text-sm">
                {t('All-in-one crop analysis, local soil suitability, and tailored 5-stage farming planner.')}
              </p>
            </div>

            {/* Live status badge / trigger */}
            <div className="flex items-center gap-2">
              {recalculating ? (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-200">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>{t('Recalculating with NASA data...')}</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={openCropDialog}
                  className="rounded-xl border-stone-300/15 bg-stone-900/60 text-xs hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
                >
                  <Layers className="mr-1.5 size-3.5 text-amber-300" />
                  {t('Manage Crop Mix ({count})', { count: number(evaluatedCrops.length) })}
                </Button>
              )}
            </div>
          </div>

          {/* crop search + autocomplete (outside-click closes the dropdown) */}
          <div className="mt-6">
            <span className={cn(MICROLABEL, 'text-stone-500')}>
              {t('Select your crop')}
            </span>
            <div ref={searchBoxRef} className="relative mt-2">
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-4 size-4 text-stone-500" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={e => {
                    setSearchQuery(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') setIsSearchFocused(false);
                  }}
                  placeholder={t('Search crops...')}
                  aria-label={t('Search crops')}
                  className="h-12 rounded-xl border-stone-300/10 bg-stone-950/50 pl-11 pr-10 text-sm shadow-inner shadow-black/20 backdrop-blur-md transition-all placeholder:text-stone-500 focus-visible:border-amber-400/50 focus-visible:ring-2 focus-visible:ring-amber-400/20"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label={t('Clear search query')}
                    className="absolute right-3 rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isSearchFocused && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-stone-300/10 bg-stone-900/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl"
                  >
                    <div className={cn(MICROLABEL, 'px-2 py-1 text-stone-500')}>
                      {t('FAO EcoCrop Matches')}
                    </div>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                      {searchResults.map(crop => {
                        const isEvaluated = Boolean(findEvaluated(crop.name));
                        return (
                          <button
                            key={crop.id}
                            type="button"
                            onClick={() => void handleSelectCrop(crop.name)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-amber-400/10"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Sprout className="size-3.5 shrink-0 text-amber-300" />
                              <span className="truncate font-medium text-foreground">
                                {t(crop.name)}
                              </span>
                              <span className="hidden truncate text-[11px] italic text-muted-foreground sm:inline">
                                ({crop.scientificName})
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge
                                variant="outline"
                                className="border-stone-300/15 text-[10px] capitalize"
                              >
                                {t(crop.category)}
                              </Badge>
                              {isEvaluated ? (
                                <span className="font-mono text-[10px] text-emerald-300">
                                  {t('In Mix')}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 font-mono text-[10px] text-amber-300">
                                  <Plus className="size-3" />
                                  {t('Add & Analyze')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Quick selection pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {presetPills.map(crop => {
                const isSelected = selectedCrop.toLowerCase() === crop.toLowerCase();
                return (
                  <button
                    key={crop}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => void handleSelectCrop(crop)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                      isSelected
                        ? 'border border-amber-400/50 bg-amber-400/15 text-amber-100 shadow-[0_0_16px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30'
                        : 'border border-stone-300/10 bg-stone-900/50 text-muted-foreground hover:border-stone-300/25 hover:bg-stone-800/50 hover:text-foreground'
                    )}
                  >
                    <span
                      className={cn(
                        'size-1.5 rounded-full transition-colors',
                        isSelected ? 'bg-amber-300' : 'bg-stone-600'
                      )}
                    />
                    {t(crop)}
                  </button>
                );
              })}

              {/* Quick button to open full catalog */}
              <button
                type="button"
                onClick={openCropDialog}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300/20 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-amber-400/40 hover:text-amber-200"
              >
                <Plus className="size-3" />
                <span>{t('More crops...')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FIELD CONTEXT — farm information (was Section 2) ══ */}
      <section aria-label={t('Farm information')} className="space-y-3">
        <div className="flex items-center gap-3">
          <span className={cn(MICROLABEL, 'text-stone-400')}>
            {t('Farm information')}
          </span>
          <span className="h-px flex-1 bg-gradient-to-r from-stone-300/15 to-transparent" />
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Tile 1: Location */}
          <Card
            className={cn(
              SURFACE,
              'flex flex-col p-4 transition-colors hover:border-stone-300/20'
            )}
          >
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                <MapPin className="size-3.5" />
              </div>
              <h3 className="text-xs font-semibold text-foreground">
                {t('Location')}
              </h3>
            </div>
            <div className="mt-3 flex-1 space-y-1">
              <p
                className="truncate text-sm font-medium text-foreground"
                title={displayLocationName}
              >
                {displayLocationName}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {t('Village / District')}
                {analysis.field.area != null && analysis.field.areaUnit
                  ? ` · ${number(analysis.field.area)} ${t(analysis.field.areaUnit)}`
                  : ''}
              </p>
              <p className="font-mono text-[10px] tabular-nums tracking-wide text-stone-500">
                {latLabel}, {lonLabel}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-stone-300/[0.07] pt-2.5">
              <span className="size-1 shrink-0 rounded-full bg-emerald-400" />
              <span className={FOOTER_LABEL}>
                {t('NASA Earth Observation coordinates verified')}
              </span>
            </div>
          </Card>

          {/* Tile 2: Soil type */}
          <Card
            className={cn(
              SURFACE,
              'flex flex-col p-4 transition-colors hover:border-stone-300/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                  <Layers className="size-3.5" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">
                  {t('Soil type')}
                </h3>
              </div>
              <Badge
                variant="outline"
                className="max-w-[45%] truncate border-amber-400/30 bg-amber-400/10 font-mono text-[9px] capitalize text-amber-200"
              >
                {soilLabel}
              </Badge>
            </div>
            <div className="mt-3 flex-1">
              <p className="text-sm font-medium capitalize text-foreground">
                {soilLabel}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('Soil information')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-stone-300/[0.07] pt-2.5">
              <span className="size-1 shrink-0 rounded-full bg-amber-400" />
              <span className={FOOTER_LABEL}>
                {t('Soil depth & drainage compatibility evaluated')}
              </span>
            </div>
          </Card>

          {/* Tile 3: Planting date */}
          <Card
            className={cn(
              SURFACE,
              'flex flex-col p-4 transition-colors hover:border-stone-300/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                  <Calendar className="size-3.5" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">
                  {t('Planting date')}
                </h3>
              </div>
              {activeCompatibility?.isPlantableNow ? (
                <Badge
                  variant="outline"
                  className="border-emerald-400/40 bg-emerald-400/10 font-mono text-[9px] text-emerald-200"
                >
                  {t('Plantable now')}
                </Badge>
              ) : activeCompatibility?.monthsUntilPlant ? (
                <Badge
                  variant="outline"
                  className="border-amber-400/30 bg-amber-400/10 font-mono text-[9px] text-amber-200"
                >
                  {t('Next in {months} mo', {
                    months: number(activeCompatibility.monthsUntilPlant),
                  })}
                </Badge>
              ) : null}
            </div>
            <div className="mt-3 flex-1">
              <p className="text-xs font-medium leading-relaxed text-foreground/90">
                {t('Plant')} {t(activeCompatibility?.plantingSeason ?? 'Season-dependent')} ·{' '}
                {t('Harvest')} {t(activeCompatibility?.harvestSeason ?? 'Season-dependent')}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('Growing season')} ·{' '}
                {t('Window for {crop}', { crop: t(selectedCrop) })}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-stone-300/[0.07] pt-2.5">
              <Clock className="size-3 shrink-0 text-cyan-400" />
              <span className={FOOTER_LABEL}>
                {t('Phenological window aligned with seasonal rainfall')}
              </span>
            </div>
          </Card>

          {/* Tile 4: Irrigation */}
          <Card
            className={cn(
              SURFACE,
              'flex flex-col p-4 transition-colors hover:border-stone-300/20'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-400/10 text-blue-300 ring-1 ring-inset ring-blue-400/20">
                  <Droplets className="size-3.5" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">
                  {t('Irrigation')}
                </h3>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 font-mono text-[9px] capitalize',
                  IRRIGATION_COLOR[analysis.field.irrigationType ?? 'limited']
                )}
              >
                {t(analysis.field.irrigationType ?? 'limited')}
              </Badge>
            </div>
            <div className="mt-3 flex-1">
              <p className="text-xs font-medium leading-relaxed capitalize text-foreground/90">
                {t('{irrigation} water infrastructure', {
                  irrigation: t(analysis.field.irrigationType ?? 'limited'),
                })}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t('Water availability')} ·{' '}
                {t('Soil moisture deficit: {score} mm', {
                  score: number(analysis.risks.soilMoistureDeficit),
                })}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-stone-300/[0.07] pt-2.5">
              <span className="size-1 shrink-0 rounded-full bg-blue-400" />
              <span className={FOOTER_LABEL}>
                {t('GPM precipitation & SMAP soil moisture cross-checked')}
              </span>
            </div>
          </Card>
        </div>
      </section>

      {/* ══ SECTION 1: Crop analysis (centrepiece) ══ */}
      <section aria-labelledby="section-crop-analysis">
        <SectionHeading
          id="section-crop-analysis"
          number="1"
          title="Crop analysis"
          subtitle="Five agronomic dimensions, scored for your field and focal crop."
        />

        {/* Bento: gauge hero + four metric cards */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <AnalysisHeroCard
              crop={selectedCrop}
              compatibility={activeCompatibility}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-3">
            {/* Metric: Climate suitability */}
            <Card
              className={cn(
                SURFACE,
                'p-4 transition-all hover:border-amber-400/20 sm:p-5'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20">
                    <Sun className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('Climate suitability')}
                  </h3>
                </div>
                <span className="font-mono text-2xl font-light tabular-nums text-amber-300">
                  {climateFit == null ? '—' : `${number(climateFit)}%`}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${clampPct(climateFit)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-amber-500/80 to-amber-300"
                />
              </div>
              {climateFit != null && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {climateFit >= HIGH_FIT
                    ? t('Temperature, solar radiation, and GPM precipitation match the optimal physiological growth envelope.')
                    : t('Climate fit is below the ideal range for this crop. See the detailed scores for the reasons.')}
                </p>
              )}
            </Card>

            {/* Metric: Soil suitability */}
            <Card
              className={cn(
                SURFACE,
                'p-4 transition-all hover:border-emerald-400/20 sm:p-5'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                    <Sprout className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('Soil suitability')}
                  </h3>
                </div>
                <span className="font-mono text-2xl font-light tabular-nums text-emerald-300">
                  {soilFit == null ? '—' : `${number(soilFit)}%`}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${clampPct(soilFit)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500/80 to-emerald-300"
                />
              </div>
              {soilFit != null && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {soilFit >= HIGH_FIT
                    ? t('Soil texture and pH envelope provide strong root aeration and nutrient exchange capacity for {crop}.', { crop: t(selectedCrop) })
                    : t('Soil fit is below the ideal range for {crop}. See the detailed scores for the reasons.', { crop: t(selectedCrop) })}
                </p>
              )}
            </Card>

            {/* Metric: Environmental stress risk */}
            <Card
              className={cn(
                SURFACE,
                'p-4 transition-all hover:border-rose-400/20 sm:p-5'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-rose-400/10 text-rose-300 ring-1 ring-inset ring-rose-400/20">
                    <ShieldAlert className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('Environmental stress risk')}
                  </h3>
                </div>
                <Badge
                  variant="outline"
                  className={cn('font-mono text-[11px]', environmentalRiskColor)}
                >
                  {t(environmentalRiskLevel)} {t('Risk')}
                </Badge>
              </div>
              <div className="mt-4">
                <RiskMeter score={environmentalRiskScore} colorClass={riskBarClass} />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                {t(analysis.risks.summary || 'Monitor the field regularly for early signs of crop stress.')}
              </p>
            </Card>

            {/* Metric: Yield estimation */}
            <Card
              className={cn(
                SURFACE,
                'p-4 transition-all hover:border-cyan-400/20 sm:p-5'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20">
                    <TrendingUp className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('Yield estimation')}
                  </h3>
                </div>
                <span className="font-mono text-2xl font-light tabular-nums text-cyan-300">
                  {overallFit == null ? '—' : `${number(overallFit)} / 100`}
                </span>
              </div>
              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${clampPct(overallFit)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500/80 to-cyan-300"
                />
              </div>
              {overallFit != null && (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {overallFit >= HIGH_FIT
                    ? t('High yield potential under optimal nutrient & pest management protocol.')
                    : t('Moderate yield expectation; consider rotation or supplemental irrigation.')}
                </p>
              )}
            </Card>

            {/* Dimensional breakdown — full width of the right column */}
            <Card className={cn(SURFACE, 'p-4 sm:col-span-2 sm:p-5')}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn(MICROLABEL, 'text-stone-400')}>
                  {t('Dimensional breakdown')}
                </span>
                <Badge
                  variant="outline"
                  className="max-w-[40%] truncate border-stone-300/15 font-mono text-[9px] text-stone-400"
                >
                  {t(selectedCrop)}
                </Badge>
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
                <FitRail label="Season" value={activeCompatibility?.seasonFit ?? null} />
                <FitRail label="Climate" value={activeCompatibility?.climateFit ?? null} />
                <FitRail label="Water" value={activeCompatibility?.waterFit ?? null} />
                <FitRail label="Soil" value={activeCompatibility?.soilFit ?? null} />
                <FitRail label="Rotation" value={activeCompatibility?.rotationFit ?? null} />
              </div>
            </Card>
          </div>
        </div>

        {/* Detailed compatibility & score reasons */}
        <div className="mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem
              value="detailed-crops"
              className="rounded-2xl border border-stone-300/[0.08] bg-stone-900/30 px-4 sm:px-5"
            >
              <AccordionTrigger className="gap-2 py-4 text-xs font-mono uppercase tracking-[0.14em] text-amber-200/90 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="size-3.5 text-amber-400" />
                  <span>
                    {t('View detailed dimensional scores & "Why this score" rationale')}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-4">
                <div className="space-y-3">
                  {analysis.cropCompatibility.map((c, i) => (
                    <div
                      key={c.crop}
                      className={cn(
                        'rounded-xl border p-3.5 transition-colors sm:p-4',
                        c.crop.toLowerCase() === selectedCrop.toLowerCase()
                          ? 'border-amber-400/30 bg-amber-400/[0.05]'
                          : 'border-stone-300/[0.07] bg-white/[0.02] hover:border-stone-300/15'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCropPreference(c.crop)}
                            className="text-sm font-medium text-foreground underline-offset-2 transition-colors hover:text-amber-200 hover:underline"
                          >
                            {t(c.crop)}
                          </button>
                          {i === 0 && (
                            <Badge
                              variant="outline"
                              className="border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-200"
                            >
                              {t('Top fit')}
                            </Badge>
                          )}
                          {c.crop.toLowerCase() === selectedCrop.toLowerCase() && (
                            <Badge
                              variant="outline"
                              className="border-cyan-400/40 bg-cyan-400/10 text-[10px] text-cyan-200"
                            >
                              {t('Currently viewing')}
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono text-lg font-light tabular-nums text-amber-300">
                          {number(c.overallFit)}
                        </span>
                      </div>

                      <div className="mt-3.5 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-5">
                        <FitRail label="Season" value={c.seasonFit} />
                        <FitRail label="Climate" value={c.climateFit} />
                        <FitRail label="Water" value={c.waterFit} />
                        <FitRail label="Soil" value={c.soilFit} />
                        <FitRail label="Rotation" value={c.rotationFit} />
                      </div>

                      {c.reasons && c.reasons.length > 0 && (
                        <div className="mt-3.5 space-y-1.5 border-t border-stone-300/[0.07] pt-2.5">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                            {t('Key Agronomic Signals')}
                          </span>
                          <ul className="space-y-1">
                            {c.reasons.map((r, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-1.5 text-xs text-foreground/80"
                              >
                                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400" />
                                <span>{t(r)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Top recommended candidates */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="mt-2 border-t border-stone-300/[0.08] pt-4">
                    <div
                      className={cn(
                        MICROLABEL,
                        'mb-2.5 flex items-center gap-1.5 text-amber-200/80'
                      )}
                    >
                      <Sparkles className="size-3" />
                      <span>{t('What could grow well here? (NASA Candidates)')}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {analysis.recommendations.slice(0, 4).map(r => (
                        <div
                          key={r.crop}
                          className="flex items-start gap-3 rounded-xl border border-stone-300/[0.07] bg-white/[0.02] p-3 text-xs transition-colors hover:border-amber-400/20"
                        >
                          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 font-mono text-[11px] font-semibold tabular-nums text-amber-300 ring-1 ring-inset ring-amber-400/20">
                            {number(r.rank)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-medium text-foreground">
                                {t(r.crop)}
                              </span>
                              <span className="font-mono tabular-nums text-amber-300/90">
                                {number(r.score)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                              {t(r.why)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* ══ SECTION 2: Farming planner ══ */}
      <section aria-labelledby="section-farming-planner">
        <SectionHeading
          id="section-farming-planner"
          number="2"
          title="Farming planner"
          subtitle="A personalized, stage-by-stage schedule built from your crop, soil, and water data."
        />

        {/* Selected crop banner */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-amber-400/20 bg-gradient-to-r from-amber-400/[0.07] to-transparent px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sprout className="size-4 shrink-0 text-amber-300" />
            <span className="text-xs text-muted-foreground">
              {t('Farming guidance tailored for:')}
            </span>
            <span className="text-sm font-semibold text-amber-200">
              {t(selectedCrop)}
            </span>
            <Badge
              variant="outline"
              className="border-stone-300/15 text-[10px] capitalize"
            >
              {soilLabel} · {t(analysis.field.irrigationType ?? 'limited')}
            </Badge>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-stone-400">
            {number(farmingStages.length)} {t('actionable stages')}
          </span>
        </div>

        {/* 5-step timeline */}
        <div className="relative mt-5 space-y-4">
          {/* the rail */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-5 left-[13px] top-5 w-px bg-gradient-to-b from-amber-400/50 via-amber-400/15 to-transparent"
          />
          {farmingStages.map((stage, idx) => (
            <motion.div
              key={stage.step}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.06 }}
              className="flex items-start gap-4 sm:gap-5"
            >
              {/* timeline node */}
              <div className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-stone-950 font-mono text-[11px] font-semibold tabular-nums text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.18)]">
                {number(stage.step)}
              </div>

              <Card
                className={cn(
                  SURFACE,
                  'min-w-0 flex-1 p-4 transition-all hover:border-amber-400/20 sm:p-5'
                )}
              >
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground sm:text-base">
                      {t(stage.title)}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t(stage.subtitle)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-stone-300/15 font-mono text-[10px] tabular-nums text-stone-300"
                    >
                      <Clock className="mr-1 size-3" />
                      {t(stage.duration)}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-amber-400/30 bg-amber-400/10 font-mono text-[10px] text-amber-200"
                    >
                      {t('Focus')}: {t(stage.criticalFocus)}
                    </Badge>
                  </div>
                </div>

                {/* Stage tasks checklist */}
                <div className="mt-4 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                  {stage.tasks.map((task, tIdx) => (
                    <div
                      key={tIdx}
                      className="flex items-start gap-2 text-xs text-foreground/85"
                    >
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400/90" />
                      <span>{t(task)}</span>
                    </div>
                  ))}
                </div>

                {/* Agronomic pro tips */}
                {stage.tips && stage.tips.length > 0 && (
                  <div className="mt-3.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                      <Sparkle className="size-3" />
                      <span>{t('Agronomic Pro Tip')}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {stage.tips.map((tip, pIdx) => (
                        <li
                          key={pIdx}
                          className="text-[11px] italic leading-relaxed text-muted-foreground"
                        >
                          • {t(tip)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </motion.div>
          ))}
      </div>
     
      </section>

      {/* ══ DIALOG: manage & recalculate crop mix ══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-stone-300/10 bg-background/95 backdrop-blur-xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sprout className="size-5 text-amber-300" />
              {t('dashboard.edit-crops-you-re-considering')}
            </DialogTitle>
            <DialogDescription>
              {t('Select crops from the FAO EcoCrop database or search to add them to your evaluation.')}
            </DialogDescription>
          </DialogHeader>

          <Separator className="bg-stone-300/10" />

          <div className="space-y-4">
            {/* Search bar inside dialog */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-stone-500" />
              <Input
                value={catalogFilter}
                onChange={e => setCatalogFilter(e.target.value)}
                placeholder={t('Search 60+ crops (e.g. Barley, Chickpea, Banana, Cotton)...')}
                aria-label={t('Search crops')}
                className="h-9 rounded-xl border-stone-300/10 bg-stone-950/50 pl-9 text-xs focus-visible:border-amber-400/50 focus-visible:ring-1 focus-visible:ring-amber-400/20"
              />
            </div>

            {/* Currently selected */}
            <div>
              <span className={cn(MICROLABEL, 'text-stone-500')}>
                {t('dashboard.selected-count', { count: number(desired.length) })}
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {desired.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleDesiredCrop(c)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-400/25"
                  >
                    <Check className="size-3" />
                    {t(c)}
                    <X className="size-3 opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
                {desired.length === 0 && (
                  <span className="text-xs italic text-rose-300">
                    {t('No crops selected — pick at least one below.')}
                  </span>
                )}
              </div>
            </div>

            {/* Top recommended */}
            {extraRecs.length > 0 && !catalogFilter && (
              <div>
                <span className={cn(MICROLABEL, 'text-stone-500')}>
                  {t('Recommended for your field')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extraRecs.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleDesiredCrop(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-300/10 bg-white/[0.03] px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100"
                    >
                      <Plus className="size-3" />
                      {t(c)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full FAO catalog pool */}
            <div>
              <div className="flex items-center justify-between">
                <span className={cn(MICROLABEL, 'text-stone-500')}>
                  {catalogFilter
                    ? t('Search Results ({count})', { count: number(filteredCatalog.length) })
                    : t('FAO EcoCrop Catalog')}
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {number(allCropNames.length)} {t('crops total')}
                </span>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-stone-300/[0.07] bg-white/[0.02] p-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {filteredCatalog.map(c => (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={desired.includes(c)}
                      onClick={() => toggleDesiredCrop(c)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        desired.includes(c)
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'border-stone-300/10 bg-white/[0.03] text-muted-foreground hover:border-stone-300/25 hover:text-foreground'
                      )}
                    >
                      {t(c)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 flex !flex-col items-stretch gap-2 sm:!flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AnimatePresence mode="wait">
                {recalculating && (
                  <motion.span
                    key="recalc"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="inline-flex items-center gap-1.5 text-amber-200"
                  >
                    <Loader2 className="size-3.5 animate-spin" />
                    {t('Recalculating...')}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleApplyCropMix}
                disabled={desired.length === 0}
                className="rounded-xl bg-amber-400 text-xs font-medium text-black shadow-[0_0_18px_rgba(251,191,36,0.25)] hover:bg-amber-300"
              >
                {t('Apply & Recalculate')}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
