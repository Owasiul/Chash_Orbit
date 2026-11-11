import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyNormals, buildRainBaseline, computeExtremes, buildSoilWetness } from '@/lib/nasa/power-extras';
import { applyScenario, runScenario, robustness, DEFAULT_GRID } from '@/lib/decision/scenario';
import { analyze } from '@/lib/decision/engine';
import { deriveSoilMoisture } from '@/lib/nasa/smap';
import { deriveRainfall } from '@/lib/nasa/gpm';
import { revivePowerSeries } from '@/lib/nasa/revive-power';

describe('Scenario & Power Extras Tests', () => {
  it('correctly calculates monthly normals ignoring YYYY13 and fill values', () => {
    const monthly = {};
    for (let y = 2016; y <= 2025; y++) {
      for (let m = 1; m <= 12; m++) {
        monthly[`${y}${String(m).padStart(2, '0')}`] = m === 7 ? 10 : 1;
      }
      monthly[`${y}13`] = 999;
    }
    monthly['201601'] = -999;
    const norm = monthlyNormals(monthly);
    assert.equal(norm[6], 10);
    assert.equal(norm[0], 1);
  });

  it('builds rainfall baseline correctly and tolerates NaN', () => {
    const norm = Array.from({ length: 12 }, (_, i) => (i === 6 ? 10 : 1));
    const dates = [];
    const prec = [];
    const end = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(`${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`);
      const m = d.getUTCMonth();
      prec.push(m === 6 ? 10 : 1);
    }

    const rbEqual = buildRainBaseline(prec, dates, norm, 10);
    assert.ok(rbEqual);
    assert.ok(Math.abs(rbEqual.anomalyPct) < 0.01);

    const rbWet = buildRainBaseline(prec.map(v => v * 1.5), dates, norm, 10);
    assert.ok(rbWet);
    assert.ok(Math.abs(rbWet.anomalyPct - 50) < 0.01);

    const withNaN = prec.slice();
    withNaN[10] = NaN;
    const rbNaN = buildRainBaseline(withNaN, dates, norm, 10);
    assert.ok(rbNaN);
    assert.ok(Number.isFinite(rbNaN.anomalyPct));
  });

  it('computes climate extremes correctly', () => {
    const ex = computeExtremes([0, 0, 0, 25, 60, 0.5, 0, 0, 0, 0, 3]);
    assert.ok(ex);
    assert.equal(ex.rx5dayMm, 85.5);
    assert.equal(ex.heavyDays20, 2);
    assert.equal(ex.heavyDays50, 1);
    assert.equal(ex.maxConsecutiveDryDays, 5);
  });

  it('calculates soil wetness anomalies', () => {
    const rootDaily = {};
    for (let i = 1; i <= 20; i++) rootDaily[`202610${String(i).padStart(2, '0')}`] = 0.6;
    rootDaily['20261021'] = -999;
    const normRoot = Array.from({ length: 12 }, () => 0.8);
    const sw = buildSoilWetness(rootDaily, { '20261001': 0.3 }, normRoot);
    assert.ok(sw);
    assert.equal(sw.rootNow, 0.6);
    assert.equal(sw.rootAnomalyPct, -25);
  });

  it('simulates temperature and rainfall climate change scenarios smoothly', () => {
    const lat = 24.37;
    const lng = 88.6;
    const dates = [];
    const t2m = [];
    const t2mMax = [];
    const t2mMin = [];
    const rh = [];
    const ws = [];
    const p = [];

    const end = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(end);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
      dates.push(dateStr);
      const m = parseInt(dateStr.slice(4, 6), 10) - 1;
      const t = 25 + 6 * Math.sin(((m - 3) / 12) * 2 * Math.PI);
      t2m.push(t);
      t2mMax.push(t + 6);
      t2mMin.push(t - 5);
      rh.push(70);
      ws.push(2);
      p.push(m >= 5 && m <= 8 ? 9 : (i % 9 === 0 ? 4 : 0.2));
    }

    const series = { dates, t2m, t2mMax, t2mMin, prectotcorr: p, rh2m: rh, ws10m: ws };
    const n = dates.length;
    const f90 = n - 90;
    const sum = (a) => a.reduce((s, x) => s + x, 0);
    const mean = (a) => sum(a) / a.length;

    const power = {
      series,
      currentTemp: mean(t2m.slice(f90)),
      currentTempMax: mean(t2mMax.slice(f90)),
      heatStressDays: t2mMax.slice(f90).filter(x => x > 35).length,
      growingSeasonAvg: mean(t2m.slice(f90)),
      annualRainfall: sum(p),
      growingSeasonRainfall: sum(p.slice(f90)),
      rainfallVariability: 3,
      drySpells: 5,
      tenYearTempTrend: 0.03,
      tenYearRainfallTrend: -2,
      source: 'live',
      attribution: 'test',
    };

    const env = {
      temperature: {
        current: power.currentTemp,
        currentMax: power.currentTempMax,
        heatStressDays: power.heatStressDays,
        growingSeasonAvg: power.growingSeasonAvg,
        tenYearTrend: 0.03,
        source: 'live',
        attribution: 'test',
      },
      rainfall: deriveRainfall(power, lat),
      soilMoisture: deriveSoilMoisture(power, 1100),
      vegetation: { ndvi: 0.45, health: 'good', seasonalPattern: [], recentTrend: 0, source: 'live', attribution: 'test' },
      overallSource: 'live',
      overallAttribution: 'test',
      rawPower: power,
    };

    const inputs = {
      latitude: lat,
      longitude: lng,
      currentCrop: 'Rice',
      desiredCrops: ['Rice', 'Wheat', 'Mustard', 'Mung', 'Maize', 'Lentil'],
      irrigation: 'limited',
      soilType: 'loamy',
      priorities: { soil: 25, water: 25, climate: 25, income: 25 },
    };

    const base = analyze(inputs, env);
    const same = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 1 });
    assert.deepEqual(same.recommendations, base.recommendations);

    const hot = applyScenario(env, { tempDeltaC: 3, rainFactor: 1 }, { latitude: lat, cropWaterMm: 1100 });
    assert.ok(Math.abs(hot.temperature.growingSeasonAvg - env.temperature.growingSeasonAvg - 3) < 0.11);
    assert.ok(hot.temperature.heatStressDays >= env.temperature.heatStressDays);

    const dry = applyScenario(env, { tempDeltaC: 0, rainFactor: 0.6 }, { latitude: lat, cropWaterMm: 1100 });
    assert.ok(Math.abs(dry.rainfall.annualRainfall / env.rainfall.annualRainfall - 0.6) < 0.01);
    assert.ok(dry.soilMoisture.seasonalDeficit >= env.soilMoisture.seasonalDeficit);

    const stress = runScenario(inputs, env, { tempDeltaC: 3, rainFactor: 0.6 });
    assert.ok(stress.risks.droughtRisk >= base.risks.droughtRisk);

    const r10 = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 0.9 }).risks.floodRisk;
    const r20 = runScenario(inputs, env, { tempDeltaC: 0, rainFactor: 0.8 }).risks.floodRisk;
    assert.ok(base.risks.floodRisk > r10 && r10 > r20);

    const rob = robustness(inputs, env);
    assert.equal(rob.scenarios, DEFAULT_GRID.length);
    assert.ok(rob.rows.length >= 10);
    const isSorted = rob.rows.every((r, idx, arr) => idx === 0 || arr[idx - 1].worst >= r.worst);
    assert.ok(isSorted);
  });
});
