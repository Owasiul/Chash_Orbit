"use client";

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Sprout,
  Leaf,
  Droplets,
  Sun,
  Coins,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { FullAnalysis } from '@/lib/store';

// ── Score chip ──────────────────────────────────────────────────────────────
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
      <span className="font-mono text-[10px] uppercase tracking-widest">{label}</span>
      <span className="font-mono text-base font-light tabular-nums">{score}</span>
    </div>
  );
}

// ── Irrigation badge ──────────────────────────────────────────────────────────
const IRRIGATION_COLOR: Record<string, string> = {
  rainfed: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-100',
  limited: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
  reliable: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
};

// ── Year card ──────────────────────────────────────────────────────────────────
function YearCard({
  year,
  crop,
  coverCrop,
  irrigationLevel,
  score,
  reason,
  isLast,
}: {
  year: number;
  crop: string;
  coverCrop: string | null;
  irrigationLevel: 'rainfed' | 'limited' | 'reliable' | null;
  score: number;
  reason: string;
  isLast: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: (year - 1) * 0.08 }}
      className="relative flex-1"
    >
      <Card className="border-white/10 bg-card/50 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
            Year {year}
          </span>
          <span className="font-mono text-2xl font-light text-amber-300 tabular-nums">
            {score}
          </span>
        </div>
        <div className="text-xl font-medium text-foreground">{crop}</div>
        {coverCrop && (
          <div className="mt-1 text-xs italic text-muted-foreground">
            with {coverCrop}
          </div>
        )}
        <div className="mt-2">
          {irrigationLevel && (
            <Badge variant="outline" className={cn('capitalize', IRRIGATION_COLOR[irrigationLevel])}>
              <Droplets className="size-3" />
              {irrigationLevel}
            </Badge>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{reason}</p>
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

// ── Main panel ──────────────────────────────────────────────────────────────
export function PlannerPanel({ analysis }: { analysis: FullAnalysis }) {
  const plan = analysis.rotationPlan;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Calendar className="size-3" />
          YOUR FIELD SHIFT PLAN
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Overall score
            </div>
            <div className="font-mono text-4xl font-light text-amber-300 tabular-nums">
              {plan.overallScore}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">{plan.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <ScoreChip icon={<Leaf />} label="Soil" score={plan.soilScore} color="emerald" />
            <ScoreChip icon={<Droplets />} label="Water" score={plan.waterScore} color="cyan" />
            <ScoreChip icon={<Sun />} label="Climate" score={plan.climateScore} color="amber" />
            <ScoreChip icon={<Coins />} label="Income" score={plan.incomeScore} color="violet" />
          </div>
        </div>
      </Card>

      {/* Timeline */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Sprout className="size-3" />
          4-YEAR ROTATION
        </div>
        {/* Desktop: horizontal flex with connecting line */}
        <div className="relative hidden md:block">
          {/* Underlying rotation thread */}
          <div className="absolute left-0 right-0 top-1/2 -z-0 h-px -translate-y-1/2 bg-gradient-to-r from-amber-400/40 via-amber-400/30 to-amber-400/10" />
          <div className="relative z-10 flex items-stretch gap-4">
            {plan.years.map((y, i) => (
              <YearCard
                key={y.year}
                year={y.year}
                crop={y.crop}
                coverCrop={y.coverCrop}
                irrigationLevel={y.irrigationLevel}
                score={y.score}
                reason={y.reason}
                isLast={i === plan.years.length - 1}
              />
            ))}
          </div>
        </div>
        {/* Mobile: vertical stack */}
        <div className="flex flex-col gap-2 md:hidden">
          {plan.years.map((y, i) => (
            <YearCard
              key={y.year}
              year={y.year}
              crop={y.crop}
              coverCrop={y.coverCrop}
              irrigationLevel={y.irrigationLevel}
              score={y.score}
              reason={y.reason}
              isLast={i === plan.years.length - 1}
            />
          ))}
        </div>
      </Card>

      {/* Rationale */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          Rationale
        </div>
        <p className="text-sm italic text-muted-foreground">{plan.rationale}</p>
      </Card>
    </div>
  );
}
