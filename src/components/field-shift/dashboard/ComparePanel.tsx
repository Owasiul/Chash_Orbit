"use client";

import * as React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Sprout, Coins, Droplets, Leaf, Sun, Thermometer, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FullAnalysis } from '@/lib/store';
import { useTranslation } from '@/lib/locale';
import { CropAtmosphereComparison } from './CropAtmosphereComparison';

// ── Derive the "current rotation" baseline ─────────────────────────────────
function deriveCurrentRotation(currentCrop: string | null): {
  name: string;
  years: { year: number; crop: string }[];
} {
  if (!currentCrop) {
    return {
      name: 'Fallow rotation',
      years: [1, 2, 3, 4].map(y => ({ year: y, crop: 'Fallow' })),
    };
  }
  const c = currentCrop.toLowerCase();
  if (c === 'rice' || c === 'wheat') {
    return {
      name: 'Rice–Wheat rotation',
      years: [1, 2, 3, 4].map(y => ({
        year: y,
        crop: y % 2 === 1 ? 'Rice' : 'Wheat',
      })),
    };
  }
  return {
    name: `${currentCrop} monoculture`,
    years: [1, 2, 3, 4].map(y => ({ year: y, crop: currentCrop })),
  };
}

// ── Estimate current-rotation sub-scores using simple heuristic ──────────────
function estimateCurrentScores(
  currentCrop: string | null,
  recommendedSoil: number,
  recommendedWater: number,
  recommendedClimate: number,
  recommendedIncome: number,
): { soil: number; water: number; climate: number; income: number; overall: number } {
  const isRiceWheat = currentCrop === 'Rice' || currentCrop === 'Wheat';
  const isMonoculture = !isRiceWheat && currentCrop !== null;

  const soilPenalty = isMonoculture ? 18 : isRiceWheat ? 10 : 25;
  const waterPenalty = isMonoculture ? 8 : isRiceWheat ? 6 : 12;
  const climatePenalty = isMonoculture ? 6 : isRiceWheat ? 4 : 8;
  const incomePenalty = isMonoculture ? 10 : isRiceWheat ? 4 : 14;

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const soil = clamp(recommendedSoil - soilPenalty);
  const water = clamp(recommendedWater - waterPenalty);
  const climate = clamp(recommendedClimate - climatePenalty);
  const income = clamp(recommendedIncome - incomePenalty);
  const overall = clamp(Math.round((soil + water + climate + income) / 4));
  return { soil, water, climate, income, overall };
}

// ── Sub-score badge ──────────────────────────────────────────────────────────
function SubScore({ label, value, color }: { label: string; value: number; color: string }) {
  const { t, number } = useTranslation();
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        {t(label)}
      </span>
      <span className={cn('font-mono font-light tabular-nums', color)}>{number(value)}</span>
    </div>
  );
}

// ── Year row ──────────────────────────────────────────────────────────────────
function YearRow({
  year,
  crop,
  score,
  coverCrop,
  plantingSeason,
  harvestSeason,
}: {
  year: number;
  crop: string;
  score?: number;
  coverCrop?: string | null;
  plantingSeason?: string;
  harvestSeason?: string;
}) {
  const { t, number } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        {t('Year {year}', { year })}
      </span>
      <Sprout className="size-3.5 text-amber-300/80" />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{t(crop)}</div>
        {(plantingSeason || harvestSeason) && (
          <div className="text-[10px] text-muted-foreground/80">
            {t('Plant')} {t(plantingSeason ?? '—')} · {t('Harvest')} {t(harvestSeason ?? '—')}
          </div>
        )}
        {coverCrop && (
          <div className="text-[11px] italic text-emerald-300/70">+ {t(coverCrop)}</div>
        )}
      </div>
      {score != null && (
        <span className="font-mono text-sm font-light text-amber-300 tabular-nums">{number(score)}</span>
      )}
    </div>
  );
}

// ── Bar chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  const { t, number } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-2 py-1.5 font-mono text-[10px] text-foreground backdrop-blur">
      <div className="text-muted-foreground/80">{label ? t(label) : ''}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground/80">{t(p.name)}:</span>
          <span className="font-medium">{number(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function ComparePanel({ analysis }: { analysis: FullAnalysis }) {
  const { t, number } = useTranslation();
  const [viewMode, setViewMode] = React.useState<'atmosphere' | 'rotation'>('atmosphere');

  const plan = analysis.rotationPlan;
  const currentCrop = analysis.field.currentCrop;
  const currentRot = React.useMemo(() => deriveCurrentRotation(currentCrop), [currentCrop]);
  const currentScores = React.useMemo(
    () =>
      estimateCurrentScores(
        currentCrop,
        plan.soilScore,
        plan.waterScore,
        plan.climateScore,
        plan.incomeScore,
      ),
    [currentCrop, plan],
  );

  const chartData = [
    { dimension: 'Soil health', Current: currentScores.soil, 'Chash Orbit': plan.soilScore },
    { dimension: 'Water', Current: currentScores.water, 'Chash Orbit': plan.waterScore },
    { dimension: 'Climate', Current: currentScores.climate, 'Chash Orbit': plan.climateScore },
    { dimension: 'Income', Current: currentScores.income, 'Chash Orbit': plan.incomeScore },
  ];

  const delta = plan.overallScore - currentScores.overall;

  return (
    <div className="space-y-6">
      {/* View Mode Toggle Bar */}
      <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewMode('atmosphere')}
            className={cn(
              'h-8 px-3.5 text-xs font-medium',
              viewMode === 'atmosphere'
                ? 'border border-amber-400/40 bg-amber-400/20 text-amber-200 shadow-sm'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <Thermometer className="mr-1.5 size-3.5 text-amber-300" />
            {t('Crop vs NASA Atmosphere')}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewMode('rotation')}
            className={cn(
              'h-8 px-3.5 text-xs font-medium',
              viewMode === 'rotation'
                ? 'border border-amber-400/40 bg-amber-400/20 text-amber-200 shadow-sm'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <Calendar className="mr-1.5 size-3.5 text-amber-300" />
            {t('4-Year Rotation Strategy')}
          </Button>
        </div>

        <span className="hidden pr-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 sm:inline">
          {viewMode === 'atmosphere' ? t('Single & Multi-Crop Evaluation') : t('Long-term Agronomic Cycle')}
        </span>
      </div>

      {viewMode === 'atmosphere' ? (
        <CropAtmosphereComparison analysis={analysis} />
      ) : (
        <div className="space-y-4">
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <h2 className="text-xl font-light text-foreground sm:text-2xl">{t('Compare rotations')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('See how the Chash Orbit recommended rotation outperforms the current rotation.')}
            </p>
          </Card>

          {/* Side-by-side cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Current rotation */}
            <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-rose-200/80">
                  {t('Current rotation')}
                </span>
                <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 text-rose-200">
                  {t(currentRot.name)}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {currentRot.years.map(y => (
                  <YearRow key={y.year} year={y.year} crop={y.crop} />
                ))}
              </div>
              <div className="mt-4 border-t border-white/10 pt-2">
                <SubScore label="Soil" value={currentScores.soil} color="text-emerald-300/80" />
                <SubScore label="Water" value={currentScores.water} color="text-cyan-300/80" />
                <SubScore label="Climate" value={currentScores.climate} color="text-amber-300/80" />
                <SubScore label="Income" value={currentScores.income} color="text-violet-300/80" />
                <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
                    {t('Overall')}
                  </span>
                  <span className="font-mono text-2xl font-light text-rose-200/90 tabular-nums">
                    {number(currentScores.overall)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Chash Orbit plan */}
            <Card className="border-amber-400/30 bg-amber-400/[0.04] p-4 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                  {t('Chash Orbit plan')}
                </span>
                <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">
                  {t(plan.name)}
                </Badge>
              </div>
              <div className="space-y-1.5">
                {plan.years.map(y => (
                  <YearRow
                    key={y.year}
                    year={y.year}
                    crop={y.crop}
                    score={y.score}
                    coverCrop={y.coverCrop}
                    plantingSeason={y.plantingSeason}
                    harvestSeason={y.harvestSeason}
                  />
                ))}
              </div>
              <div className="mt-4 border-t border-amber-400/20 pt-2">
                <SubScore label="Soil" value={plan.soilScore} color="text-emerald-300" />
                <SubScore label="Water" value={plan.waterScore} color="text-cyan-300" />
                <SubScore label="Climate" value={plan.climateScore} color="text-amber-300" />
                <SubScore label="Income" value={plan.incomeScore} color="text-violet-300" />
                <div className="mt-2 flex items-center justify-between border-t border-amber-400/20 pt-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                    {t('Overall')}
                  </span>
                  <span className="font-mono text-2xl font-light text-amber-300 tabular-nums">
                    {number(plan.overallScore)}
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Delta highlight */}
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {t('Overall rotation advantage')}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-3xl font-light tabular-nums',
                      delta >= 0 ? 'text-emerald-300' : 'text-rose-300',
                    )}
                  >
                    {delta >= 0 ? `+${number(delta)}` : number(delta)}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('points vs current practice')}</span>
                </div>
              </div>
              <p className="max-w-md text-xs text-muted-foreground">
                {plan.rationale}
              </p>
            </div>
          </Card>

          {/* Sub-score comparison chart */}
          <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
            <h3 className="mb-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              {t('Sub-score comparison')}
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="dimension" stroke="#888" fontSize={11} tickLine={false} />
                  <YAxis stroke="#888" fontSize={11} domain={[0, 100]} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="Current" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Chash Orbit" fill="#fbbf24" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
