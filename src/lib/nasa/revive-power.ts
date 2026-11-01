import type { PowerAnalysis } from './power';

/** JSON encodes missing (NaN) daily values as null. Restore them before analysis. */
export function revivePowerSeries(power: PowerAnalysis): PowerAnalysis {
  const fix = (values: (number | null)[]) => values.map(v => v == null ? NaN : v);
  const s = power.series;
  return {
    ...power,
    series: {
      ...s,
      t2m: fix(s.t2m),
      t2mMax: fix(s.t2mMax),
      t2mMin: fix(s.t2mMin),
      prectotcorr: fix(s.prectotcorr),
      rh2m: fix(s.rh2m),
      ws10m: fix(s.ws10m),
    },
  };
}
