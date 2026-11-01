// Chash Orbit — What-if scenarios and climate-robust ranking.
//
// Pure functions only (no DB, no fetch), so they run in the browser and the
// sliders respond instantly. A scenario shifts the observed NASA POWER daily
// series (temperature offset, rainfall multiplier), re-derives every value that
// depends on it, and re-runs the same deterministic engine. Nothing here is
// invented by an LLM.
//
// Known limits (say them in the UI):
//  - Rainfall is scaled uniformly, so it changes totals but not rain-day
//    timing, though threshold-based wet-day counts can change. This is a
//    stress test, not a weather forecast.
//  - MODIS NDVI is observed and is left unchanged.

import {
  computeCropCompatibility,
  computeRisks,
  analyze,
  type AnalysisResult,
  type CropCompatibility,
  type FarmerInputs,
  type Risks,
} from './engine';
import { getCropByName } from '@/lib/crops';
import type { Environment } from '@/lib/nasa/environment';
import type { PowerAnalysis, PowerDailySeries } from '@/lib/nasa/power';
import { deriveSoilMoisture } from '@/lib/nasa/smap';
import { deriveRainfall } from '@/lib/nasa/gpm';

export interface Scenario {
  /** °C added to T2M, T2M_MAX and T2M_MIN */
  tempDeltaC: number;
  /** multiplier on daily PRECTOTCORR (0.8 = 20 % less rain) */
  rainFactor: number;
  label?: string;
}

export const BASELINE: Scenario = { tempDeltaC: 0, rainFactor: 1, label: 'Today' };

/** 3 x 3 grid used for the robustness table. */
export const DEFAULT_GRID: Scenario[] = [0, 1, 2].flatMap(t =>
  [0.8, 1, 1.2].map(r => ({
    tempDeltaC: t,
    rainFactor: r,
    label: `${t > 0 ? `+${t}°C` : 'Same temp'}, ${r === 1 ? 'same rain' : r < 1 ? `${Math.round((1 - r) * 100)}% drier` : `${Math.round((r - 1) * 100)}% wetter`}`,
  })),
);

// ── small stats helpers (same definitions as nasa/power.ts) ──────────────────
const finite = (a: number[]) => a.filter(x => Number.isFinite(x));
const mean = (a: number[]) => {
  const v = finite(a);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
};
const sum = (a: number[]) => finite(a).reduce((s, x) => s + x, 0);
const std = (a: number[]) => {
  const v = finite(a);
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
};
const r1 = (v: number) => Math.round(v * 10) / 10;

function resummarize(base: PowerAnalysis, series: PowerDailySeries): PowerAnalysis {
  const n = series.dates.length;
  const from = Math.max(0, n - 90);
  const t90 = series.t2m.slice(from);
  const tMax90 = series.t2mMax.slice(from);
  const p90 = series.prectotcorr.slice(from);

  let drySpells = 0;
  let run = 0;
  for (const v of p90) {
    if (Number.isFinite(v) && v < 1) run++;
    else { if (run >= 3) drySpells++; run = 0; }
  }
  if (run >= 3) drySpells++;

  return {
    ...base,
    series,
    currentTemp: mean(t90),
    currentTempMax: mean(tMax90),
    heatStressDays: tMax90.filter(t => Number.isFinite(t) && t > 35).length,
    growingSeasonAvg: mean(t90),
    annualRainfall: sum(series.prectotcorr),
    growingSeasonRainfall: sum(p90),
    rainfallVariability: std(series.prectotcorr),
    drySpells,
  };
}

export interface ApplyOptions {
  latitude: number;
  /** whole-season water need of the current crop (mm); same default as /api/field/analyze */
  cropWaterMm?: number;
}

/** Returns a new Environment with the scenario applied. Returns `env` itself if nothing can change. */
export function applyScenario(env: Environment, sc: Scenario, opts: ApplyOptions): Environment {
  const base = env.rawPower;
  if (!base || (sc.tempDeltaC === 0 && sc.rainFactor === 1)) return env;

  const s = base.series;
  const series: PowerDailySeries = {
    ...s,
    t2m: s.t2m.map(v => v + sc.tempDeltaC),
    t2mMax: s.t2mMax.map(v => v + sc.tempDeltaC),
    t2mMin: s.t2mMin.map(v => v + sc.tempDeltaC),
    prectotcorr: s.prectotcorr.map(v => v * sc.rainFactor),
  };
  const power = resummarize(base, series);
  const baseline = env.extras?.rainBaseline;
  const anomaly = baseline && baseline.expectedMm > 0
    ? ((baseline.windowMm * sc.rainFactor - baseline.expectedMm) / baseline.expectedMm) * 100
    : null;

  return {
    ...env,
    temperature: {
      ...env.temperature,
      current: r1(power.currentTemp),
      currentMax: r1(power.currentTempMax),
      heatStressDays: power.heatStressDays,
      growingSeasonAvg: r1(power.growingSeasonAvg),
    },
    rainfall: deriveRainfall(power, opts.latitude, anomaly),
    soilMoisture: deriveSoilMoisture(power, opts.cropWaterMm ?? 500),
    rawPower: power,
  };
}

function cropWaterFor(inputs: FarmerInputs): number {
  return (inputs.currentCrop ? getCropByName(inputs.currentCrop)?.waterMm : undefined) ?? 500;
}

/** Full engine run under a scenario. */
export function runScenario(inputs: FarmerInputs, env: Environment, sc: Scenario): AnalysisResult {
  const e = applyScenario(env, sc, { latitude: inputs.latitude, cropWaterMm: cropWaterFor(inputs) });
  return analyze(inputs, e);
}

// ── Robustness: which crops stay good across the climate grid? ───────────────
export interface RobustCrop {
  crop: string;
  base: number;
  worst: number;
  mean: number;
  best: number;
  /** best - worst */
  spread: number;
  worstScenario: string;
}

export interface RobustnessResult {
  rows: RobustCrop[]; // sorted by worst-case score (maximin), then mean
  scenarios: number;
}

/**
 * Scores every crop in the library under every scenario in the grid, then ranks
 * by worst-case score. A farmer who cannot absorb a bad year should prefer the
 * crop with the best worst case, not the best average.
 */
export function robustness(
  inputs: FarmerInputs,
  env: Environment,
  grid: Scenario[] = DEFAULT_GRID,
): RobustnessResult {
  const open: FarmerInputs = { ...inputs, desiredCrops: [] }; // empty = whole library
  const water = cropWaterFor(inputs);

  const perCrop = new Map<string, { scores: number[]; labels: string[] }>();
  const baseScores = new Map<string, number>();

  for (const sc of grid) {
    const e = applyScenario(env, sc, { latitude: inputs.latitude, cropWaterMm: water });
    const risks: Risks = computeRisks(e);
    const compat: CropCompatibility[] = computeCropCompatibility(open, e, risks);
    const isBase = sc.tempDeltaC === 0 && sc.rainFactor === 1;
    for (const c of compat) {
      const row = perCrop.get(c.crop) ?? { scores: [], labels: [] };
      row.scores.push(c.overallFit);
      row.labels.push(sc.label ?? `${sc.tempDeltaC}°C / x${sc.rainFactor}`);
      perCrop.set(c.crop, row);
      if (isBase) baseScores.set(c.crop, c.overallFit);
    }
  }

  const rows: RobustCrop[] = [...perCrop.entries()].map(([crop, { scores, labels }]) => {
    const worst = Math.min(...scores);
    const best = Math.max(...scores);
    return {
      crop,
      base: baseScores.get(crop) ?? Math.round(mean(scores)),
      worst,
      mean: Math.round(mean(scores)),
      best,
      spread: best - worst,
      worstScenario: labels[scores.indexOf(worst)],
    };
  });

  rows.sort((a, b) => b.worst - a.worst || b.mean - a.mean);
  return { rows, scenarios: grid.length };
}
