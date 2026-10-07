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
import { ArrowRight, Calendar, Sprout, Coins, Droplets, Leaf, Sun } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FullAnalysis } from '@/lib/store';

// ── Derive the "current rotation" baseline ─────────────────────────────────
// If the field's currentCrop is Rice or Wheat (rice-wheat system), produce the
// classic Rice → Wheat → Rice → Wheat pattern. Otherwise repeat the current
// crop for all 4 years. If there's no current crop, fall back to "Fallow".
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
// Compare to the recommended rotation's years and apply a modest penalty for
// repeating the same family / not alternating legume↔cereal.
function estimateCurrentScores(
  currentCrop: string | null,
  recommendedSoil: number,
  recommendedWater: number,
  recommendedClimate: number,
  recommendedIncome: number,
): { soil: number; water: number; climate: number; income: number; overall: number } {
  // Heuristic: same crop = no rotation benefit → drop soil/climate by ~15-25%.
  // Rice-wheat (alternating Poaceae) is slightly better than monoculture.
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
  return (
    <div className="flex items-center justify-between py-1.5 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      <span className={cn('font-mono font-light tabular-nums', color)}>{value}</span>
    </div>
  );
}

// ── Year row ──────────────────────────────────────────────────────────────────
function YearRow({ year, crop, score, coverCrop }: { year: number; crop: string; score?: number; coverCrop?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
        Y{year}
      </span>
      <Sprout className="size-3.5 text-amber-300/80" />
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{crop}</div>
        {coverCrop && (
          <div className="text-[11px] italic text-emerald-300/70">+ {coverCrop}</div>
        )}
      </div>
      {score != null && (
        <span className="font-mono text-sm font-light text-amber-300 tabular-nums">{score}</span>
      )}
    </div>
  );
}

// ── Bar chart tooltip ──────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-2 py-1.5 font-mono text-[10px] text-foreground backdrop-blur">
      <div className="text-muted-foreground/80">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground/80">{p.name}:</span>
          <span className="font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function ComparePanel({ analysis }: { analysis: FullAnalysis }) {
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
    { dimension: 'Soil', Current: currentScores.soil, 'Chash Orbit': plan.soilScore },
    { dimension: 'Water', Current: currentScores.water, 'Chash Orbit': plan.waterScore },
    { dimension: 'Climate', Current: currentScores.climate, 'Chash Orbit': plan.climateScore },
    { dimension: 'Income', Current: currentScores.income, 'Chash Orbit': plan.incomeScore },
  ];

  const delta = plan.overallScore - currentScores.overall;

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <h2 className="text-xl font-light text-foreground sm:text-2xl">Compare rotations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          See how the Chash Orbit recommended rotation outperforms the current rotation.
        </p>
      </Card>

      {/* Side-by-side cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Current rotation */}
        <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-rose-200/80">
              Current rotation
            </span>
            <Badge variant="outline" className="border-rose-400/30 bg-rose-400/10 text-rose-200">
              {currentRot.name}
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
                Overall
              </span>
              <span className="font-mono text-2xl font-light text-rose-200/90 tabular-nums">
                {currentScores.overall}
              </span>
            </div>
          </div>
        </Card>

        {/* Chash Orbit plan */}
        <Card className="border-amber-400/30 bg-amber-400/[0.04] p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
              Chash Orbit plan
            </span>
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">
              {plan.name}
            </Badge>
          </div>
          <div className="space-y-1.5">
            {plan.years.map(y => (
              <YearRow key={y.year} year={y.year} crop={y.crop} score={y.score} coverCrop={y.coverCrop} />
            ))}
          </div>
          <div className="mt-4 border-t border-amber-400/20 pt-2">
            <SubScore label="Soil" value={plan.soilScore} color="text-emerald-300" />
            <SubScore label="Water" value={plan.waterScore} color="text-cyan-300" />
            <SubScore label="Climate" value={plan.climateScore} color="text-amber-300" />
            <SubScore label="Income" value={plan.incomeScore} color="text-violet-300" />
            <div className="mt-2 flex items-center justify-between border-t border-amber-400/20 pt-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
                Overall
              </span>
              <span className="font-mono text-2xl font-light text-amber-300 tabular-nums">
                {plan.overallScore}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Grouped bar chart */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Calendar className="size-3" />
          SUB-SCORE COMPARISON
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-foreground" />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted-foreground" />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                iconType="circle"
              />
              <Bar dataKey="Current" name="Current rotation" fill="#fb7185" radius={[3, 3, 0, 0]} fillOpacity={0.85} />
              <Bar dataKey="Chash Orbit" name="Chash Orbit plan" fill="#fbbf24" radius={[3, 3, 0, 0]} fillOpacity={0.9} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Summary line */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-amber-400/30 bg-amber-400/[0.06] p-4 sm:p-6">
          <p className="text-sm text-foreground/90">
            Chash Orbit plan scores <span className="font-mono text-amber-300">{plan.overallScore}</span>{' '}
            vs current <span className="font-mono text-rose-300">{currentScores.overall}</span> —{' '}
            <span className="inline-flex items-center gap-1 font-mono text-amber-300">
              {delta > 0 ? (
                <>
                  +{delta} point
                  <ArrowRight className="size-3.5" />
                  improvement
                </>
              ) : delta < 0 ? (
                <>
                  {delta} point
                  <ArrowRight className="size-3.5 rotate-90" />
                  regression
                </>
              ) : (
                <>no overall change</>
              )}
            </span>{' '}
            weighted by your priorities.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Leaf className="size-3 text-emerald-300" /> Soil {analysis.field.priorities.soil}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Droplets className="size-3 text-cyan-300" /> Water {analysis.field.priorities.water}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sun className="size-3 text-amber-300" /> Climate {analysis.field.priorities.climate}%
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coins className="size-3 text-violet-300" /> Income {analysis.field.priorities.income}%
            </span>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
