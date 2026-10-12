// Crop-aligned climatology from NASA POWER daily series (365-day window).
// Aggregates temperature and rainfall by calendar month so the decision engine
// can compare crops to NASA signals during their actual growing season — not
// whatever the last 90 days happened to be.

import type { PowerDailySeries } from './power';

export interface MonthClimatology {
  /** Calendar month 1–12 */
  month: number;
  tempAvgC: number;
  rainMm: number;
  heatStressDays: number;
  sampleDays: number;
}

export function buildMonthlyClimatology(series: PowerDailySeries): MonthClimatology[] {
  const buckets = new Map<
    number,
    { tSum: number; rSum: number; heat: number; n: number }
  >();

  for (let i = 0; i < series.dates.length; i++) {
    const month = parseInt(series.dates[i]!.slice(4, 6), 10);
    const t = series.t2m[i];
    const tMax = series.t2mMax[i];
    const r = series.prectotcorr[i];
    if (Number.isNaN(t) && Number.isNaN(r)) continue;

    const b = buckets.get(month) ?? { tSum: 0, rSum: 0, heat: 0, n: 0 };
    if (!Number.isNaN(t)) {
      b.tSum += t;
      b.n += 1;
    }
    if (!Number.isNaN(r)) b.rSum += r;
    if (!Number.isNaN(tMax) && tMax > 35) b.heat += 1;
    buckets.set(month, b);
  }

  const out: MonthClimatology[] = [];
  for (let m = 1; m <= 12; m++) {
    const b = buckets.get(m);
    if (!b || b.n === 0) {
      out.push({ month: m, tempAvgC: NaN, rainMm: 0, heatStressDays: 0, sampleDays: 0 });
      continue;
    }
    out.push({
      month: m,
      tempAvgC: b.tSum / b.n,
      rainMm: b.rSum,
      heatStressDays: b.heat,
      sampleDays: b.n,
    });
  }
  return out;
}

/** Mean temperature and total rainfall across the given calendar months. */
export function aggregateMonths(
  climatology: MonthClimatology[],
  months: number[],
): { tempAvgC: number; rainMm: number; heatStressDays: number; monthsUsed: number } {
  const set = new Set(months);
  let tSum = 0;
  let tN = 0;
  let rain = 0;
  let heat = 0;
  let used = 0;
  for (const row of climatology) {
    if (!set.has(row.month) || row.sampleDays === 0) continue;
    used += 1;
    if (!Number.isNaN(row.tempAvgC)) {
      tSum += row.tempAvgC;
      tN += 1;
    }
    rain += row.rainMm;
    heat += row.heatStressDays;
  }
  return {
    tempAvgC: tN > 0 ? tSum / tN : NaN,
    rainMm: rain,
    heatStressDays: heat,
    monthsUsed: used,
  };
}
