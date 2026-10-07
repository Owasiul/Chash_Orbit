// Chash Orbit — Soil moisture service
// NASA SMAP data is delivered via NSIDC / AppEEARS, which require Earthdata
// authentication and are not available as a simple unauthenticated REST endpoint
// for live demos. This module therefore derives a soil-moisture estimate from
// NASA POWER precipitation + a simple water-balance model, and clearly labels
// the source as "derived" rather than claiming live SMAP.

import type { PowerAnalysis } from './power';

export interface SoilMoistureAnalysis {
  // current surface soil moisture, mm (equivalent water depth in top ~5cm)
  currentMm: number;
  // percentage of a notional field capacity (0..100)
  currentPct: number;
  // seasonal deficit (mm) — shortfall vs crop demand over last 90 days
  seasonalDeficit: number;
  // 10-year trend in moisture (% per year) — derived from rainfall trend
  tenYearTrend: number;
  // label: "derived" | "demo"
  source: 'derived' | 'demo';
  attribution: string;
}

// Simple monthly water-balance model. Bucket capacity ~150mm (representing the
// top ~1m root-zone store). Daily ET estimated from temperature via a modified
// Hargreaves expression; precipitation adds to the bucket; ET removes from it.
function waterBalance(prec: number[], t2m: number[], capacity = 150): number[] {
  const store: number[] = [];
  let bucket = capacity * 0.5; // start half-full
  for (let i = 0; i < prec.length; i++) {
    const p = prec[i] || 0;
    const t = t2m[i];
    // Hargreaves-ish PET (mm/day) with a sanity clamp
    const pet = Number.isNaN(t) ? 2 : Math.max(0.5, Math.min(10, 0.0023 * (t + 17.8) * Math.sqrt(Math.max(0, t - 5))));
    bucket = Math.max(0, Math.min(capacity, bucket + p - pet));
    store.push(bucket);
  }
  return store;
}

export function deriveSoilMoisture(
  power: PowerAnalysis,
  cropWaterMm: number,
): SoilMoistureAnalysis {
  // If POWER failed and produced NaNs, fall through to a demo value.
  if (Number.isNaN(power.annualRainfall)) {
    return {
      currentMm: 0,
      currentPct: 0,
      seasonalDeficit: 0,
      tenYearTrend: 0,
      source: 'demo',
      attribution: 'Demo estimate (NASA POWER unreachable).',
    };
  }

  const s = power.series;
  const n = s.dates.length;
  const recent90 = Math.max(0, n - 90);
  const store = waterBalance(s.prectotcorr, s.t2m);
  const recent90Store = store.slice(recent90);
  const currentMm = recent90Store.length
    ? recent90Store[recent90Store.length - 1]
    : 0;
  const currentPct = Math.max(0, Math.min(100, (currentMm / 150) * 100));

  // Seasonal deficit = (crop water need over 90 days) - (actual rainfall over 90d)
  const cropNeed90 = (cropWaterMm / 30) * 90; // approx mm per 90 days
  const actual90 = power.growingSeasonRainfall;
  const seasonalDeficit = Math.max(0, cropNeed90 - actual90);

  // Trend: scale POWER's rainfall trend into a moisture trend (%/year)
  // Assume 1mm/year rainfall change ≈ 0.5% moisture change (illustrative).
  const tenYearTrend = power.tenYearRainfallTrend * 0.05;

  return {
    currentMm: Math.round(currentMm * 10) / 10,
    currentPct: Math.round(currentPct * 10) / 10,
    seasonalDeficit: Math.round(seasonalDeficit * 10) / 10,
    tenYearTrend: Math.round(tenYearTrend * 1000) / 1000,
    source: 'derived',
    attribution:
      'Derived estimate from NASA POWER precipitation + a water-balance model. Live NASA SMAP data requires authenticated NSIDC/AppEEARS access.',
  };
}

// Soil texture inference — never claims NASA direct measurement; derived from
// regional/climatic signals when farmer selects "I don't know".
export interface SoilCondition {
  texture: 'sandy' | 'loamy' | 'clay' | 'unknown';
  organicMatter: 'low' | 'medium' | 'high';
  moistureCondition: 'deficit' | 'adequate' | 'surplus';
  nitrogenBalance: 'depleting' | 'stable' | 'building';
  erosionRisk: 'low' | 'medium' | 'high';
  waterRetention: 'low' | 'medium' | 'high';
  source: 'derived' | 'demo';
  attribution: string;
}

export function deriveSoilCondition(
  soilType: 'sandy' | 'loamy' | 'clay' | 'unknown',
  power: PowerAnalysis,
  sm: SoilMoistureAnalysis,
  ndvi: number,
  currentCropIsLegume: boolean,
): SoilCondition {
  const texture = soilType === 'unknown' ? 'loamy' : soilType;
  // Erosion risk — high if heavy rain variability + sandy + low vegetation
  let erosionRisk: SoilCondition['erosionRisk'] = 'low';
  if (power.rainfallVariability > 8 && (texture === 'sandy' || ndvi < 0.3)) erosionRisk = 'high';
  else if (power.rainfallVariability > 4 || texture === 'sandy') erosionRisk = 'medium';

  // Water retention
  const waterRetention: SoilCondition['waterRetention'] =
    texture === 'clay' ? 'high' : texture === 'loamy' ? 'medium' : 'low';

  // Organic matter estimate from NDVI + texture
  const organicMatter: SoilCondition['organicMatter'] =
    ndvi > 0.5 ? 'high' : ndvi > 0.3 ? 'medium' : 'low';

  // Moisture condition from soil moisture pct
  const moistureCondition: SoilCondition['moistureCondition'] =
    sm.currentPct < 30 ? 'deficit' : sm.currentPct > 70 ? 'surplus' : 'adequate';

  // Nitrogen balance — legumes build N, cereals deplete
  const nitrogenBalance: SoilCondition['nitrogenBalance'] = currentCropIsLegume
    ? 'building'
    : 'depleting';

  return {
    texture,
    organicMatter,
    moistureCondition,
    nitrogenBalance,
    erosionRisk,
    waterRetention,
    source: 'derived',
    attribution:
      'Derived from regional signals, NASA POWER rainfall patterns, vegetation index, and farmer-reported soil texture. NOT direct NASA measurement.',
  };
}
