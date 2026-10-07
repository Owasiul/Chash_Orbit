// Chash Orbit — GPM IMERG rainfall service
// Live GPM IMERG is delivered through NASA GES DISC and requires Earthdata
// authentication. NASA POWER's PRECTOTCORR (corrected precipitation) is itself
// partly informed by GPM IMERG. We therefore use POWER-derived rainfall and
// attribute it transparently, plus compute the IMERG-style statistics the
// field profile requires (anomaly, variability, dry spells).

import type { PowerAnalysis } from './power';

export interface RainfallAnalysis {
  annualRainfall: number;
  growingSeasonRainfall: number;
  // anomaly vs a notional climatology mean (mm/year) — expressed as a percent
  anomalyPct: number;
  variability: number;          // std-dev mm/day
  drySpells: number;           // consecutive dry spell count (>=3d <1mm)
  seasonalPattern: { month: string; mm: number }[];
  recentTrend: number;          // mm/year slope (last 10y via POWER monthly)
  source: 'live' | 'cached' | 'demo';
  attribution: string;
}

function monthlyTotals(series: PowerAnalysis['series']): { month: string; mm: number }[] {
  const buckets: Record<string, number> = {};
  for (let i = 0; i < series.dates.length; i++) {
    const k = series.dates[i];
    const m = k.slice(4, 6); // MM
    const v = series.prectotcorr[i] || 0;
    if (!Number.isNaN(v)) buckets[m] = (buckets[m] || 0) + v;
  }
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return monthNames.map((name, idx) => {
    const mm = String(idx + 1).padStart(2, '0');
    return { month: name, mm: Math.round((buckets[mm] || 0) * 10) / 10 };
  });
}

// Climatological baseline by latitude band (annual mm). These are approximate
// zonal means used only to compute an "anomaly" indicator for the demo.
function climatologyBaseline(lat: number): number {
  const a = Math.abs(lat);
  if (a < 10) return 1800;       // equatorial
  if (a < 20) return 1400;       // tropical wet/dry
  if (a < 30) return 1000;       // subtropical monsoon
  if (a < 40) return 700;        // subtropical semi-arid / temperate
  if (a < 50) return 600;        // temperate
  return 450;                    // boreal / cold
}

export function deriveRainfall(power: PowerAnalysis, lat: number): RainfallAnalysis {
  if (Number.isNaN(power.annualRainfall)) {
    return {
      annualRainfall: 0,
      growingSeasonRainfall: 0,
      anomalyPct: 0,
      variability: 0,
      drySpells: 0,
      seasonalPattern: monthlyTotals(power.series),
      recentTrend: 0,
      source: 'demo',
      attribution: 'Demo estimate (NASA POWER unreachable).',
    };
  }

  const base = climatologyBaseline(lat);
  const anomalyPct = Math.round(((power.annualRainfall - base) / base) * 100);

  return {
    annualRainfall: Math.round(power.annualRainfall * 10) / 10,
    growingSeasonRainfall: Math.round(power.growingSeasonRainfall * 10) / 10,
    anomalyPct,
    variability: Math.round(power.rainfallVariability * 100) / 100,
    drySpells: power.drySpells,
    seasonalPattern: monthlyTotals(power.series),
    recentTrend: Math.round(power.tenYearRainfallTrend * 10) / 10,
    // propagate cache state so the badge honestly shows CACHED when served
    // from cache, LIVE when freshly fetched, DEMO when POWER failed.
    source: power.source === 'demo' ? 'demo' : (power.source === 'cached' ? 'cached' : 'live'),
    attribution:
      'NASA POWER PRECTOTCORR (GPM-corrected precipitation). GPM IMERG late-run data feeds the POWER corrected-precipitation product.',
  };
}
