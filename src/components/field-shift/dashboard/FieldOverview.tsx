"use client";

import * as React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import {
  Thermometer,
  Droplets,
  CloudRain,
  Sprout,
  Leaf,
  Globe2,
  MapPin,
  Sun,
  Cloud,
  Wheat,
  Sprout as SproutIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatLatLng } from '@/lib/location';
import { DataSourceBadge } from '@/components/field-shift/DataSourceBadge';
import type { FullAnalysis } from '@/lib/store';

// Dynamically import the holographic globe (ssr:false so three.js never runs
// on the server).
const HolographicGlobe = dynamic(
  () => import('@/components/globe/HolographicGlobe').then(m => m.HolographicGlobe),
  { ssr: false },
);

// ── Derivation helpers ──────────────────────────────────────────────────────

function climateZone(lat: number): string {
  const a = Math.abs(lat);
  if (a < 10) return 'Equatorial';
  if (a < 23.5) return 'Tropical';
  if (a < 35) return 'Subtropical';
  if (a < 50) return 'Temperate';
  if (a < 66.5) return 'Boreal';
  return 'Polar';
}

function rainfallZone(annualMm: number): string {
  if (annualMm < 250) return 'Arid';
  if (annualMm < 500) return 'Semi-arid';
  if (annualMm < 1000) return 'Sub-humid';
  if (annualMm < 1500) return 'Humid';
  return 'Wet';
}

function cropRegion(lat: number, _lng: number, currentCrop: string | null): string {
  const a = Math.abs(lat);
  const c = (currentCrop ?? '').toLowerCase();
  if (c.includes('rice') || c.includes('wheat')) {
    return a < 30 ? 'Rice–wheat belt' : 'Wheat–fallow';
  }
  if (c.includes('maize') || c.includes('corn') || c.includes('soy')) {
    return a < 35 ? 'Maize–soybean' : 'Maize belt';
  }
  if (c.includes('millet') || c.includes('sorghum')) {
    return 'Dryland millet';
  }
  if (c.includes('cotton')) return 'Cotton belt';
  if (c.includes('mustard') || c.includes('lentil') || c.includes('chickpea') || c.includes('mung')) {
    return 'Pulse–cereal';
  }
  // Region default by latitude
  if (a < 23) return 'Mixed smallholder';
  if (a < 35) return 'Cereal–legume';
  if (a < 50) return 'Maize–soybean';
  return 'Mixed smallholder';
}

// ── Information ring badge ────────────────────────────────────────────────────
interface RingProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: 'amber' | 'cyan' | 'emerald' | 'violet';
}

const RING_ACCENT: Record<RingProps['accent'], { ring: string; text: string; bg: string }> = {
  amber: { ring: 'border-amber-400/40 text-amber-300', text: 'text-amber-200', bg: 'bg-amber-400/10' },
  cyan: { ring: 'border-cyan-400/40 text-cyan-300', text: 'text-cyan-200', bg: 'bg-cyan-400/10' },
  emerald: { ring: 'border-emerald-400/40 text-emerald-300', text: 'text-emerald-200', bg: 'bg-emerald-400/10' },
  violet: { ring: 'border-violet-400/40 text-violet-300', text: 'text-violet-200', bg: 'bg-violet-400/10' },
};

function InfoRing({ icon, label, value, accent }: RingProps) {
  const s = RING_ACCENT[accent];
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={cn(
          'flex size-16 items-center justify-center rounded-full border-2 bg-white/5 sm:size-20',
          s.ring,
          s.bg,
        )}
      >
        <div className={cn('flex flex-col items-center justify-center', s.text)}>
          {React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
            className: 'size-5 sm:size-6',
          })}
        </div>
      </div>
      <div className="leading-tight">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
          {label}
        </div>
        <div className={cn('text-xs font-medium sm:text-sm', s.text)}>{value}</div>
      </div>
    </div>
  );
}

// ── Field condition row ──────────────────────────────────────────────────────
interface CondRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'risk' | 'neutral';
}

const TONE: Record<CondRowProps['tone'], { text: string; dot: string }> = {
  good: { text: 'text-emerald-300', dot: 'bg-emerald-400' },
  warn: { text: 'text-amber-300', dot: 'bg-amber-400' },
  risk: { text: 'text-rose-300', dot: 'bg-rose-400' },
  neutral: { text: 'text-foreground/80', dot: 'bg-muted-foreground' },
};

function ConditionRow({ icon, label, value, tone }: CondRowProps) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="flex size-7 items-center justify-center rounded-md border border-white/10 bg-white/5 text-muted-foreground">
        {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'size-4' })}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 w-28 shrink-0">
        {label}
      </span>
      <span className="ml-auto flex items-center gap-2 text-sm">
        <span className={cn('size-1.5 rounded-full', t.dot)} />
        <span className={t.text}>{value}</span>
      </span>
    </div>
  );
}

// ── Qualitative labels ──────────────────────────────────────────────────────
function heatLabel(risk: number): { value: string; tone: CondRowProps['tone'] } {
  if (risk < 20) return { value: 'Cool & stable', tone: 'good' };
  if (risk < 40) return { value: 'Mild heat', tone: 'neutral' };
  if (risk < 60) return { value: 'Moderate stress', tone: 'warn' };
  if (risk < 80) return { value: 'High heat risk', tone: 'risk' };
  return { value: 'Severe heat', tone: 'risk' };
}

function droughtLabel(risk: number): { value: string; tone: CondRowProps['tone'] } {
  if (risk < 20) return { value: 'Well-watered', tone: 'good' };
  if (risk < 40) return { value: 'Slight deficit', tone: 'neutral' };
  if (risk < 60) return { value: 'Seasonal deficit', tone: 'warn' };
  if (risk < 80) return { value: 'Water stress', tone: 'risk' };
  return { value: 'Drought risk', tone: 'risk' };
}

function rainfallLabel(anomalyPct: number): { value: string; tone: CondRowProps['tone'] } {
  if (anomalyPct <= -25) return { value: 'Well below normal', tone: 'risk' };
  if (anomalyPct <= -10) return { value: 'Below normal', tone: 'warn' };
  if (anomalyPct < 10) return { value: 'Near normal', tone: 'good' };
  if (anomalyPct < 25) return { value: 'Above normal', tone: 'neutral' };
  return { value: 'Well above normal', tone: 'warn' };
}

function soilMoistureLabel(deficit: number): { value: string; tone: CondRowProps['tone'] } {
  if (deficit < 30) return { value: 'Meets demand', tone: 'good' };
  if (deficit < 60) return { value: 'Slight gap', tone: 'neutral' };
  if (deficit < 90) return { value: 'Below demand', tone: 'warn' };
  return { value: 'Below crop demand', tone: 'risk' };
}

function vegetationLabel(ndvi: number): { value: string; tone: CondRowProps['tone'] } {
  if (ndvi < 0.2) return { value: 'Sparse vegetation', tone: 'risk' };
  if (ndvi < 0.35) return { value: 'Low health', tone: 'warn' };
  if (ndvi < 0.5) return { value: 'Moderate health', tone: 'neutral' };
  if (ndvi < 0.65) return { value: 'Good health', tone: 'good' };
  return { value: 'Vigorous canopy', tone: 'good' };
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function FieldOverview({ analysis }: { analysis: FullAnalysis }) {
  const { field, environment, risks } = analysis;
  const rings = [
    {
      icon: <Sun />,
      label: 'Climate zone',
      value: climateZone(field.latitude),
      accent: 'amber' as const,
    },
    {
      icon: <CloudRain />,
      label: 'Rainfall zone',
      value: rainfallZone(environment.rainfall.annualRainfall),
      accent: 'cyan' as const,
    },
    {
      icon: <Sprout />,
      label: 'Soil zone',
      value: field.soilType.charAt(0).toUpperCase() + field.soilType.slice(1),
      accent: 'emerald' as const,
    },
    {
      icon: <Wheat />,
      label: 'Crop region',
      value: cropRegion(field.latitude, field.longitude, field.currentCrop),
      accent: 'violet' as const,
    },
  ];

  const heat = heatLabel(risks.heatRisk);
  const drought = droughtLabel(risks.droughtRisk);
  const rain = rainfallLabel(environment.rainfall.anomalyPct);
  const sm = soilMoistureLabel(risks.soilMoistureDeficit);
  const veg = vegetationLabel(environment.vegetation.ndvi);

  return (
    <div className="space-y-4">
      {/* Profile header */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-amber-200/80">
            <MapPin className="size-3" />
            YOUR FIELD
          </div>
          <DataSourceBadge source={environment.overallSource} size="sm" />
        </div>
        <h2 className="mt-2 text-2xl font-light text-foreground sm:text-3xl">
          {field.locationName || field.name}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            <Globe2 className="size-3" />
            {formatLatLng(field.latitude, field.longitude)}
          </span>
          {field.area != null && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              {field.area} {field.areaUnit}
            </span>
          )}
          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
            <SproutIcon className="size-3" />
            {field.soilType} soil
          </span>
          {field.irrigationType && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
              <Droplets className="size-3" />
              {field.irrigationType} irrigation
            </span>
          )}
          {field.currentCrop && (
            <Badge variant="outline" className="border-amber-400/40 bg-amber-400/10 text-amber-200">
              Now: {field.currentCrop}
            </Badge>
          )}
        </div>
        {field.desiredCrops.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
              Considering:
            </span>
            {field.desiredCrops.map(c => (
              <Badge
                key={c}
                variant="outline"
                className="border-cyan-400/30 bg-cyan-400/10 text-cyan-100"
              >
                {c}
              </Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Globe + info rings */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr] md:gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30 md:aspect-auto md:h-[280px]"
          >
            <HolographicGlobe
              selectedLat={field.latitude}
              selectedLng={field.longitude}
              locationName={field.locationName || field.name}
              size="compact"
              autoRotate
            />
          </motion.div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-4">
            {rings.map(r => (
              <InfoRing key={r.label} {...r} />
            ))}
          </div>
        </div>
        <div className="mt-3 border-t border-white/5 pt-3 text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {environment.overallAttribution}
        </div>
      </Card>

      {/* Field condition */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
          <Thermometer className="size-3" />
          FIELD CONDITION
        </div>
        <Separator className="mb-2 bg-white/10" />
        <div className="divide-y divide-white/5">
          <ConditionRow icon={<Thermometer />} label="Temperature" value={heat.value} tone={heat.tone} />
          <ConditionRow icon={<Droplets />} label="Water" value={drought.value} tone={drought.tone} />
          <ConditionRow icon={<CloudRain />} label="Rainfall" value={rain.value} tone={rain.tone} />
          <ConditionRow icon={<Sprout />} label="Soil moisture" value={sm.value} tone={sm.tone} />
          <ConditionRow icon={<Leaf />} label="Vegetation" value={veg.value} tone={veg.tone} />
        </div>
        {risks.summary && (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground italic">
            {risks.summary}
          </p>
        )}
      </Card>
    </div>
  );
}
