// Field Shift — Vegetation (NDVI) service
// NASA MODIS/VIIRS NDVI products (MOD13/VNP13) are delivered via AppEEARS / LP
// DAAC and require Earthdata authentication. Without authenticated access, we
// derive a vegetation index estimate from NASA POWER climatology + a seasonal
// NDVI model. The source is clearly labeled "derived", never "live MODIS".

import type { PowerAnalysis } from './power';

export interface VegetationAnalysis {
  ndvi: number;                 // 0..1 (estimated)
  health: 'poor' | 'moderate' | 'good' | 'vigorous';
  seasonalPattern: { month: string; ndvi: number }[];
  recentTrend: number;          // per-year slope (illustrative)
  source: 'derived' | 'demo';
  attribution: string;
}

// Seasonal NDVI model. NDVI rises with summer warmth and rainfall, dips in
// cold or dry months. We approximate monthly NDVI from rainfall + temperature
// normals and clamp to [0.05, 0.85].
function seasonalModel(power: PowerAnalysis): { month: string; ndvi: number }[] {
  const s = power.series;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const byMonth: Record<string, { p: number; t: number; c: number }> = {};
  for (let i = 0; i < s.dates.length; i++) {
    const m = s.dates[i].slice(4, 6);
    const p = s.prectotcorr[i];
    const t = s.t2m[i];
    byMonth[m] ||= { p: 0, t: 0, c: 0 };
    if (!Number.isNaN(p)) byMonth[m].p += p;
    if (!Number.isNaN(t)) { byMonth[m].t += t; byMonth[m].c++; }
  }
  return monthNames.map((name, idx) => {
    const mm = String(idx + 1).padStart(2, '0');
    const b = byMonth[mm] || { p: 0, t: 0, c: 0 };
    const tAvg = b.c ? b.t / b.c : 20;
    // rainfall term: 100mm/month -> ~+0.25 NDVI
    // temperature term: 25°C optimal, drops at <10 or >35
    const rainTerm = Math.min(0.3, b.p / 400);
    const tTerm = Math.max(0, 1 - Math.abs(tAvg - 25) / 25);
    let ndvi = 0.15 + rainTerm + 0.4 * tTerm;
    ndvi = Math.max(0.05, Math.min(0.85, ndvi));
    return { month: name, ndvi: Math.round(ndvi * 100) / 100 };
  });
}

export function deriveVegetation(power: PowerAnalysis, lat: number): VegetationAnalysis {
  if (Number.isNaN(power.annualRainfall)) {
    return {
      ndvi: 0.3,
      health: 'moderate',
      seasonalPattern: seasonalModel(power),
      recentTrend: 0,
      source: 'demo',
      attribution: 'Demo estimate (NASA POWER unreachable).',
    };
  }
  const pattern = seasonalModel(power);
  const recent = pattern[pattern.length - 1]?.ndvi ?? 0.3;
  const health: VegetationAnalysis['health'] =
    recent >= 0.65 ? 'vigorous'
      : recent >= 0.45 ? 'good'
        : recent >= 0.25 ? 'moderate' : 'poor';

  // Recent trend: tie to rainfall trend (positive rainfall -> rising NDVI)
  const recentTrend = Math.round(power.tenYearRainfallTrend * 0.001 * 1000) / 1000;

  return {
    ndvi: recent,
    health,
    seasonalPattern: pattern,
    recentTrend,
    source: 'derived',
    attribution:
      'Derived estimate from NASA POWER precipitation and temperature climatology. Live NASA MODIS/VIIRS NDVI requires authenticated AppEEARS/LP DAAC access.',
  };
}
