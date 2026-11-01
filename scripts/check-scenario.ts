// Behavioural check for power-extras + scenario engine. Run: npx tsx scripts/check-scenario.ts
// Uses a synthetic year (no network). Exits 1 on failure.
import { monthlyNormals, buildRainBaseline, computeExtremes, buildSoilWetness } from '@/lib/nasa/power-extras';
import { applyScenario, runScenario, robustness, DEFAULT_GRID } from '@/lib/decision/scenario';
import { analyze } from '@/lib/decision/engine';
import { deriveSoilMoisture } from '@/lib/nasa/smap';
import { deriveRainfall } from '@/lib/nasa/gpm';
import type { PowerAnalysis } from '@/lib/nasa/power';
import type { Environment } from '@/lib/nasa/environment';
import { revivePowerSeries } from '@/lib/nasa/revive-power';

let fails = 0;
const eq = (name: string, cond: boolean, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!cond) fails++; };

// ── power-extras pure helpers ───────────────────────────────────────────────
const monthly: Record<string, number | null> = {};
for (let y = 2016; y <= 2025; y++) {
  for (let m = 1; m <= 12; m++) monthly[`${y}${String(m).padStart(2, '0')}`] = m === 7 ? 10 : 1; // mm/day
  monthly[`${y}13`] = 999; // annual key must be ignored
}
monthly['201601'] = -999; // fill value must be ignored
const norm = monthlyNormals(monthly);
eq('monthlyNormals ignores YYYY13', norm[6] === 10 && norm[0] === 1, JSON.stringify([norm[0], norm[6]]));

// synthetic 365 daily series ending today
const dates: string[] = []; const prec: number[] = [];
const end = new Date();
for (let i = 364; i >= 0; i--) {
  const d = new Date(end); d.setUTCDate(d.getUTCDate() - i);
  dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
  const m = d.getUTCMonth();
  prec.push(m === 6 ? 10 : 1); // exactly the normal
}
const rbEqual = buildRainBaseline(prec, dates, norm, 10)!;
eq('baseline anomaly ~0 when observed == normal', Math.abs(rbEqual.anomalyPct!) < 0.01, `anomaly=${rbEqual.anomalyPct}`);
const rbWet = buildRainBaseline(prec.map(v => v * 1.5), dates, norm, 10)!;
eq('baseline anomaly +50 when 1.5x normal', Math.abs(rbWet.anomalyPct! - 50) < 0.01, `anomaly=${rbWet.anomalyPct}`);
const withNaN = prec.slice(); withNaN[10] = NaN;
eq('baseline tolerates NaN', Number.isFinite(buildRainBaseline(withNaN, dates, norm, 10)!.anomalyPct!));

const ex = computeExtremes([0, 0, 0, 25, 60, 0.5, 0, 0, 0, 0, 3]);
eq('extremes: rx5 / heavy / cdd', ex!.rx5dayMm === 85.5 && ex!.heavyDays20 === 2 && ex!.heavyDays50 === 1 && ex!.maxConsecutiveDryDays === 5, JSON.stringify(ex));

const rootDaily: Record<string, number | null> = {};
for (let i = 1; i <= 20; i++) rootDaily[`202610${String(i).padStart(2, '0')}`] = 0.6;
rootDaily['20261021'] = -999;
const normRoot = Array.from({ length: 12 }, () => 0.8 as number | null);
const sw = buildSoilWetness(rootDaily, { '20261001': 0.3 }, normRoot)!;
eq('soil wetness anomaly -25%', sw.rootNow === 0.6 && sw.rootAnomalyPct === -25, JSON.stringify({ n: sw.rootNow, a: sw.rootAnomalyPct }));

// ── scenario engine on a synthetic Rajshahi-like year ───────────────────────
const lat = 24.37, lng = 88.6;
const t2m: number[] = [], t2mMax: number[] = [], t2mMin: number[] = [], rh: number[] = [], ws: number[] = [], p: number[] = [];
dates.forEach((d, i) => {
  const m = parseInt(d.slice(4, 6), 10) - 1;
  const t = 25 + 6 * Math.sin(((m - 3) / 12) * 2 * Math.PI);
  t2m.push(t); t2mMax.push(t + 6); t2mMin.push(t - 5); rh.push(70); ws.push(2);
  p.push(m >= 5 && m <= 8 ? 9 : (i % 9 === 0 ? 4 : 0.2));
});
const series = { dates, t2m, t2mMax, t2mMin, prectotcorr: p, rh2m: rh, ws10m: ws };
const n = dates.length, f90 = n - 90;
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0), mean = (a: number[]) => sum(a) / a.length;
const power: PowerAnalysis = {
  series, currentTemp: mean(t2m.slice(f90)), currentTempMax: mean(t2mMax.slice(f90)),
  heatStressDays: t2mMax.slice(f90).filter(x => x > 35).length, growingSeasonAvg: mean(t2m.slice(f90)),
  annualRainfall: sum(p), growingSeasonRainfall: sum(p.slice(f90)), rainfallVariability: 3, drySpells: 5,
  tenYearTempTrend: 0.03, tenYearRainfallTrend: -2, source: 'live', attribution: 'test',
};
const env: Environment = {
  temperature: { current: power.currentTemp, currentMax: power.currentTempMax, heatStressDays: power.heatStressDays, growingSeasonAvg: power.growingSeasonAvg, tenYearTrend: 0.03, source: 'live', attribution: 'x' },
  rainfall: deriveRainfall(power, lat), soilMoisture: deriveSoilMoisture(power, 1100),
  vegetation: { ndvi: 0.45, health: 'good', seasonalPattern: [], recentTrend: 0, source: 'live', attribution: 'x' }, overallSource: 'live', overallAttribution: 'x', rawPower: power,
};
const inputs = {
  latitude: lat, longitude: lng, currentCrop: 'Rice', desiredCrops: ['Rice', 'Wheat', 'Mustard', 'Mung', 'Maize', 'Lentil'],
  irrigation: 'limited' as const, soilType: 'loamy' as const, priorities: { soil: 25, water: 25, climate: 25, income: 25 },
};

const missingPower: PowerAnalysis = { ...power, series: { ...series, t2m: [...t2m], t2mMax: [...t2mMax], prectotcorr: [...p] } };
missingPower.series.t2m[10] = NaN;
missingPower.series.t2mMax[10] = NaN;
missingPower.series.prectotcorr[10] = NaN;
const restored = revivePowerSeries(JSON.parse(JSON.stringify(missingPower)));
eq('JSON missing daily observations are restored to NaN', Number.isNaN(restored.series.t2m[10]) && Number.isNaN(restored.series.t2mMax[10]) && Number.isNaN(restored.series.prectotcorr[10]));
const shiftedMissing = applyScenario({ ...env, rawPower: restored }, { tempDeltaC: 1, rainFactor: 0.8 }, { latitude: lat });
eq('scenario preserves missing daily observations', Number.isNaN(shiftedMissing.rawPower!.series.t2m[10]) && Number.isNaN(shiftedMissing.rawPower!.series.prectotcorr[10]));

const base = analyze(inputs, env);
const same = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 1 });
eq('scenario 0/1 equals baseline exactly', JSON.stringify(same.recommendations) === JSON.stringify(base.recommendations));

const hot = applyScenario(env, { tempDeltaC: 3, rainFactor: 1 }, { latitude: lat, cropWaterMm: 1100 });
eq('+3C raises mean temp by 3', Math.abs(hot.temperature.growingSeasonAvg - env.temperature.growingSeasonAvg - 3) < 0.11, `${env.temperature.growingSeasonAvg} -> ${hot.temperature.growingSeasonAvg}`);
eq('+3C does not reduce heat-stress days', hot.temperature.heatStressDays >= env.temperature.heatStressDays, `${env.temperature.heatStressDays} -> ${hot.temperature.heatStressDays}`);
const dry = applyScenario(env, { tempDeltaC: 0, rainFactor: 0.6 }, { latitude: lat, cropWaterMm: 1100 });
eq('-40% rain: annual rainfall x0.6', Math.abs(dry.rainfall.annualRainfall / env.rainfall.annualRainfall - 0.6) < 0.01);
eq('-40% rain: seasonal deficit not lower', dry.soilMoisture.seasonalDeficit >= env.soilMoisture.seasonalDeficit, `${env.soilMoisture.seasonalDeficit} -> ${dry.soilMoisture.seasonalDeficit}`);
eq('original env is not mutated', env.rawPower!.series.prectotcorr[200] === p[200] && env.temperature.heatStressDays === power.heatStressDays);

const stress = runScenario(inputs, env, { tempDeltaC: 3, rainFactor: 0.6 });
console.log('\nBASE   top3:', base.recommendations.slice(0, 3).map(r => `${r.crop} ${r.score}`).join(' | '), ' risks', JSON.stringify([base.risks.heatRisk, base.risks.droughtRisk, base.risks.floodRisk]));
console.log('STRESS top3:', stress.recommendations.slice(0, 3).map(r => `${r.crop} ${r.score}`).join(' | '), ' risks', JSON.stringify([stress.risks.heatRisk, stress.risks.droughtRisk, stress.risks.floodRisk]));
eq('stress drought risk >= base', stress.risks.droughtRisk >= base.risks.droughtRisk);
const r10 = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 0.9 }).risks.floodRisk;
const r20 = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 0.8 }).risks.floodRisk;
eq('smooth: flood risk differs at -10% and -20% rain (no cliffs)', base.risks.floodRisk > r10 && r10 > r20, JSON.stringify([base.risks.floodRisk, r10, r20]));

const rob = robustness(inputs, env);
const sorted = rob.rows.every((r, i, a) => i === 0 || a[i - 1].worst >= r.worst);
eq(`robustness: ${rob.rows.length} crops x ${rob.scenarios} scenarios, sorted by worst case`, sorted && rob.scenarios === DEFAULT_GRID.length && rob.rows.length >= 10);
console.log('ROBUST top4:', rob.rows.slice(0, 4).map(r => `${r.crop} base ${r.base} worst ${r.worst} (${r.worstScenario})`).join('\n            '));
console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED');
process.exit(fails ? 1 : 0);
