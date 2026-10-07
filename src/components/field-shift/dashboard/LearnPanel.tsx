"use client";

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Info,
  Satellite,
  Droplets,
  CloudRain,
  Leaf,
  ShieldCheck,
  Coins,
  Sprout,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataSourceBadge } from '@/components/field-shift/DataSourceBadge';
import type { FullAnalysis } from '@/lib/store';

// ── Score explanation row ──────────────────────────────────────────────────
const SCORE_EXPLANATIONS: { name: string; desc: string; icon: React.ReactNode }[] = [
  {
    name: 'Climate fit',
    desc: 'Temperature window match + heat/drought tolerance vs field heat & drought risk.',
    icon: <Info className="size-3.5" />,
  },
  {
    name: 'Water fit',
    desc: 'Field rainfall vs crop water need, irrigation uplift, and flood tolerance vs flood risk.',
    icon: <Droplets className="size-3.5" />,
  },
  {
    name: 'Soil fit',
    desc: 'Root depth, soil texture retention match, and nitrogen-fixing benefit on this soil.',
    icon: <Sprout className="size-3.5" />,
  },
  {
    name: 'Rotation fit',
    desc: 'Alternating family and nitrogen balance vs the previous crop — penalises same-family repeats.',
    icon: <ShieldCheck className="size-3.5" />,
  },
  {
    name: 'Overall fit',
    desc: 'Weighted sum of climate, water, soil, and rotation scores by your priorities (soil/water/climate/income).',
    icon: <Coins className="size-3.5" />,
  },
];

// ── Data-source card ────────────────────────────────────────────────────────
interface SourceCardData {
  name: string;
  measures: string;
  whyUse: string;
  auth: string;
  icon: React.ReactNode;
  accent: 'amber' | 'cyan' | 'emerald' | 'violet';
}

const SOURCE_CARDS: SourceCardData[] = [
  {
    name: 'NASA POWER',
    measures: 'Daily + monthly temperature, rainfall, humidity, and wind for any point on Earth.',
    whyUse:
      'Live, key-authenticated REST API. Chash Orbit uses POWER for temperature and rainfall directly — the backbone of every climate signal here.',
    auth: 'No special authentication required — NASA API key only.',
    icon: <Satellite className="size-5" />,
    accent: 'amber',
  },
  {
    name: 'NASA SMAP',
    measures: 'Surface soil moisture (top ~5 cm) from the Soil Moisture Active Passive mission.',
    whyUse:
      'Would provide true live soil moisture. Chash Orbit derives an estimate from POWER precipitation + a water-balance model instead, and labels it "derived" — never "live SMAP".',
    auth: 'Requires Earthdata auth via NSIDC / AppEEARS. Demo uses POWER-derived substitute.',
    icon: <Droplets className="size-5" />,
    accent: 'cyan',
  },
  {
    name: 'GPM IMERG',
    measures: 'Global Precipitation Measurement (Integrated Multi-satellitE Retrievals) — high-resolution rainfall.',
    whyUse:
      'Chash Orbit uses POWER\'s PRECTOTCORR (GPM-corrected precipitation) and computes IMERG-style stats (anomaly, variability, dry spells) on top of it.',
    auth: 'Late-run GPM data is delivered via NASA GES DISC (Earthdata). POWER PRECTOTCORR already folds GPM in.',
    icon: <CloudRain className="size-5" />,
    accent: 'cyan',
  },
  {
    name: 'MODIS / VIIRS',
    measures: 'NDVI vegetation index (MOD13 / VNP13 products) — global vegetation health, every 16 days.',
    whyUse:
      'Would provide true live NDVI. Chash Orbit derives a seasonal NDVI model from POWER precipitation + temperature climatology instead, and labels it "derived".',
    auth: 'Requires Earthdata auth via AppEEARS / LP DAAC. Demo uses POWER-derived substitute.',
    icon: <Leaf className="size-5" />,
    accent: 'emerald',
  },
];

const ACCENT: Record<SourceCardData['accent'], { text: string; border: string; bg: string }> = {
  amber: { text: 'text-amber-300', border: 'border-amber-400/30', bg: 'bg-amber-400/10' },
  cyan: { text: 'text-cyan-300', border: 'border-cyan-400/30', bg: 'bg-cyan-400/10' },
  emerald: { text: 'text-emerald-300', border: 'border-emerald-400/30', bg: 'bg-emerald-400/10' },
  violet: { text: 'text-violet-300', border: 'border-violet-400/30', bg: 'bg-violet-400/10' },
};

// ── Main panel ──────────────────────────────────────────────────────────────
export function LearnPanel({ analysis }: { analysis: FullAnalysis }) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <h2 className="text-xl font-light text-foreground sm:text-2xl">About this analysis</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Chash Orbit turns NASA Earth-observation data into a transparent field-level
          recommendation. NASA POWER provides live temperature and rainfall data. Soil moisture,
          NDVI, and additional soil metrics are derived estimates — we never falsely label sample
          data as live NASA data.
        </p>
      </Card>

      {/* Source table */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Satellite className="size-3" />
          DATA SOURCES
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-white/10">
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Dataset
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Source status
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
                Attribution
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analysis.sources.map(s => (
              <TableRow key={s.name} className="border-white/5">
                <TableCell className="py-3 text-sm text-foreground">{s.name}</TableCell>
                <TableCell className="py-3">
                  <DataSourceBadge source={s.source} size="sm" />
                </TableCell>
                <TableCell className="py-3 text-xs text-muted-foreground">{s.attribution}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* How we score */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Coins className="size-3" />
          HOW WE SCORE
        </div>
        <div className="space-y-2">
          {SCORE_EXPLANATIONS.map(s => (
            <div key={s.name} className="flex items-start gap-3 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
              <span className="mt-0.5 text-amber-300/80">{s.icon}</span>
              <div>
                <div className="text-sm font-medium text-foreground">{s.name}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Why these data sources */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Info className="size-3" />
          WHY THESE DATA SOURCES
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {SOURCE_CARDS.map((s, i) => {
            const a = ACCENT[s.accent];
            return (
              <motion.div
                key={s.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
                className={`rounded-2xl border ${a.border} ${a.bg} p-4`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex size-9 items-center justify-center rounded-md border ${a.border} bg-background/40 ${a.text}`}>
                    {s.icon}
                  </span>
                  <span className="text-base font-medium text-foreground">{s.name}</span>
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      Measures
                    </span>
                    <p className="mt-0.5 text-foreground/80">{s.measures}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
                      Why Chash Orbit uses it
                    </span>
                    <p className="mt-0.5 text-foreground/80">{s.whyUse}</p>
                  </div>
                  <div className="rounded-md border border-white/5 bg-black/20 px-2 py-1.5 text-muted-foreground italic">
                    {s.auth}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </Card>

      {/* Footer attribution */}
      <Card className="border-white/10 bg-card/40 p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="border-emerald-400/30 bg-emerald-400/10 text-emerald-200">
            <Satellite className="size-3" />
            NASA Open Data
          </Badge>
          <span>
            Temperature & rainfall: NASA POWER (Langley Research Center). Soil moisture, NDVI,
            and additional soil metrics are derived estimates (see attributions above).
          </span>
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
          Chash Orbit · NASA Space Apps Challenge · Earth-to-farm decision system
        </p>
      </Card>
    </div>
  );
}
