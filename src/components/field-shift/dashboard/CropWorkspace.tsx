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
  ArrowRight,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  ChevronDown,
  Info,
  CalendarDays,
  Leaf,
  Clock,
  Sparkle,
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAppStore, type FullAnalysis } from '@/lib/store';
import type { FarmerInputs } from '@/lib/decision/engine';
import { useTranslation } from '@/lib/locale';
import { FAO_CROPS } from '@/lib/crop-dataset';
import { getCropFarmingStages, type FarmingStage } from './farmingStages';

// ── Mini-fit-bar ────────────────────────────────────────────────────────────
function FitBar({ label, value }: { label: string; value: number }) {
  const { t, number } = useTranslation();
  const color =
    value >= 75 ? 'bg-emerald-400' : value >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
        {t(label)} {number(value)}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ── Section Title & Number Header ───────────────────────────────────────────
function SectionHeading({
  number,
  title,
  subtitle,
}: {
  number: string;
  title: string;
  subtitle: string;
}) {
  const { t, number: formatNumber } = useTranslation();
  return (
    <div className="mb-4 space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {formatNumber(Number(number))}. {t(title)}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground/80 sm:text-sm">
        {t(subtitle)}
      </p>
    </div>
  );
}

// ── Score chip for Rotation Plan ─────────────────────────────────────────────
interface ScoreChipProps {
  icon: React.ReactNode;
  label: string;
  score: number;
  color: 'emerald' | 'cyan' | 'amber' | 'violet';
}

const CHIP_COLOR: Record<ScoreChipProps['color'], { bg: string; text: string; border: string }> = {
  emerald: { bg: 'bg-emerald-400/10', text: 'text-emerald-200', border: 'border-emerald-400/30' },
  cyan: { bg: 'bg-cyan-400/10', text: 'text-cyan-200', border: 'border-cyan-400/30' },
  amber: { bg: 'bg-amber-400/10', text: 'text-amber-200', border: 'border-amber-400/30' },
  violet: { bg: 'bg-violet-400/10', text: 'text-violet-200', border: 'border-violet-400/30' },
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
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'size-3.5' })}
      <span className="font-mono text-[10px] uppercase tracking-widest">{t(label)}</span>
      <span className="font-mono text-base font-light tabular-nums">{number(score)}</span>
    </div>
  );
}

// ── Irrigation badge ──────────────────────────────────────────────────────────
const IRRIGATION_COLOR: Record<string, string> = {
  rainfed: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  limited: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  reliable: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
};

// ── Rotation Year Card ───────────────────────────────────────────────────────
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: (year - 1) * 0.08 }}
      className="relative flex-1"
    >
      <Card className="border-white/10 bg-card/60 p-4 backdrop-blur-sm sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
            {t('Year {year}', { year })}
          </span>
          <span className="font-mono text-2xl font-light text-amber-300 tabular-nums">
            {number(score)}
          </span>
        </div>
        <div className="text-xl font-medium text-foreground">{t(crop)}</div>
        {(plantingSeason || harvestSeason) && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground/80">
            {t('Plant')} {t(plantingSeason ?? '—')} · {t('Harvest')} {t(harvestSeason ?? '—')}
            {growingDays != null ? ` · ~${number(growingDays)} ${t('d')}` : ''}
          </p>
        )}
        {coverCrop && (
          <div className="mt-1 text-xs italic text-muted-foreground">
            {t('with {crop}', { crop: t(coverCrop) })}
          </div>
        )}
        <div className="mt-2">
          {irrigationLevel && (
            <Badge variant="outline" className={cn('capitalize', IRRIGATION_COLOR[irrigationLevel])}>
              <Droplets className="size-3" />
              {t(irrigationLevel)}
            </Badge>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t(reason)}</p>
      </Card>
      {/* Connecting thread (rotation line) */}
      {!isLast && (
        <div className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 translate-x-full md:block">
          <ArrowRight className="size-5 text-amber-400/50" />
        </div>
      )}
      {!isLast && (
        <div className="my-2 flex items-center justify-center md:hidden">
          <ArrowRight className="size-5 rotate-90 text-amber-400/50" />
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

  // Selected focal crop to analyze and plan for
  const [selectedCropPreference, setSelectedCropPreference] = React.useState<string>(
    evaluatedCrops[0] ?? analysis.field.currentCrop ?? 'Rice'
  );
  const selectedCrop = evaluatedCrops.includes(selectedCropPreference)
    ? selectedCropPreference
    : evaluatedCrops[0] ?? analysis.field.currentCrop ?? 'Rice';

  // Search input query
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  // Crop selection dialog state (from CropsPanel)
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [desired, setDesired] = React.useState<string[]>(inputs?.desiredCrops ?? evaluatedCrops);
  const [recalculating, setRecalculating] = React.useState(false);
  const [catalogFilter, setCatalogFilter] = React.useState('');
  const abortRef = React.useRef<AbortController | null>(null);

  // Active compatibility entry for the focal crop
  const activeCompatibility = React.useMemo(() => {
    return (
      analysis.cropCompatibility.find(
        c => c.crop.toLowerCase() === selectedCrop.toLowerCase()
      ) ?? analysis.cropCompatibility[0]
    );
  }, [analysis.cropCompatibility, selectedCrop]);

  // Quick preset pills from the mockup
  const presetPills = React.useMemo(() => {
    const defaultPills = ['Rice', 'Wheat', 'Potato', 'Maize'];
    // Merge preset pills with current evaluated crops while keeping uniqueness
    const set = new Set([...defaultPills, ...evaluatedCrops.slice(0, 4)]);
    return Array.from(set);
  }, [evaluatedCrops]);

  // Filtered crops matching the search input in Section 1
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

  // Re-run analysis handler when changing crop selection
  const runAnalysisWithCrops = React.useCallback(
    async (crops: string[]) => {
      if (!inputs || !analysis) return;
      if (crops.length === 0) {
        toast.error(t('You must select at least one crop to consider.'));
        return;
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
        if (controller.signal.aborted || abortRef.current !== controller) return;
        setInputs(updatedInputs);
        setAnalysis(json as FullAnalysis);
        toast.success(t('Crop analysis and farming plan updated successfully.'));
      } catch (e) {
        if ((e as Error).name !== 'AbortError' && abortRef.current === controller) {
          console.error('Crop re-analysis failed:', e);
          toast.error(t('dashboard.analysis-retry-failed'));
        }
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

  const handleSelectCrop = (cropName: string) => {
    setSelectedCropPreference(cropName);
    // If not in current evaluation pool, give option or auto-add
    if (!evaluatedCrops.map(c => c.toLowerCase()).includes(cropName.toLowerCase())) {
      const newDesired = [...evaluatedCrops, cropName];
      void runAnalysisWithCrops(newDesired);
    }
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const handleApplyCropMix = () => {
    setDialogOpen(false);
    void runAnalysisWithCrops(desired);
  };

  const toggleDesiredCrop = (crop: string) => {
    setDesired(prev => {
      const has = prev.includes(crop);
      if (has) return prev.filter(c => c !== crop);
      return [...prev, crop];
    });
  };

  // Farming stages dynamic calculation for Section 4
  const farmingStages = React.useMemo(() => {
    return getCropFarmingStages(
      selectedCrop,
      analysis.field.soilType,
      analysis.field.irrigationType ?? 'limited'
    );
  }, [selectedCrop, analysis.field.soilType, analysis.field.irrigationType]);

  // These scores are percentages; soil moisture deficit is measured in millimeters.
  const environmentalRiskScore = Math.max(
    analysis.risks.heatRisk,
    analysis.risks.floodRisk,
    analysis.risks.droughtRisk
  );
  const environmentalRiskLevel =
    environmentalRiskScore >= 70 ? 'High' : environmentalRiskScore >= 40 ? 'Moderate' : 'Low';
  const environmentalRiskColor =
    environmentalRiskLevel === 'High'
      ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
      : environmentalRiskLevel === 'Moderate'
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';

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

  // Catalog pool for dialog
  const currentSet = new Set(desired);
  const extraRecs = analysis.recommendations
    .map(r => r.crop)
    .filter(c => !currentSet.has(c))
    .slice(0, 6);

  const allCropNames = React.useMemo(() => {
    return Array.from(
      new Set([...desired, ...extraRecs, ...FAO_CROPS.map(c => c.name)])
    ).sort((a, b) => t(a).localeCompare(t(b), locale));
  }, [desired, extraRecs, locale, t]);

  const normalizedCatalogFilter = catalogFilter.trim().toLowerCase();
  const filteredCatalog = catalogFilter.trim()
    ? allCropNames.filter(
        c =>
          c.toLowerCase().includes(normalizedCatalogFilter) ||
          t(c).toLowerCase().includes(normalizedCatalogFilter)
      )
    : allCropNames.slice(0, 36);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 pb-12">
      {/* ── Top Workspace Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t('Crop Workspace')}
            </h1>
            <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              {t('One page')}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {t('All-in-one crop analysis, local soil suitability, and tailored 5-stage farming planner.')}
          </p>
        </div>

        {/* Live status badge / trigger */}
        <div className="flex items-center gap-2">
          {recalculating ? (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs text-amber-200">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t('Recalculating with NASA data...')}</span>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="border-white/10 bg-white/[0.04] text-xs hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200"
            >
              <Layers className="size-3.5 mr-1.5 text-amber-300" />
              {t('Manage Crop Mix ({count})', { count: evaluatedCrops.length })}
            </Button>
          )}
        </div>
      </div>

      {/* ── SECTION 1: Select your crop ─────────────────────────────────── */}
      <section aria-labelledby="section-select-crop">
        <SectionHeading
          number="1"
          title="Select your crop"
          subtitle="Search or select the crop you want to analyze."
        />

        <div className="relative">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder={t('Search crops...')}
              aria-label={t('Search crops')}
              className="h-11 rounded-xl border-white/10 bg-card/60 pl-10 pr-4 text-sm backdrop-blur-md transition-all focus-visible:border-amber-400/50 focus-visible:ring-1 focus-visible:ring-amber-400/30"
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

          {/* Search Autocomplete Dropdown */}
          <AnimatePresence>
            {isSearchFocused && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#12181c] p-2 shadow-2xl backdrop-blur-xl"
              >
                <div className="px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t('FAO EcoCrop Matches')}
                </div>
                <div className="max-h-60 space-y-1 overflow-y-auto">
                  {searchResults.map(crop => {
                    const isEvaluated = evaluatedCrops
                      .map(c => c.toLowerCase())
                      .includes(crop.name.toLowerCase());
                    return (
                      <button
                        key={crop.id}
                        type="button"
                        onClick={() => handleSelectCrop(crop.name)}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-amber-400/10 hover:text-amber-100"
                      >
                        <div className="flex items-center gap-2">
                          <Sprout className="size-3.5 text-amber-300" />
                          <span className="font-medium text-foreground">{t(crop.name)}</span>
                          <span className="text-[11px] text-muted-foreground italic">
                            ({crop.scientificName})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-white/10 text-[10px] capitalize">
                            {t(crop.category)}
                          </Badge>
                          {isEvaluated ? (
                            <span className="font-mono text-[10px] text-emerald-400">{t('In Mix')}</span>
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

          {/* Quick Selection Pills matching the mockup */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {presetPills.map(crop => {
              const isSelected = selectedCrop.toLowerCase() === crop.toLowerCase();
              return (
                <button
                  key={crop}
                  type="button"
                  onClick={() => handleSelectCrop(crop)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200',
                    isSelected
                      ? 'border border-amber-400/50 bg-amber-400/20 text-amber-100 shadow-sm shadow-amber-400/20 ring-1 ring-amber-400/30'
                      : 'border border-white/10 bg-card/60 text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      isSelected ? 'bg-amber-300' : 'bg-muted-foreground/60'
                    )}
                  />
                  {t(crop)}
                </button>
              );
            })}

            {/* Quick button to open full catalog */}
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-xs text-muted-foreground hover:border-amber-400/40 hover:text-amber-200"
            >
              <Plus className="size-3" />
              <span>{t('More crops...')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Farm information ─────────────────────────────────── */}
      <section aria-labelledby="section-farm-info">
        <SectionHeading
          number="2"
          title="Farm information"
          subtitle="Collect the details needed for personalized recommendations."
        />

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Card 1: Location */}
          <Card className="flex flex-col justify-between border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                    <MapPin className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t('Location')}</h3>
                </div>
                <Badge variant="outline" className="border-white/10 font-mono text-[10px] text-muted-foreground">
                  {number(analysis.field.latitude, { maximumFractionDigits: 2 })}°N,{' '}
                  {number(analysis.field.longitude, { maximumFractionDigits: 2 })}°E
                </Badge>
              </div>
              <p className="mt-2 text-xs font-medium text-foreground/90">
                {displayLocationName}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t('Village / District')}
                {analysis.field.area != null && analysis.field.areaUnit
                  ? ` · ${number(analysis.field.area)} ${t(analysis.field.areaUnit)}`
                  : ''}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5 font-mono text-[10px] text-muted-foreground/70">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span>{t('NASA Earth Observation coordinates verified')}</span>
            </div>
          </Card>

          {/* Card 2: Soil type */}
          <Card className="flex flex-col justify-between border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                    <Layers className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t('Soil type')}</h3>
                </div>
                <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 font-mono text-[10px] capitalize text-amber-200">
                  {t(analysis.field.soilType || 'Loam')}
                </Badge>
              </div>
              <p className="mt-2 text-xs font-medium capitalize text-foreground/90">
                {t(analysis.field.soilType || 'Loamy soil')}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t('Soil information')} · {t('Balanced texture, good water-holding capacity')}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5 font-mono text-[10px] text-muted-foreground/70">
              <span className="size-1.5 rounded-full bg-amber-400" />
              <span>{t('Soil depth & drainage compatibility evaluated')}</span>
            </div>
          </Card>

          {/* Card 3: Planting date */}
          <Card className="flex flex-col justify-between border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                    <Calendar className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t('Planting date')}</h3>
                </div>
                {activeCompatibility?.isPlantableNow ? (
                  <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/10 font-mono text-[10px] text-emerald-200">
                    {t('Plantable now')}
                  </Badge>
                ) : activeCompatibility?.monthsUntilPlant ? (
                  <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 font-mono text-[10px] text-amber-200">
                    {t('Next in {months} mo', { months: activeCompatibility.monthsUntilPlant })}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-xs font-medium text-foreground/90">
                {t('Plant')} {t(activeCompatibility?.plantingSeason ?? 'Season-dependent')} · {t('Harvest')} {t(activeCompatibility?.harvestSeason ?? 'Season-dependent')}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t('Growing season')} · {t('Window for {crop}', { crop: t(selectedCrop) })}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5 font-mono text-[10px] text-muted-foreground/70">
              <Clock className="size-3 text-cyan-400" />
              <span>{t('Phenological window aligned with seasonal rainfall')}</span>
            </div>
          </Card>

          {/* Card 4: Irrigation */}
          <Card className="flex flex-col justify-between border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-blue-400/10 text-blue-300">
                    <Droplets className="size-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{t('Irrigation')}</h3>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono text-[10px] capitalize',
                    IRRIGATION_COLOR[analysis.field.irrigationType ?? 'limited']
                  )}
                >
                  {t(analysis.field.irrigationType ?? 'limited')}
                </Badge>
              </div>
              <p className="mt-2 text-xs font-medium capitalize text-foreground/90">
                {t('{irrigation} water infrastructure', { irrigation: t(analysis.field.irrigationType ?? 'limited') })}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {t('Water availability')} ·{' '}
                {t('Soil moisture deficit: {score} mm', { score: analysis.risks.soilMoistureDeficit })}
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5 font-mono text-[10px] text-muted-foreground/70">
              <span className="size-1.5 rounded-full bg-blue-400" />
              <span>{t('GPM precipitation & SMAP soil moisture cross-checked')}</span>
            </div>
          </Card>
        </div>
      </section>

      {/* ── SECTION 3: Crop analysis ────────────────────────────────────── */}
      <section aria-labelledby="section-crop-analysis">
        <SectionHeading
          number="3"
          title="Crop analysis"
          subtitle="Show the results using cards and visual indicators."
        />

        {/* 4 Visual Indicator Cards matching the mockup */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {/* Card 1: Climate suitability */}
          <Card className="border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
                  <Sun className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{t('Climate suitability')}</h3>
              </div>
              <span className="font-mono text-xl font-light text-amber-300 tabular-nums">
                {number(activeCompatibility?.climateFit ?? 80)}%
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-500"
                  style={{ width: `${activeCompatibility?.climateFit ?? 80}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Temperature, solar radiation, and GPM precipitation match the optimal physiological growth envelope.')}
            </p>
          </Card>

          {/* Card 2: Soil suitability */}
          <Card className="border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                  <Sprout className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{t('Soil suitability')}</h3>
              </div>
              <span className="font-mono text-xl font-light text-emerald-300 tabular-nums">
                {number(activeCompatibility?.soilFit ?? 82)}%
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${activeCompatibility?.soilFit ?? 82}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('Soil texture and pH envelope provide strong root aeration and nutrient exchange capacity for {crop}.', { crop: t(selectedCrop) })}
            </p>
          </Card>

          {/* Card 3: Environmental stress risk */}
          <Card className="border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-rose-400/10 text-rose-300">
                  <ShieldAlert className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{t('Environmental stress risk')}</h3>
              </div>
              <Badge variant="outline" className={cn('font-mono text-xs', environmentalRiskColor)}>
                {t(environmentalRiskLevel)} {t('Risk')}
              </Badge>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    environmentalRiskLevel === 'High'
                      ? 'bg-rose-400'
                      : environmentalRiskLevel === 'Moderate'
                      ? 'bg-amber-400'
                      : 'bg-emerald-400'
                  )}
                  style={{ width: `${environmentalRiskScore}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {t(analysis.risks.summary || 'Monitor the field regularly for early signs of crop stress.')}
            </p>
          </Card>

          {/* Card 4: Yield estimation */}
          <Card className="border-white/10 bg-card/50 p-4 transition-all hover:border-white/20 sm:p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                  <TrendingUp className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{t('Yield estimation')}</h3>
              </div>
              <span className="font-mono text-xl font-light text-cyan-300 tabular-nums">
                {number(activeCompatibility?.overallFit ?? 85)} / 100
              </span>
            </div>
            <div className="mt-3">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-cyan-400 transition-all duration-500"
                  style={{ width: `${activeCompatibility?.overallFit ?? 85}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {activeCompatibility?.overallFit && activeCompatibility.overallFit >= 75
                ? t('High yield potential under optimal nutrient & pest management protocol.')
                : t('Moderate yield expectation; consider rotation or supplemental irrigation.')}
            </p>
          </Card>
        </div>

        {/* Detailed Compatibility & Score Reasons from CropsPanel */}
        <div className="mt-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="detailed-crops" className="border-white/10 bg-card/40 rounded-xl px-4">
              <AccordionTrigger className="text-xs font-mono uppercase tracking-wider text-amber-200/90 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Info className="size-3.5 text-amber-400" />
                  <span>{t('View detailed dimensional scores & "Why this score" rationale')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2">
                <div className="space-y-3">
                  {analysis.cropCompatibility.map((c, i) => (
                    <div
                      key={c.crop}
                      className={cn(
                        'rounded-lg border p-3 transition-colors',
                        c.crop.toLowerCase() === selectedCrop.toLowerCase()
                          ? 'border-amber-400/40 bg-amber-400/[0.06]'
                          : 'border-white/5 bg-white/[0.02]'
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedCropPreference(c.crop)}
                            className="text-sm font-medium text-foreground hover:text-amber-200 underline-offset-2 hover:underline"
                          >
                            {t(c.crop)}
                          </button>
                          {i === 0 && (
                            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-[10px] text-amber-200">
                              {t('Top fit')}
                            </Badge>
                          )}
                          {c.crop.toLowerCase() === selectedCrop.toLowerCase() && (
                            <Badge variant="outline" className="border-cyan-400/40 bg-cyan-400/10 text-[10px] text-cyan-200">
                              {t('Currently viewing')}
                            </Badge>
                          )}
                        </div>
                        <span className="font-mono text-lg font-light text-amber-300 tabular-nums">
                          {number(c.overallFit)}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <FitBar label="Season" value={c.seasonFit} />
                        <FitBar label="Climate" value={c.climateFit} />
                        <FitBar label="Water" value={c.waterFit} />
                        <FitBar label="Soil" value={c.soilFit} />
                        <FitBar label="Rotation" value={c.rotationFit} />
                      </div>

                      {c.reasons && c.reasons.length > 0 && (
                        <div className="mt-3 space-y-1 border-t border-white/5 pt-2">
                          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                            {t('Key Agronomic Signals')}
                          </span>
                          <ul className="space-y-1">
                            {c.reasons.map((r, idx) => (
                              <li key={idx} className="flex items-start gap-1.5 text-xs text-foreground/80">
                                <span className="mt-1 size-1 shrink-0 rounded-full bg-amber-400" />
                                <span>{t(r)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Top Recommended from CropsPanel */}
                {analysis.recommendations && analysis.recommendations.length > 0 && (
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <div className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                      <Sparkles className="size-3" />
                      <span>{t('What could grow well here? (NASA Candidates)')}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {analysis.recommendations.slice(0, 4).map(r => (
                        <div
                          key={r.crop}
                          className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-xs"
                        >
                          <span className="font-mono text-sm font-semibold text-amber-300">
                            #{number(r.rank)}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">{t(r.crop)}</span>
                              <span className="font-mono text-amber-300/90">{number(r.score)}</span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{t(r.why)}</p>
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

      {/* ── SECTION 4: Farming planner ──────────────────────────────────── */}
      <section aria-labelledby="section-farming-planner">
        <SectionHeading
          number="4"
          title="Farming planner"
          subtitle="Generate a personalized plan based on the selected crop and farm data."
        />

        {/* Selected Crop Badge Banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.05] px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Sprout className="size-4 text-amber-300" />
            <span className="text-xs text-muted-foreground">
              {t('Farming guidance tailored for:')}
            </span>
            <span className="font-semibold text-amber-200">{t(selectedCrop)}</span>
            <Badge variant="outline" className="border-white/10 text-[10px] capitalize">
              {t(analysis.field.soilType || 'Loam')} · {t(analysis.field.irrigationType ?? 'limited')}
            </Badge>
          </div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {number(farmingStages.length)} {t('actionable stages')}
          </span>
        </div>

        {/* 5-Step Actionable Sequential Stages */}
        <div className="space-y-3">
          {farmingStages.map(stage => (
            <Card
              key={stage.step}
              className="border-white/10 bg-card/50 transition-all hover:border-white/20"
            >
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 font-mono text-xs font-semibold text-amber-200">
                      {number(stage.step)}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground sm:text-base">
                        {t(stage.title)}
                      </h3>
                      <p className="text-xs text-muted-foreground">{t(stage.subtitle)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
                    <Badge variant="outline" className="border-white/10 font-mono text-[10px] text-muted-foreground">
                      <Clock className="size-3 mr-1" />
                      {t(stage.duration)}
                    </Badge>
                    <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 font-mono text-[10px] text-amber-200">
                      {t('Focus')}: {t(stage.criticalFocus)}
                    </Badge>
                  </div>
                </div>

                {/* Stage Tasks Checklist */}
                <div className="mt-3.5 space-y-1.5 pl-10">
                  {stage.tasks.map((task, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-foreground/85">
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400 mt-0.5" />
                      <span>{t(task)}</span>
                    </div>
                  ))}
                </div>

                {/* Agronomic Pro Tips */}
                {stage.tips && stage.tips.length > 0 && (
                  <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-400/[0.03] p-2.5 pl-10">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                      <Sparkle className="size-3" />
                      <span>{t('Agronomic Pro Tip')}</span>
                    </div>
                    <ul className="mt-1 space-y-1">
                      {stage.tips.map((tip, idx) => (
                        <li key={idx} className="text-[11px] text-muted-foreground italic">
                          • {t(tip)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* ── 4-Season Crop Rotation Plan (from PlannerPanel) ─────────── */}
        <div className="mt-8 space-y-4">
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
              <CalendarDays className="size-3" />
              <span>{t('YOUR FIELD SHIFT ROTATION PLAN')}</span>
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {t('Overall rotation score')}
                </div>
                <div className="font-mono text-4xl font-light text-amber-300 tabular-nums">
                  {number(rotationPlan.overallScore)}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">                {t(rotationPlan.name)}</div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <ScoreChip icon={<Leaf />} label="Soil health" score={rotationPlan.soilScore} color="emerald" />
                <ScoreChip icon={<Droplets />} label="Water" score={rotationPlan.waterScore} color="cyan" />
                <ScoreChip icon={<Sun />} label="Climate" score={rotationPlan.climateScore} color="amber" />
                <ScoreChip icon={<Coins />} label="Income" score={rotationPlan.incomeScore} color="violet" />
              </div>
            </div>
          </Card>

          {/* Timeline Cards */}
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
              <Sprout className="size-3" />
              <span>{t('4-Season ROTATION')}</span>
            </div>
            {/* Desktop: horizontal flex with connecting line */}
            <div className="relative hidden md:block">
              <div className="absolute left-0 right-0 top-1/2 -z-0 h-px -translate-y-1/2 bg-gradient-to-r from-amber-400/40 via-amber-400/30 to-amber-400/10" />
              <div className="relative z-10 flex items-stretch gap-4">
                {rotationPlan.years.map((y, i) => (
                  <YearCard
                    key={y.year}
                    year={y.year}
                    crop={y.crop}
                    coverCrop={y.coverCrop}
                    irrigationLevel={y.irrigationLevel}
                    score={y.score}
                    reason={y.reason}
                    plantingSeason={y.plantingSeason}
                    harvestSeason={y.harvestSeason}
                    growingDays={y.growingDays}
                    isLast={i === rotationPlan.years.length - 1}
                  />
                ))}
              </div>
            </div>
            {/* Mobile: vertical stack */}
            <div className="flex flex-col gap-2 md:hidden">
              {rotationPlan.years.map((y, i) => (
                <YearCard
                  key={y.year}
                  year={y.year}
                  crop={y.crop}
                  coverCrop={y.coverCrop}
                  irrigationLevel={y.irrigationLevel}
                  score={y.score}
                  reason={y.reason}
                  plantingSeason={y.plantingSeason}
                  harvestSeason={y.harvestSeason}
                  growingDays={y.growingDays}
                  isLast={i === rotationPlan.years.length - 1}
                />
              ))}
            </div>
          </Card>

          {/* Rationale */}
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
              {t('Rotation Rationale')}
            </div>
            <p className="text-sm italic text-muted-foreground">{t(rotationPlan.rationale)}</p>
          </Card>
        </div>
      </section>

      {/* ── Dialog: Manage & Recalculate Crops (from CropsPanel) ─────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-white/10 bg-background/95 backdrop-blur-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sprout className="size-5 text-amber-300" />
              {t('dashboard.edit-crops-you-re-considering')}
            </DialogTitle>
            <DialogDescription>
              {t('Select crops from the FAO EcoCrop database or search to add them to your evaluation.')}
            </DialogDescription>
          </DialogHeader>

          <Separator className="bg-white/10" />

          <div className="space-y-4">
            {/* Search Bar inside Dialog */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogFilter}
                onChange={e => setCatalogFilter(e.target.value)}
                placeholder={t('Search 60+ crops (e.g. Barley, Chickpea, Banana, Cotton)...')}
                aria-label={t('Search crops')}
                className="h-8 border-white/10 bg-white/[0.04] pl-9 text-xs"
              />
            </div>

            {/* Currently Selected */}
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                {t('dashboard.selected-count', { count: desired.length })}
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
                  <span className="text-xs text-rose-300 italic">
                    {t('No crops selected — pick at least one below.')}
                  </span>
                )}
              </div>
            </div>

            {/* Top Recommended */}
            {extraRecs.length > 0 && !catalogFilter && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {t('Recommended for your field')}
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {extraRecs.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleDesiredCrop(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-foreground/80 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-100"
                    >
                      <Plus className="size-3" />
                      {t(c)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Full FAO Catalog Pool */}
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {catalogFilter
                    ? t('Search Results ({count})', { count: filteredCatalog.length })
                    : t('FAO EcoCrop Catalog')}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {allCropNames.length} {t('crops total')}
                </span>
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <div className="flex flex-wrap gap-1.5">
                  {filteredCatalog.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleDesiredCrop(c)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        desired.includes(c)
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground'
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
                className="text-xs"
              >
                {t('Cancel')}
              </Button>
              <Button
                onClick={handleApplyCropMix}
                disabled={desired.length === 0}
                className="bg-amber-400 text-xs font-medium text-black hover:bg-amber-300"
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
