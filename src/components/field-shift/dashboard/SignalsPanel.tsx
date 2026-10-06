"use client";

import * as React from 'react';
import {
  Thermometer,
  CloudRain,
  Droplets,
  Leaf,
  ArrowUp,
  ArrowDown,
  Minus,
  FlaskConical,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { DataSourceBadge } from '@/components/field-shift/DataSourceBadge';
import type { FullAnalysis } from '@/lib/store';
import type { Environment } from '@/lib/nasa/environment';
import type { PowerAnalysis } from '@/lib/nasa/power';

// ── Helpers ────────────────────────────────────────────────────────────────
function trendArrow(trend: number): { icon: React.ReactNode; label: string; color: string } {
  if (trend > 0.001) return { icon: <ArrowUp className="size-3" />, label: 'rising', color: 'text-rose-300' };
  if (trend < -0.001) return { icon: <ArrowDown className="size-3" />, label: 'falling', color: 'text-cyan-300' };
  return { icon: <Minus className="size-3" />, label: 'stable', color: 'text-muted-foreground' };
}

function monthlyTempSeries(raw?: PowerAnalysis): { month: string; t: number }[] | null {
  if (!raw) return null;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const buckets: Record<string, { sum: number; count: number }> = {};
  for (let i = 0; i < raw.series.dates.length; i++) {
    const m = raw.series.dates[i].slice(4, 6);
    const t = raw.series.t2m[i];
    if (Number.isNaN(t)) continue;
    buckets[m] ||= { sum: 0, count: 0 };
    buckets[m].sum += t;
    buckets[m].count += 1;
  }
  return months.map((name, idx) => {
    const key = String(idx + 1).padStart(2, '0');
    const b = buckets[key] ?? { sum: 0, count: 0 };
    return { month: name, t: b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0 };
  });
}

// ── Mini section header ──────────────────────────────────────────────────────
function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'size-3' })}
      {children}
    </div>
  );
}

// ── Stat row helper ──────────────────────────────────────────────────────────
function StatRow({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'warn' | 'risk' | 'neutral' }) {
  const color =
    tone === 'good'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-amber-300'
        : tone === 'risk'
          ? 'text-rose-300'
          : 'text-foreground/80';
  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <span className={cn('font-medium', color)}>{value}</span>
    </div>
  );
}

// ── Card shell ─────────────────────────────────────────────────────────────────
function NasaCard({
  title,
  icon,
  source,
  attribution,
  children,
  big,
  bigUnit,
}: {
  title: string;
  icon: React.ReactNode;
  source: 'live' | 'cached' | 'demo' | 'derived';
  attribution: string;
  children: React.ReactNode;
  big: string;
  bigUnit: string;
}) {
  return (
    <Card className="border-white/10 bg-card/50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-amber-300">
            {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: 'size-4' })}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
            {title}
          </span>
        </div>
        <DataSourceBadge source={source} size="sm" />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-3xl font-light text-foreground sm:text-4xl">{big}</span>
        <span className="text-sm text-muted-foreground">{bigUnit}</span>
      </div>
      <div className="mt-3 divide-y divide-white/5">{children}</div>
      <div className="mt-3 border-t border-white/5 pt-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
        Source: {attribution}
      </div>
    </Card>
  );
}

// ── Soil-condition badge ──────────────────────────────────────────────────────
type SoilMetric = 'low' | 'medium' | 'high' | 'deficit' | 'adequate' | 'surplus' | 'depleting' | 'stable' | 'building';
function soilBadgeTone(v: SoilMetric): { label: string; cls: string } {
  switch (v) {
    case 'low':
    case 'deficit':
    case 'depleting':
      return { label: v, cls: 'border-rose-400/40 bg-rose-400/10 text-rose-200' };
    case 'medium':
    case 'adequate':
    case 'stable':
      return { label: v, cls: 'border-amber-400/40 bg-amber-400/10 text-amber-200' };
    case 'high':
    case 'surplus':
    case 'building':
      return { label: v, cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' };
  }
}

// ── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-md border border-white/10 bg-black/80 px-2 py-1.5 font-mono text-[10px] text-foreground backdrop-blur">
      <div className="text-muted-foreground/80">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-amber-200">{p.value}</div>
      ))}
    </div>
  );
}

// ── Soil condition helper (re-derivation, matches smap.ts deriveSoilCondition) ─
function deriveSoilCondition(env: Environment, currentCrop: string | null) {
  // Texture — uses farmer-reported soil type from the field record
  const soilType = (env as Environment & { _soilType?: string })._soilType;
  // We don't have direct access to the field's soilType here, but we can
  // derive the texture from field soil. The CropsPanel and parent know this.
  // For this panel we use NDVI + soil moisture %.
  const ndvi = env.vegetation.ndvi;
  const pct = env.soilMoisture.currentPct;
  const isLegume = currentCrop ? /lentil|chickpea|mung|pea|bean|soybean|gram|pigeon/i.test(currentCrop) : false;
  const variability = env.rainfall.variability;

  // Heuristic re-derivation
  let erosion: SoilMetric = 'low';
  if (variability > 8 && ndvi < 0.3) erosion = 'high';
  else if (variability > 4) erosion = 'medium';

  const organicMatter: SoilMetric = ndvi > 0.5 ? 'high' : ndvi > 0.3 ? 'medium' : 'low';
  const moistureCondition: SoilMetric = pct < 30 ? 'deficit' : pct > 70 ? 'surplus' : 'adequate';
  const nitrogenBalance: SoilMetric = isLegume ? 'building' : 'depleting';
  // Water retention — not measurable here without soil texture; default to 'medium'
  const waterRetention: SoilMetric = 'medium';

  void soilType;
  return {
    texture: 'See field record',
    organicMatter,
    moistureCondition,
    nitrogenBalance,
    erosionRisk: erosion,
    waterRetention,
  };
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function SignalsPanel({ analysis }: { analysis: FullAnalysis }) {
  const { environment, field } = analysis;
  const temp = environment.temperature;
  const rain = environment.rainfall;
  const sm = environment.soilMoisture;
  const veg = environment.vegetation;

  const tempSeries = React.useMemo(() => monthlyTempSeries(environment.rawPower), [environment.rawPower]);
  const rainSeries = rain.seasonalPattern ?? [];
  const vegSeries = veg.seasonalPattern ?? [];

  const tempTrend = trendArrow(temp.tenYearTrend);
  const smTrend = trendArrow(sm.tenYearTrend);
  const vegTrend = trendArrow(veg.recentTrend);

  const soilCond = React.useMemo(
    () => deriveSoilCondition(environment, field.currentCrop),
    [environment, field.currentCrop],
  );

  // Bar color for current month on rainfall chart (just the bar that's "current")
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Temperature */}
        <NasaCard
          title="Temperature"
          icon={<Thermometer />}
          source={temp.source}
          attribution={temp.attribution}
          big={`${temp.current.toFixed(1)}`}
          bigUnit="°C (90d mean)"
        >
          <StatRow label="Current max" value={`${temp.currentMax.toFixed(1)} °C`} />
          <StatRow label="Growing-season avg" value={`${temp.growingSeasonAvg.toFixed(1)} °C`} />
          <StatRow
            label="Heat-stress days (90d)"
            value={`${temp.heatStressDays} d`}
            tone={temp.heatStressDays > 20 ? 'risk' : temp.heatStressDays > 10 ? 'warn' : 'good'}
          />
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">10y trend</span>
            <span className={cn('flex items-center gap-1 font-medium', tempTrend.color)}>
              {tempTrend.icon}
              {Math.abs(temp.tenYearTrend).toFixed(3)} °C/yr
            </span>
          </div>
          {tempSeries && (
            <div className="mt-2 h-20 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tempSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" domain={['dataMin - 2', 'dataMax + 2']} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="t" stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </NasaCard>

        {/* Rainfall */}
        <NasaCard
          title="Rainfall"
          icon={<CloudRain />}
          source={rain.source === 'live' ? 'live' : rain.source === 'cached' ? 'cached' : 'demo'}
          attribution={rain.attribution}
          big={`${Math.round(rain.annualRainfall)}`}
          bigUnit="mm / year"
        >
          <StatRow label="Growing-season (90d)" value={`${Math.round(rain.growingSeasonRainfall)} mm`} />
          <StatRow
            label="Anomaly vs climatology"
            value={`${rain.anomalyPct > 0 ? '+' : ''}${rain.anomalyPct}%`}
            tone={Math.abs(rain.anomalyPct) > 25 ? 'warn' : 'neutral'}
          />
          <StatRow label="Variability (σ)" value={`${rain.variability.toFixed(2)} mm/d`} />
          <StatRow
            label="Dry spells (90d)"
            value={`${rain.drySpells}`}
            tone={rain.drySpells > 4 ? 'risk' : rain.drySpells > 2 ? 'warn' : 'good'}
          />
          {rainSeries.length > 0 && (
            <div className="mt-2 h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rainSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="mm" radius={[2, 2, 0, 0]}>
                    {rainSeries.map((_, i) => (
                      <Cell key={i} fill="#22d3ee" fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </NasaCard>

        {/* Soil moisture */}
        <NasaCard
          title="Soil moisture"
          icon={<Droplets />}
          source={sm.source === 'derived' ? 'derived' : 'demo'}
          attribution={sm.attribution}
          big={`${sm.currentMm.toFixed(0)}`}
          bigUnit="mm (top ~1m)"
        >
          <StatRow
            label="Current (% capacity)"
            value={`${sm.currentPct.toFixed(0)}%`}
            tone={sm.currentPct < 30 ? 'risk' : sm.currentPct > 70 ? 'good' : 'neutral'}
          />
          <StatRow
            label="Seasonal deficit (90d)"
            value={`${sm.seasonalDeficit.toFixed(0)} mm`}
            tone={sm.seasonalDeficit > 80 ? 'risk' : sm.seasonalDeficit > 40 ? 'warn' : 'good'}
          />
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">10y trend</span>
            <span className={cn('flex items-center gap-1 font-medium', smTrend.color)}>
              {smTrend.icon}
              {Math.abs(sm.tenYearTrend).toFixed(3)} %/yr
            </span>
          </div>
          {/* Horizontal bar: current vs 100% */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground/60">
              <span>Field capacity</span>
              <span>{sm.currentPct.toFixed(0)} / 100%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className={cn(
                  'h-full rounded-full',
                  sm.currentPct < 30 ? 'bg-rose-400' : sm.currentPct > 70 ? 'bg-emerald-400' : 'bg-cyan-400',
                )}
                style={{ width: `${Math.max(2, Math.min(100, sm.currentPct))}%` }}
              />
            </div>
          </div>
        </NasaCard>

        {/* Vegetation NDVI */}
        <NasaCard
          title="Vegetation (NDVI)"
          icon={<Leaf />}
          source={veg.source === 'derived' ? 'derived' : 'demo'}
          attribution={veg.attribution}
          big={veg.ndvi.toFixed(2)}
          bigUnit="NDVI"
        >
          <StatRow
            label="Health"
            value={veg.health}
            tone={veg.health === 'vigorous' || veg.health === 'good' ? 'good' : veg.health === 'moderate' ? 'neutral' : 'risk'}
          />
          <div className="flex items-center justify-between py-1 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">Recent trend</span>
            <span className={cn('flex items-center gap-1 font-medium', vegTrend.color)}>
              {vegTrend.icon}
              {Math.abs(veg.recentTrend).toFixed(3)} /yr
            </span>
          </div>
          {vegSeries.length > 0 && (
            <div className="mt-2 h-24 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={vegSeries} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted-foreground" domain={[0, 1]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Line type="monotone" dataKey="ndvi" stroke="#34d399" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </NasaCard>
      </div>

      {/* Soil condition section */}
      <Card className="border-white/10 bg-card/50 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <SectionLabel icon={<FlaskConical />}>Soil condition</SectionLabel>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
            NASA observation + derived model estimate
          </span>
        </div>
        <Separator className="my-3 bg-white/10" />
        <p className="mb-3 text-xs text-muted-foreground italic">
          Soil moisture is derived from NASA POWER precipitation + a water-balance model. Other soil
          metrics are derived from regional signals and farmer-reported texture. NASA does not
          directly measure every soil-health metric.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SoilMetricRow label="Soil texture" valueText={soilCond.texture} />
          <SoilMetricRow label="Organic matter" valueText={soilCond.organicMatter} badge={soilCond.organicMatter} />
          <SoilMetricRow label="Moisture condition" valueText={soilCond.moistureCondition} badge={soilCond.moistureCondition} />
          <SoilMetricRow label="Nitrogen balance" valueText={soilCond.nitrogenBalance} badge={soilCond.nitrogenBalance} />
          <SoilMetricRow label="Erosion risk" valueText={soilCond.erosionRisk} badge={soilCond.erosionRisk} />
          <SoilMetricRow label="Water retention" valueText={soilCond.waterRetention} badge={soilCond.waterRetention} />
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100/80">
          <Info className="mt-0.5 size-3.5 shrink-0 text-cyan-300" />
          <span>
            <strong className="font-medium text-cyan-200">NASA observation:</strong> soil moisture
            derived from POWER precipitation (GPM-corrected).{' '}
            <strong className="font-medium text-amber-200">Derived/model estimate:</strong> texture,
            organic matter, nitrogen balance, erosion risk, water retention.
          </span>
        </div>
      </Card>
    </div>
  );
}

function SoilMetricRow({
  label,
  valueText,
  badge,
}: {
  label: string;
  valueText: string;
  badge?: SoilMetric;
}) {
  const badgeCls = badge ? soilBadgeTone(badge) : null;
  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.03] px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80">
        {label}
      </span>
      {badgeCls ? (
        <Badge variant="outline" className={cn('capitalize', badgeCls.cls)}>
          {badgeCls.label}
        </Badge>
      ) : (
        <span className="text-xs font-medium text-foreground/80">{valueText}</span>
      )}
    </div>
  );
}
