"use client";
import * as React from "react";
import { motion } from "framer-motion";
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
  Activity,
  Satellite,
  Clock,
  Mountain,
  Flame,
} from "lucide-react";
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
} from "recharts";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DataSourceBadge } from "@/components/field-shift/DataSourceBadge";
import type { FullAnalysis } from "@/lib/store";
import type { Environment } from "@/lib/nasa/environment";
import type { PowerAnalysis } from "@/lib/nasa/power";
import { useTranslation } from "@/lib/locale";

// ── Helpers ────────────────────────────────────────────────────────────────
function trendArrow(trend: number): {
  icon: React.ReactNode;
  label: string;
  color: string;
} {
  if (trend > 0.001)
    return {
      icon: <ArrowUp className="size-3" />,
      label: "rising",
      color: "text-amber-300",
    };
  if (trend < -0.001)
    return {
      icon: <ArrowDown className="size-3" />,
      label: "falling",
      color: "text-sky-300/80",
    };
  return {
    icon: <Minus className="size-3" />,
    label: "stable",
    color: "text-stone-400",
  };
}

function monthlyTempSeries(
  raw?: PowerAnalysis,
): { month: string; t: number }[] | null {
  if (!raw) return null;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
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
    const key = String(idx + 1).padStart(2, "0");
    const b = buckets[key] ?? { sum: 0, count: 0 };
    return {
      month: name,
      t: b.count ? Math.round((b.sum / b.count) * 10) / 10 : 0,
    };
  });
}

// ── Chart tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
}) {
  const { t, number } = useTranslation();
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-lg border border-amber-400/20 bg-stone-950/95 px-2.5 py-1.5 font-mono text-[10px] shadow-xl backdrop-blur-md">
      <div className="text-stone-400">{label ? t(label) : ""}</div>
      {payload.map((p, i) => (
        <div key={i} className="text-amber-200">
          {payload.length > 1 ? `${t(p.name)}: ` : ""}
          {number(p.value)}
        </div>
      ))}
    </div>
  );
}

// ── Mono micro-label ──────────────────────────────────────────────────────────
function MicroLabel({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200/70",
        className,
      )}
    >
      {icon &&
        React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
          className: "size-3",
        })}
      {typeof children === "string" ? t(children) : children}
    </span>
  );
}

// ── Stat row ──────────────────────────────────────────────────────────────────
function StatRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "risk" | "neutral" | "accent";
}) {
  const { t } = useTranslation();
  const color =
    tone === "good"
      ? "text-emerald-300"
      : tone === "warn"
        ? "text-amber-300"
        : tone === "risk"
          ? "text-rose-300"
          : tone === "accent"
            ? "text-amber-200"
            : "text-stone-200/80";
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/5 py-1.5 text-xs first:border-t-0 first:pt-0">
      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {t(label)}
      </span>
      <span className={cn("shrink-0 font-medium tabular-nums", color)}>{t(value)}</span>
    </div>
  );
}

// ── Bento card shell ──────────────────────────────────────────────────────────
type CardTone = "amber" | "cyan" | "emerald" | "rose" | "neutral";

function BentoCard({
  title,
  icon,
  source,
  attribution,
  children,
  big,
  bigUnit,
  tone = "neutral",
  delay = 0,
}: {
  title: string;
  icon: React.ReactNode;
  source: "live" | "cached" | "demo" | "derived";
  attribution: string;
  children?: React.ReactNode;
  big: string;
  bigUnit: string;
  tone?: CardTone;
  delay?: number;
}) {
  const { t } = useTranslation();
  const accentColor =
    tone === "amber"
      ? "text-amber-300"
      : tone === "cyan"
        ? "text-sky-300"
        : tone === "emerald"
          ? "text-emerald-300"
          : tone === "rose"
            ? "text-rose-300"
            : "text-stone-200";
  const chipBg =
    tone === "amber"
      ? "bg-amber-400/10 border-amber-400/20"
      : tone === "cyan"
        ? "bg-sky-400/10 border-sky-400/20"
        : tone === "emerald"
          ? "bg-emerald-400/10 border-emerald-400/20"
          : tone === "rose"
            ? "bg-rose-400/10 border-rose-400/20"
            : "bg-white/5 border-white/10";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="h-full"
    >
      <Card className="group relative flex h-full flex-col overflow-hidden rounded-2xl border-white/6 bg-stone-950/40 p-3 backdrop-blur-sm transition-colors duration-300 hover:border-amber-400/20 hover:bg-stone-950/60 sm:p-4 md:p-5">        {/* Top hairline glow on hover */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-xl border sm:size-9",
                chipBg,
              )}
            >
              {React.cloneElement(
                icon as React.ReactElement<{ className?: string }>,
                { className: cn("size-3.5 sm:size-4", accentColor) },
              )}
            </span>
            <div className="min-w-0 flex-1">
              <MicroLabel>{title}</MicroLabel>
              <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-widest text-stone-600">
                {attribution}
              </span>
            </div>
          </div>
          <DataSourceBadge source={source} size="sm" />
        </div>

        {/* Big number */}
        <div className="mt-3 flex items-baseline gap-1.5 sm:mt-4">
          <span
            className={cn(
              "text-2xl font-light tracking-tight tabular-nums sm:text-3xl md:text-4xl",
              accentColor,
            )}
          >
            {big}
          </span>
          <span className="text-xs font-medium text-stone-400">{bigUnit}</span>
        </div>

        {/* Body */}
        {children && (
          <div className="mt-3 flex-1 space-y-0 sm:mt-4">{children}</div>
        )}
      </Card>
    </motion.div>
  );
}

// ── Soil-condition badge ──────────────────────────────────────────────────────
type SoilMetric =
  | "low"
  | "medium"
  | "high"
  | "deficit"
  | "adequate"
  | "surplus"
  | "depleting"
  | "stable"
  | "building";

function soilBadgeTone(v: SoilMetric): {
  label: string;
  cls: string;
  dot: string;
} {
  switch (v) {
    case "low":
    case "deficit":
    case "depleting":
      return {
        label: v,
        cls: "border-rose-400/30 bg-rose-400/6 text-rose-200",
        dot: "bg-rose-400",
      };
    case "medium":
    case "adequate":
    case "stable":
      return {
        label: v,
        cls: "border-amber-400/30 bg-amber-400/6 text-amber-200",
        dot: "bg-amber-400",
      };
    case "high":
    case "surplus":
    case "building":
      return {
        label: v,
        cls: "border-emerald-400/30 bg-emerald-400/6 text-emerald-200",
        dot: "bg-emerald-400",
      };
  }
}

// ── Soil condition helper (re-derivation, matches smap.ts deriveSoilCondition) ─
function deriveSoilCondition(env: Environment, currentCrop: string | null) {
  const soilType = (env as Environment & { _soilType?: string })._soilType;
  const ndvi = env.vegetation.ndvi;
  const pct = env.soilMoisture.currentPct;
  const isLegume = currentCrop
    ? /lentil|chickpea|mung|pea|bean|soybean|gram|pigeon/i.test(currentCrop)
    : false;
  const variability = env.rainfall.variability;

  let erosion: SoilMetric = "low";
  if (variability > 8 && ndvi < 0.3) erosion = "high";
  else if (variability > 4) erosion = "medium";

  const organicMatter: SoilMetric =
    ndvi > 0.5 ? "high" : ndvi > 0.3 ? "medium" : "low";
  const moistureCondition: SoilMetric =
    pct == null
      ? "adequate"
      : pct < 30
        ? "deficit"
        : pct > 70
          ? "surplus"
          : "adequate";
  const nitrogenBalance: SoilMetric = isLegume ? "building" : "depleting";
  const waterRetention: SoilMetric = "medium";

  void soilType;
  return {
    texture: "See field record",
    organicMatter,
    moistureCondition,
    nitrogenBalance,
    erosionRisk: erosion,
    waterRetention,
  };
}

// ── Soil metric chip ──────────────────────────────────────────────────────────
function SoilMetricChip({
  label,
  valueText,
  badge,
  delay = 0,
}: {
  label: string;
  valueText: string;
  badge?: SoilMetric;
  delay?: number;
}) {
  const { t } = useTranslation();
  const badgeCls = badge ? soilBadgeTone(badge) : null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-between gap-2 rounded-xl border border-white/6 bg-white/[0.02] px-2.5 py-2 transition-colors duration-300 hover:border-amber-400/20 hover:bg-white/[0.04] sm:px-3 sm:py-2.5"
    >
      <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-widest text-stone-500">
        {t(label)}
      </span>
      {badgeCls ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] capitalize",
            badgeCls.cls,
          )}
        >
          <span className={cn("size-1.5 rounded-full", badgeCls.dot)} />
          {badgeCls.label}
        </span>
      ) : (
        <span className="shrink-0 truncate text-xs font-medium text-stone-300">
          {valueText}
        </span>
      )}
    </motion.div>
  );
}

// ── Main panel ──────────────────────────────────────────────────────────────
export function SignalsPanel({ analysis }: { analysis: FullAnalysis }) {
  const { t, number, date } = useTranslation();
  const { environment, field } = analysis;
  const temp = environment.temperature;
  const rain = environment.rainfall;
  const sm = environment.soilMoisture;
  const veg = environment.vegetation;
  const rainAnomalyPct = rain.anomalyPct ?? 0;
  const smCurrentMm = sm.currentMm ?? 0;
  const smCurrentPct = sm.currentPct ?? 0;
  const smSeasonalDeficit = sm.seasonalDeficit ?? 0;

  const tempSeries = React.useMemo(
    () => monthlyTempSeries(environment.rawPower),
    [environment.rawPower],
  );
  const rainSeries = rain.seasonalPattern ?? [];
  const vegSeries = veg.seasonalPattern ?? [];
  const vegObserved = veg.source === "live" || veg.source === "cached";

  const tempTrend = trendArrow(temp.tenYearTrend);
  const smTrend = trendArrow(sm.tenYearTrend ?? 0);
  const vegTrend = trendArrow(veg.recentTrend);

  const soilCond = React.useMemo(
    () => deriveSoilCondition(environment, field.currentCrop),
    [environment, field.currentCrop],
  );

  // Shared chart axis styling — minimal, amber-tinted
  const axisTick = { fontSize: 9, fill: "rgba(168, 162, 158, 0.5)" };
  const gridStroke = "rgba(255, 255, 255, 0.04)";

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── Hero band ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-amber-400/15 bg-stone-950/60 p-3 sm:p-4 md:p-6"
      >
        {/* Ambient amber glow */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-amber-500/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-20 size-40 rounded-full bg-amber-700/4 blur-3xl" />

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10">
                <Satellite className="size-3.5 text-amber-300" />
              </span>
              <MicroLabel className="text-amber-200/90">
                Field signals
              </MicroLabel>
            </div>
            <h2 className="text-xl font-light tracking-tight text-stone-100 sm:text-2xl md:text-3xl">
              {t("Climate & soil observation")}
            </h2>
            <p className="max-w-xl text-xs leading-relaxed text-stone-400">
              {t(
                "NASA POWER satellite observation fused with derived model estimates. Updated continuously from the field record.",
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 font-mono text-[9px] uppercase tracking-widest text-stone-500 sm:text-[10px]">
            <Clock className="size-3 text-amber-300/70" />
            <span>
              {t("Last sync")} · {date(new Date().toISOString())}
            </span>
          </div>
        </div>
      </motion.div>

      <Card className="border-white/10 bg-stone-950/40 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Info className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-amber-200/80">
            {t("What this analysis evaluates")}
          </h3>
        </div>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-xs leading-relaxed text-stone-300 sm:grid-cols-2">
          {[
            "Annual and growing-season rainfall.",
            "Heat-stress days.",
            "Dry spells.",
            "Temperature and rainfall trends.",
            "Climate suitability for crops.",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300/70" />
              <span>{t(item)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-stone-400">
          {t(
            "Resolution: approximately 0.5° × 0.5° for the relevant MERRA-2 meteorological fields. This is relatively coarse for individual farms.",
          )}
        </p>
      </Card>

      {/* ── Bento grid: 4 climate cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-3 md:grid-cols-2 lg:grid-cols-2 ">
        {/* Temperature */}
        <BentoCard
          title="Temperature"
          icon={<Thermometer />}
          source={temp.source}
          attribution={temp.attribution}
          big={number(temp.current, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}
          bigUnit={t("°C (90d mean)")}
          tone="amber"
          delay={0.05}
        >
          <StatRow
            label="Current max"
            value={`${number(temp.currentMax, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} °C`}
          />
          <StatRow
            label="Growing-season avg"
            value={`${number(temp.growingSeasonAvg, {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })} °C`}
          />
          <StatRow
            label="Heat-stress days (90d)"
            value={`${number(temp.heatStressDays)} ${t("d")}`}
            tone={
              temp.heatStressDays > 20
                ? "risk"
                : temp.heatStressDays > 10
                  ? "warn"
                  : "good"
            }
          />
          <div className="flex items-center justify-between border-t border-white/5 py-1.5 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {t("10y trend")}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 font-medium tabular-nums",
                tempTrend.color,
              )}
            >
              {tempTrend.icon}
              {number(Math.abs(temp.tenYearTrend), {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}{" "}
              °C/yr
            </span>
          </div>
          {tempSeries && (
            <div className="mt-3 h-24 w-full sm:h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={tempSeries}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => t(String(value))}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{
                      stroke: "rgba(251,191,36,0.2)",
                      strokeWidth: 1,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="t"
                    stroke="#fbbf24"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        {/* Rainfall */}
        <BentoCard
          title="Rainfall"
          icon={<CloudRain />}
          source={
            String(rain.source) === "live"
              ? "live"
              : String(rain.source) === "cached"
                ? "cached"
                : "demo"
          }
          attribution={rain.attribution}
          big={number(Math.round(rain.annualRainfall))}
          bigUnit={t("mm / year")}
          tone="cyan"
          delay={0.1}
        >
          <StatRow
            label="Growing-season (90d)"
            value={`${number(Math.round(rain.growingSeasonRainfall))} mm`}
          />
          <StatRow
            label="Anomaly vs climatology"
            value={`${(rain.anomalyPct ?? 0) > 0 ? "+" : ""}${number(rain.anomalyPct ?? 0)}%`}
            tone={Math.abs(rain.anomalyPct ?? 0) > 25 ? "warn" : "neutral"}
          />
          <StatRow
            label="Variability (σ)"
            value={`${number(rain.variability, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} mm/d`}
          />
          <StatRow
            label="Dry spells (90d)"
            value={number(rain.drySpells)}
            tone={
              rain.drySpells > 4 ? "risk" : rain.drySpells > 2 ? "warn" : "good"
            }
          />
          {rainSeries.length > 0 && (
            <div className="mt-3 h-24 w-full sm:h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={rainSeries}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => t(String(value))}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ fill: "rgba(56,189,248,0.05)" }}
                  />
                  <Bar dataKey="mm" radius={[2, 2, 0, 0]}>
                    {rainSeries.map((_, i) => (
                      <Cell key={i} fill="#38bdf8" fillOpacity={0.65} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </BentoCard>

        {/* Soil moisture */}
        <BentoCard
          title="Soil moisture"
          icon={<Droplets />}
          source={(sm.source as string) === "DERIVED" ? "derived" : "demo"}
          attribution={sm.attribution}
          big={number(sm.currentMm ?? 0, { maximumFractionDigits: 0 })}
          bigUnit={t("mm (top ~1m)")}
          tone="cyan"
          delay={0.15}
        >
          <StatRow
            label="Current (% capacity)"
            value={`${number(sm.currentPct ?? 0, { maximumFractionDigits: 0 })}%`}
            tone={
              (sm.currentPct ?? 0) < 30
                ? "risk"
                : (sm.currentPct ?? 0) > 70
                  ? "good"
                  : "neutral"
            }
          />
          <StatRow
            label="Seasonal deficit (90d)"
            value={`${number(sm.seasonalDeficit, {
              maximumFractionDigits: 0,
            })} mm`}
            tone={
              sm.seasonalDeficit > 80
                ? "risk"
                : sm.seasonalDeficit > 40
                  ? "warn"
                  : "good"
            }
          />
          <div className="flex items-center justify-between border-t border-white/5 py-1.5 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {t("10y trend")}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 font-medium tabular-nums",
                smTrend.color,
              )}
            >
              {smTrend.icon}
              {/* No direct SMAP time-series yet (soilMoistureTrendPctPerYear is
                  always null) — show "—" instead of a fake 0.000 %/yr. */}
              {sm.tenYearTrend == null
                ? "—"
                : number(Math.abs(sm.tenYearTrend), {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}{" "}
              %/yr
            </span>
          </div>
          {/* Horizontal bar: current vs 100% */}
          <div className="mt-3">
            <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-stone-600">
              <span>{t("Field capacity")}</span>
              <span className="text-stone-400">
                {number(sm.currentPct ?? 0, { maximumFractionDigits: 0 })} /{" "}
                {number(100)}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.max(2, Math.min(100, sm.currentPct ?? 0))}%`,
                }}
                transition={{
                  duration: 0.8,
                  delay: 0.3,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={cn(
                  "h-full rounded-full",
                  (sm.currentPct ?? 0) < 30
                    ? "bg-gradient-to-r from-rose-500 to-rose-400"
                    : (sm.currentPct ?? 0) > 70
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : "bg-gradient-to-r from-sky-500 to-sky-400",
                )}
              />
            </div>
          </div>
        </BentoCard>

        {/* Vegetation NDVI */}
        <BentoCard
          title="Vegetation (NDVI)"
          icon={<Leaf />}
          source={veg.source}
          attribution={veg.attribution}
          big={number(veg.ndvi, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          bigUnit={
            veg.observedDate ? `NDVI · MODIS ${date(veg.observedDate)}` : "NDVI"
          }
          tone="emerald"
          delay={0.2}
        >
          <StatRow
            label="Health"
            value={veg.health}
            tone={
              veg.health === "vigorous" || veg.health === "good"
                ? "good"
                : veg.health === "moderate"
                  ? "neutral"
                  : "risk"
            }
          />
          <div className="flex items-center justify-between border-t border-white/5 py-1.5 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {t("Recent trend")}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 font-medium tabular-nums",
                vegTrend.color,
              )}
            >
              {vegTrend.icon}
              {number(Math.abs(veg.recentTrend), {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
              })}{" "}
              /yr
            </span>
          </div>
          {vegSeries.length > 0 && (
            <div className="mt-3 h-24 w-full sm:h-28">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={vegSeries}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tickFormatter={(value) => t(String(value))}
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={axisTick}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{
                      stroke: "rgba(52,211,153,0.2)",
                      strokeWidth: 1,
                    }}
                  />
                  {vegObserved && (
                    <Line
                      type="monotone"
                      dataKey="model"
                      name="Model"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="ndvi"
                    name={vegObserved ? "MODIS" : "Model"}
                    stroke="#34d399"
                    strokeWidth={2}
                    dot={vegObserved ? { r: 2, fill: "#34d399" } : false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {vegObserved && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-widest text-stone-600">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 bg-emerald-400" />
                {t("MODIS observed")}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-3 border-t border-dashed border-stone-500" />
                {t("POWER-driven model")}
              </span>
            </div>
          )}
        </BentoCard>
      </div>

      {/* ── High-Resolution Satellite Precision: SRTM Topography & ECOSTRESS ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Topography & Elevation (NASA SRTM) */}
        <BentoCard
          title="Topography & Elevation"
          attribution="NASA SRTM 30m DEM"
          source={environment.topography?.source === "DEMO" ? "demo" : "live"}
          icon={<Mountain />}
          big={number(environment.topography?.elevationM ?? 0)}
          bigUnit="m ASL"
          tone="cyan"
          delay={0.2}
        >
          <div className="space-y-1.5 font-mono text-[10px] text-stone-400">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Slope")}:</span>
              <span className="font-semibold text-stone-200 capitalize">
                {environment.topography?.slopeDeg ?? 0}° ({t(environment.topography?.slopeCategory ?? "flat")}, {environment.topography?.slopePct ?? 0}%)
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Aspect")}:</span>
              <span className="text-stone-200">
                {environment.topography?.aspect ?? "Flat"} ({environment.topography?.aspectDeg ?? 0}°)
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Relief across field")}:</span>
              <span className="text-stone-200">{environment.topography?.reliefM ?? 0} m</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-stone-500">{t("Drainage status")}:</span>
              <span className={cn(
                "font-semibold capitalize",
                environment.topography?.drainageClass === "ponding-risk" ? "text-rose-300" : "text-cyan-200"
              )}>
                {t(environment.topography?.drainageClass ?? "moderate")}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-mono text-stone-500">
            <span>{t("Resolution")}: 30 m (~1 arc-second)</span>
            <span className="capitalize">{t(environment.topography?.terrainRoughness ?? "smooth")} terrain</span>
          </div>
        </BentoCard>

        {/* Evaporative Stress & Thermal (NASA ECOSTRESS) */}
        <BentoCard
          title="Evaporative Stress (ESI)"
          attribution="NASA ECOSTRESS 70m TIR"
          source={environment.ecostress?.source === "NASA_ECOSTRESS" ? "live" : environment.ecostress?.source === "DEMO" ? "demo" : "derived"}
          icon={<Flame />}
          big={number(environment.ecostress?.esi ?? 0.8)}
          bigUnit="ESI (0-1)"
          tone="amber"
          delay={0.25}
        >
          <div className="space-y-1.5 font-mono text-[10px] text-stone-400">
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Canopy stress level")}:</span>
              <span className={cn(
                "font-semibold capitalize",
                environment.ecostress?.stressLevel === "optimal" ? "text-emerald-300" :
                environment.ecostress?.stressLevel === "mild-stress" ? "text-amber-300" : "text-rose-300"
              )}>
                {t(environment.ecostress?.stressLevel ?? "optimal")}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Land Surface Temp (LST)")}:</span>
              <span className="text-stone-200">{environment.ecostress?.lstC ?? 28}°C</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-1">
              <span className="text-stone-500">{t("Canopy thermal anomaly")}:</span>
              <span className={cn(
                (environment.ecostress?.thermalAnomalyC ?? 0) > 1.5 ? "text-rose-300" : "text-emerald-300"
              )}>
                {(environment.ecostress?.thermalAnomalyC ?? 0) > 0 ? "+" : ""}{environment.ecostress?.thermalAnomalyC ?? 0}°C vs air
              </span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-stone-500">{t("Water Use Efficiency")}:</span>
              <span className="text-stone-200">{environment.ecostress?.waterUseEfficiency ?? 2.1} g C/kg H₂O</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[9px] font-mono text-stone-500">
            <span>{t("Resolution")}: 70 m (ISS thermal IR)</span>
            <span>{environment.ecostress?.sceneId ? "ISS Overpass" : "PT-JPL Model"}</span>
          </div>
        </BentoCard>
      </div>

      {/* ── Soil condition rail ──────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="relative overflow-hidden rounded-2xl border-white/6 bg-stone-950/40 p-3 backdrop-blur-sm sm:p-4 md:p-6">
          {/* Subtle ambient glow */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-amber-500/4 blur-3xl" />

          <div className="relative">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10">
                    <FlaskConical className="size-3.5 text-amber-300" />
                  </span>
                  <MicroLabel>Soil condition</MicroLabel>
                </div>
                <p className="text-xs italic text-stone-500">
                  {t("NASA observation + derived model estimate")}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/5 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-amber-200/80">
                <Activity className="size-3" />
                {t("derived")}
              </span>
            </div>

            <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <p className="mb-4 text-xs leading-relaxed text-stone-500">
              {t(
                "Soil moisture is derived from NASA POWER precipitation + a water-balance model. Other soil metrics are derived from regional signals and farmer-reported texture. NASA does not directly measure every soil-health metric.",
              )}
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              <SoilMetricChip
                label="Soil texture"
                valueText={soilCond.texture}
                delay={0.3}
              />
              <SoilMetricChip
                label="Organic matter"
                valueText={soilCond.organicMatter}
                badge={soilCond.organicMatter}
                delay={0.35}
              />
              <SoilMetricChip
                label="Moisture condition"
                valueText={soilCond.moistureCondition}
                badge={soilCond.moistureCondition}
                delay={0.4}
              />
              <SoilMetricChip
                label="Nitrogen balance"
                valueText={soilCond.nitrogenBalance}
                badge={soilCond.nitrogenBalance}
                delay={0.45}
              />
              <SoilMetricChip
                label="Erosion risk"
                valueText={soilCond.erosionRisk}
                badge={soilCond.erosionRisk}
                delay={0.5}
              />
              <SoilMetricChip
                label="Water retention"
                valueText={soilCond.waterRetention}
                badge={soilCond.waterRetention}
                delay={0.55}
              />
            </div>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/15 bg-amber-400/[0.03] px-3.5 py-3 text-xs leading-relaxed text-stone-300">
              <Info className="mt-0.5 size-3.5 shrink-0 text-amber-300/80" />
              <span>
                <strong className="font-medium text-amber-200">
                  {t("NASA observation:")}
                </strong>{" "}
                {t("Soil moisture uses POWER precipitation (GPM-corrected).")}{" "}
                <strong className="font-medium text-stone-200">
                  {t("Derived/model estimate:")}
                </strong>{" "}
                {t(
                  "Soil texture, organic matter, nitrogen balance, erosion risk, and water retention.",
                )}
              </span>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
