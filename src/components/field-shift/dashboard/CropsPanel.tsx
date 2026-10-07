"use client";

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sprout,
  Sparkles,
  Plus,
  X,
  Loader2,
  Check,
  Layers,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

// ── Mini-fit-bar ────────────────────────────────────────────────────────────
function FitBar({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? 'bg-emerald-400' : value >= 50 ? 'bg-amber-400' : 'bg-rose-400';
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
        {label} {value}
      </span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

// ── Section label ──────────────────────────────────────────────────────────────
function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'size-3' })}
      {children}
    </div>
  );
}

// ── Section 1: Your crops ────────────────────────────────────────────────────
function CompatibilitySection({ analysis }: { analysis: FullAnalysis }) {
  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
      <SectionLabel icon={<Sprout />}>Your crops</SectionLabel>
      <p className="mb-3 text-xs text-muted-foreground">
        Compatibility scores for the crops you're considering, weighted by your priorities.
      </p>
      <Accordion type="multiple" className="w-full">
        {analysis.cropCompatibility.map((c, i) => (
          <AccordionItem
            key={c.crop}
            value={c.crop}
            className={cn(
              'rounded-lg border border-white/5 bg-white/[0.02] px-3',
              i === 0 && 'border-amber-400/30 bg-amber-400/[0.04]',
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex w-full items-center gap-3 pr-2">
                <span className="text-sm font-medium text-foreground">{c.crop}</span>
                {i === 0 && (
                  <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">
                    Top fit
                  </Badge>
                )}
                <div className="ml-auto flex items-center gap-3">
                  <div className="hidden gap-3 sm:flex">
                    <FitBar label="Climate" value={c.climateFit} />
                    <FitBar label="Water" value={c.waterFit} />
                    <FitBar label="Soil" value={c.soilFit} />
                    <FitBar label="Rotation" value={c.rotationFit} />
                  </div>
                  <span className="font-mono text-xl font-light text-amber-300 tabular-nums">
                    {c.overallFit}
                  </span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3 sm:hidden">
                  <FitBar label="Climate" value={c.climateFit} />
                  <FitBar label="Water" value={c.waterFit} />
                  <FitBar label="Soil" value={c.soilFit} />
                  <FitBar label="Rotation" value={c.rotationFit} />
                </div>
                <div className="space-y-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                    Why this score
                  </span>
                  {c.reasons.length > 0 ? (
                    <ul className="space-y-1.5">
                      {c.reasons.map((r, idx) => (
                        <li key={idx} className="flex gap-2 text-xs text-foreground/80">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-400" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No specific signal flags this crop — scores are moderate across all dimensions.
                    </p>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Card>
  );
}

// ── Section 2: What could grow well here? ────────────────────────────────────
function RecommendationsSection({ analysis }: { analysis: FullAnalysis }) {
  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
      <SectionLabel icon={<Sparkles />}>What could grow well here?</SectionLabel>
      <p className="mb-3 text-xs text-muted-foreground">
        Top six candidates outside of your current crop, ranked by Chash Orbit's overall fit score.
      </p>
      <ol className="space-y-2.5">
        {analysis.recommendations.map((r, i) => {
          const isTop = i < 4;
          return (
            <motion.li
              key={r.crop}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-3',
                isTop
                  ? 'border-amber-400/30 bg-amber-400/[0.05]'
                  : 'border-white/5 bg-white/[0.02]',
              )}
            >
              <span
                className={cn(
                  'font-mono tabular-nums',
                  isTop ? 'text-lg text-amber-300' : 'text-base text-muted-foreground/80',
                )}
              >
                {String(r.rank).padStart(2, '0')}
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn('font-medium', isTop ? 'text-base text-foreground' : 'text-sm text-foreground/90')}>
                    {r.crop}
                  </span>
                  <span
                    className={cn(
                      'font-mono font-light tabular-nums',
                      isTop ? 'text-2xl text-amber-300' : 'text-lg text-amber-300/80',
                    )}
                  >
                    {r.score}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.why}</p>
              </div>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

// ── Section 3: Change your crops ─────────────────────────────────────────────
function ChangeCropsSection() {
  const inputs = useAppStore(s => s.inputs);
  const analysis = useAppStore(s => s.analysis);
  const setInputs = useAppStore(s => s.setInputs);
  const setAnalysis = useAppStore(s => s.setAnalysis);

  const [open, setOpen] = React.useState(false);
  const [desired, setDesired] = React.useState<string[]>(inputs?.desiredCrops ?? []);
  const [recalculating, setRecalculating] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  // Keep local state in sync when the dialog opens
  React.useEffect(() => {
    if (open) setDesired(inputs?.desiredCrops ?? []);
  }, [open, inputs]);

  // Re-run the analysis with the current `desired` crop list. Shared by the
  // debounced live-preview effect AND the explicit "Done" commit.
  const runAnalysis = React.useCallback(async (crops: string[]) => {
    if (!inputs || !analysis) return;
    if (crops.length === 0) {
      toast.error('You must select at least one crop to consider.');
      return;
    }
    const updatedInputs: FarmerInputs = { ...inputs, desiredCrops: crops };
    setInputs(updatedInputs);
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
        }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setAnalysis(json as FullAnalysis);
      toast.success('Analysis updated with new crop selection.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error('Re-analysis failed: ' + (e as Error).message);
      }
    } finally {
      setRecalculating(false);
    }
  }, [inputs, analysis, setInputs, setAnalysis]);

  // Commit on Done click — explicit user action, no debounce cancellation.
  const handleDone = React.useCallback(() => {
    setOpen(false);
    void runAnalysis(desired);
  }, [desired, runAnalysis]);

  if (!inputs || !analysis) {
    return null;
  }

  // Recommendations not currently selected — surface as suggestions
  const currentSet = new Set(desired);
  const extraRecs = analysis.recommendations
    .map(r => r.crop)
    .filter(c => !currentSet.has(c))
    .slice(0, 6);

  // Pool of crops the user can pick from (their current + extras + recommendations)
  const pool = Array.from(new Set([...desired, ...extraRecs])).sort();

  const toggleCrop = (crop: string) => {
    setDesired(prev => {
      const has = prev.includes(crop);
      if (has) return prev.filter(c => c !== crop);
      return [...prev, crop];
    });
  };

  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
      <SectionLabel icon={<Layers />}>Change your crops</SectionLabel>
      <p className="mb-3 text-xs text-muted-foreground">
        Curious how a different crop mix changes the recommendations? Adjust your
        selection below — Chash Orbit will re-run the analysis with the same NASA
        data and your priorities.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          Currently considering:
        </span>
        {(inputs.desiredCrops ?? []).map(c => (
          <Badge
            key={c}
            variant="outline"
            className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
          >
            {c}
          </Badge>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            className="border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-amber-50"
          >
            <Plus className="size-4" />
            Edit crop selection
          </Button>
        </DialogTrigger>
        <DialogContent className="border-white/10 bg-background/95 backdrop-blur-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Sprout className="size-5 text-amber-300" />
              Edit crops you're considering
            </DialogTitle>
            <DialogDescription>
              Toggle crops to add or remove them. Chash Orbit re-runs the analysis
              automatically (debounced) — keep at least one crop selected.
            </DialogDescription>
          </DialogHeader>

          <Separator className="bg-white/10" />

          <div className="space-y-3">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Selected ({desired.length})
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {desired.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCrop(c)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-400/25"
                  >
                    <Check className="size-3" />
                    {c}
                    <X className="size-3 opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
                {desired.length === 0 && (
                  <span className="text-xs text-rose-300 italic">
                    No crops selected — pick at least one below.
                  </span>
                )}
              </div>
            </div>

            {extraRecs.length > 0 && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Recommended but not selected
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {extraRecs.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCrop(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:border-cyan-400/40 hover:bg-cyan-400/10 hover:text-cyan-100"
                    >
                      <Plus className="size-3" />
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pool.length > 0 && (
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  Full pool
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pool.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCrop(c)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                        desired.includes(c)
                          ? 'border-amber-400/40 bg-amber-400/10 text-amber-100'
                          : 'border-white/10 bg-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2 flex !flex-col items-stretch gap-2 sm:!flex-row sm:items-center sm:justify-between">
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
                    Recalculating...
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <Button
              type="button"
              onClick={handleDone}
              className="border-white/10 bg-white/5 text-foreground hover:bg-white/10"
              variant="outline"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function CropsPanel({ analysis }: { analysis: FullAnalysis }) {
  return (
    <div className="space-y-4">
      <CompatibilitySection analysis={analysis} />
      <RecommendationsSection analysis={analysis} />
      <ChangeCropsSection />
    </div>
  );
}
