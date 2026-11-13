// Tests for the new GPM IMERG + FAO-56 water balance module
// Tests pure functions only (no network calls).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  referenceEt0,
  calculateReferenceET0,
  kcForDay,
  EXAMPLE_RICE_CURVE,
  relativeYieldFromWater,
  runWaterBalance,
  extractDailyWeather,
  latestWetnessPct,
  compareRainfallSources,
} from '@/lib/nasa/gpm-imerg';

// ─── ET0 tests ──────────────────────────────────────────────────────────────

describe('referenceEt0 — FAO-56 Penman-Monteith', () => {
  it('returns null for NaN temperature', () => {
    const result = referenceEt0({ tMean: NaN, latDeg: 25, doy: 180 });
    assert.equal(result, null);
  });

  it('returns null for POWER fill value temperature (-999)', () => {
    const result = referenceEt0({ tMean: -999, latDeg: 25, doy: 180 });
    assert.equal(result, null);
  });

  it('computes a reasonable ET0 with full inputs (tropical, mid-year)', () => {
    const result = referenceEt0({
      tMean: 28,
      tMax: 33,
      tMin: 23,
      rhPct: 70,
      windMs2m: 2.0,
      solarMjM2: 22,
      latDeg: 23.8,
      doy: 180,
    });
    assert.notEqual(result, null);
    assert.equal(result.method, 'fao56-pm');
    // Tropical mid-year ET0 should be roughly 4-7 mm/day
    assert.ok(result.et0 >= 3 && result.et0 <= 8, `ET0 ${result.et0} out of expected range 3-8`);
  });

  it('computes ET0 with estimated Rs when solar is missing but range exists', () => {
    const result = referenceEt0({
      tMean: 25,
      tMax: 30,
      tMin: 20,
      latDeg: 35,
      doy: 200,
    });
    assert.notEqual(result, null);
    assert.equal(result.method, 'fao56-pm-estimated-rs');
    assert.ok(result.et0 > 0 && result.et0 < 12, `ET0 ${result.et0} out of range`);
  });

  it('falls back to temperature-only when only tMean is available', () => {
    const result = referenceEt0({
      tMean: 20,
      latDeg: 45,
      doy: 100,
    });
    assert.notEqual(result, null);
    assert.equal(result.method, 'temperature-only');
    assert.ok(result.et0 > 0 && result.et0 < 12, `ET0 ${result.et0} out of range`);
  });

  it('clamps ET0 to 0-12 range', () => {
    // Very hot, sunny, windy day
    const result = referenceEt0({
      tMean: 40,
      tMax: 48,
      tMin: 32,
      rhPct: 10,
      windMs2m: 8,
      solarMjM2: 30,
      latDeg: 30,
      doy: 180,
    });
    assert.notEqual(result, null);
    assert.ok(result.et0 <= 12, `ET0 ${result.et0} exceeds max clamp of 12`);
    assert.ok(result.et0 >= 0, `ET0 ${result.et0} below 0`);
  });

  it('handles polar latitudes without NaN', () => {
    const result = referenceEt0({
      tMean: 5,
      tMax: 10,
      tMin: 0,
      latDeg: 65,
      doy: 180,
    });
    assert.notEqual(result, null);
    assert.ok(Number.isFinite(result.et0), `ET0 should be finite, got ${result.et0}`);
  });
});

describe('calculateReferenceET0 — backward compatibility', () => {
  it('returns a number for valid inputs', () => {
    const et0 = calculateReferenceET0(25, 30, 20, 18, 30, 180);
    assert.ok(Number.isFinite(et0), `Expected finite, got ${et0}`);
    assert.ok(et0 > 0, `Expected positive, got ${et0}`);
  });

  it('returns NaN (not 3.0) for completely invalid inputs', () => {
    const et0 = calculateReferenceET0(NaN, null, null, null, 30, 180);
    assert.ok(Number.isNaN(et0), `Expected NaN, got ${et0}`);
  });

  it('accepts the optional extras argument', () => {
    const et0 = calculateReferenceET0(28, 33, 23, 20, 23, 180, {
      rhPct: 70,
      windMs2m: 2.5,
      elevationM: 100,
    });
    assert.ok(Number.isFinite(et0), `Expected finite, got ${et0}`);
    assert.ok(et0 > 0 && et0 < 12, `ET0 ${et0} out of expected range`);
  });
});

// ─── Kc curve tests ─────────────────────────────────────────────────────────

describe('kcForDay — stage-based crop coefficient', () => {
  const curve = EXAMPLE_RICE_CURVE;

  it('returns kcIni during the initial stage', () => {
    assert.equal(kcForDay(curve, 0), curve.kcIni);
    assert.equal(kcForDay(curve, 15), curve.kcIni);
    assert.equal(kcForDay(curve, 29), curve.kcIni);
  });

  it('interpolates linearly during development', () => {
    const midDev = curve.lIni + curve.lDev / 2; // day 45
    const kc = kcForDay(curve, midDev);
    assert.ok(kc > curve.kcIni && kc < curve.kcMid, `Kc ${kc} should be between kcIni and kcMid`);
  });

  it('returns kcMid during mid-season', () => {
    const midSeason = curve.lIni + curve.lDev + 1; // day 61
    assert.equal(kcForDay(curve, midSeason), curve.kcMid);
  });

  it('returns kcEnd after the late stage', () => {
    const afterEnd = curve.lIni + curve.lDev + curve.lMid + curve.lLate + 10;
    assert.equal(kcForDay(curve, afterEnd), curve.kcEnd);
  });
});

// ─── Yield response ─────────────────────────────────────────────────────────

describe('relativeYieldFromWater — FAO-33', () => {
  it('returns 1.0 when ETa equals ETc', () => {
    assert.equal(relativeYieldFromWater(100, 100, 1.0), 1.0);
  });

  it('returns reduced yield when ETa < ETc', () => {
    const result = relativeYieldFromWater(60, 100, 1.0);
    assert.ok(result !== null);
    assert.ok(result < 1 && result > 0, `Expected 0 < ${result} < 1`);
    // Ya/Ym = 1 - 1.0*(1 - 0.6) = 0.6
    assert.ok(Math.abs(result - 0.6) < 0.01, `Expected ~0.6, got ${result}`);
  });

  it('returns null when ETc is 0', () => {
    assert.equal(relativeYieldFromWater(50, 0, 1.0), null);
  });

  it('clamps result between 0 and 1', () => {
    // With Ky = 2 and ETa = 0, result would be 1 - 2*(1) = -1, clamp to 0
    const result = relativeYieldFromWater(0, 100, 2.0);
    assert.equal(result, 0);
  });
});

// ─── Water balance model ────────────────────────────────────────────────────

describe('runWaterBalance — FAO-56 root-zone model', () => {
  // Build a synthetic 30-day weather series
  function makeSyntheticWeather(days = 30) {
    const dates = [];
    const precipMm = [];
    const tMean = [];
    const tMax = [];
    const tMin = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(2025, 5, 1 + i)); // June 2025
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      dates.push(`${d.getUTCFullYear()}${mm}${dd}`);
      // Alternating rain: 5mm every 3rd day, 0 otherwise
      precipMm.push(i % 3 === 0 ? 5 : 0);
      tMean.push(28);
      tMax.push(33);
      tMin.push(23);
    }

    return { dates, precipMm, tMean, tMax, tMin };
  }

  it('produces output arrays with the same length as analysisDays', () => {
    const weather = makeSyntheticWeather(60);
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });
    assert.equal(result.dates.length, 30);
    assert.equal(result.availableMm.length, 30);
    assert.equal(result.et0.length, 30);
    assert.equal(result.etc.length, 30);
    assert.equal(result.eta.length, 30);
    assert.equal(result.runoff.length, 30);
    assert.equal(result.drainage.length, 30);
    assert.equal(result.ks.length, 30);
  });

  it('uses spin-up period (early data is not in the output window)', () => {
    const weather = makeSyntheticWeather(60);
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });
    assert.equal(result.spinUpDays, 30); // 60 total - 30 analysis = 30 spin-up
  });

  it('mass balance error is approximately zero', () => {
    const weather = makeSyntheticWeather(60);
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });
    assert.ok(
      Math.abs(result.massBalanceErrorMm) < 0.1,
      `Mass balance error ${result.massBalanceErrorMm} should be ~0`
    );
  });

  it('available water never exceeds capacity', () => {
    const weather = makeSyntheticWeather(30);
    // Heavy daily rain
    weather.precipMm = weather.precipMm.map(() => 50);
    const result = runWaterBalance(weather, {
      capacityMm: 100,
      texture: 'sandy',
      latitude: 23.8,
      analysisDays: 30,
    });
    for (const avail of result.availableMm) {
      assert.ok(avail <= 100.01, `Available ${avail} exceeds capacity 100`);
    }
  });

  it('available water never goes negative', () => {
    const weather = makeSyntheticWeather(60);
    // No rain at all
    weather.precipMm = weather.precipMm.map(() => 0);
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });
    for (const avail of result.availableMm) {
      assert.ok(avail >= 0, `Available ${avail} went negative`);
    }
  });

  it('produces non-zero runoff for heavy rain on clay (high CN)', () => {
    const weather = makeSyntheticWeather(30);
    // Very heavy rain event
    weather.precipMm[5] = 80;
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'clay',
      latitude: 23.8,
      analysisDays: 30,
    });
    assert.ok(result.totals.runoffMm > 0, 'Expected some runoff with heavy rain on clay');
  });

  it('stress coefficient Ks < 1 on dry days (no rain, depleted soil)', () => {
    const weather = makeSyntheticWeather(90);
    weather.precipMm = weather.precipMm.map(() => 0);
    const result = runWaterBalance(weather, {
      capacityMm: 100,
      texture: 'sandy',
      latitude: 23.8,
      analysisDays: 60,
      initialFraction: 0.3,
    });
    // After many dry days, Ks should drop below 1
    const hasStress = result.ks.some(k => k < 1);
    assert.ok(hasStress, 'Expected water stress (Ks < 1) after extended dry period');
    assert.ok(result.totals.stressDays > 0, 'Expected stress days > 0');
  });

  it('handles missing data gracefully (NaN precipitation)', () => {
    const weather = makeSyntheticWeather(30);
    weather.precipMm[10] = NaN;
    weather.precipMm[11] = NaN;
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });
    assert.ok(result.missingDays >= 2, `Expected at least 2 missing days, got ${result.missingDays}`);
    assert.ok(result.validDays <= 28, `Valid days should be <= 28, got ${result.validDays}`);
  });

  it('supports a custom Kc function', () => {
    const weather = makeSyntheticWeather(30);
    const result = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
      kc: (dayIndex, _date) => (dayIndex < 15 ? 0.5 : 1.2),
    });
    assert.ok(result.validDays > 0);
    // ETc should differ between early and late days
    assert.ok(result.etc.length === 30);
  });

  it('counts irrigation in the water supply', () => {
    const weather = makeSyntheticWeather(30);
    weather.precipMm = weather.precipMm.map(() => 0); // No rain
    const irrigationMm = weather.dates.map(() => 5); // 5mm/day

    const withIrrigation = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
      irrigationMm,
    });
    const withoutIrrigation = runWaterBalance(weather, {
      capacityMm: 150,
      texture: 'loamy',
      latitude: 23.8,
      analysisDays: 30,
    });

    // With irrigation, final water should be higher
    const finalWith = withIrrigation.availableMm[withIrrigation.availableMm.length - 1];
    const finalWithout = withoutIrrigation.availableMm[withoutIrrigation.availableMm.length - 1];
    assert.ok(finalWith > finalWithout, `With irrigation ${finalWith} should > without ${finalWithout}`);
    assert.ok(withIrrigation.totals.irrigationMm > 0, 'Irrigation total should be tracked');
  });
});

// ─── latestWetnessPct ───────────────────────────────────────────────────────

describe('latestWetnessPct — GWET extraction', () => {
  it('returns the latest valid 0-1 value as a percentage', () => {
    const series = [0.5, 0.6, 0.7, 0.8];
    assert.equal(latestWetnessPct(series), 80);
  });

  it('skips invalid values at the end', () => {
    const series = [0.5, 0.7, -999, NaN];
    assert.equal(latestWetnessPct(series), 70);
  });

  it('returns null for all-invalid series', () => {
    assert.equal(latestWetnessPct([-999, NaN, -1]), null);
  });

  it('returns null for non-array input', () => {
    assert.equal(latestWetnessPct(null), null);
    assert.equal(latestWetnessPct(undefined), null);
  });

  it('respects lookback window', () => {
    const series = [0.3, 0.4, 0.5, -999, -999, -999];
    // lookback = 2 → only checks indices 5 and 4, both -999
    assert.equal(latestWetnessPct(series, 2), null);
    // lookback = 4 → checks indices 5,4,3,2 → finds 0.5 at index 2
    assert.equal(latestWetnessPct(series, 4), 50);
  });

  it('rejects values outside 0-1 range', () => {
    const series = [0.5, 1.5, 2.0]; // 1.5 and 2.0 are invalid
    assert.equal(latestWetnessPct(series), 50);
  });
});

// ─── compareRainfallSources ─────────────────────────────────────────────────

describe('compareRainfallSources — IMERG vs MERRA-2 agreement', () => {
  it('returns "unknown" for fewer than 14 overlapping days', () => {
    const imerg = { dates: ['20250601', '20250602'], values: [5, 10] };
    const merra = { dates: ['20250601', '20250602'], values: [4, 9] };
    const result = compareRainfallSources(imerg, merra);
    assert.equal(result.level, 'unknown');
    assert.equal(result.totalRatio, null);
    assert.equal(result.dailyCorrelation, null);
  });

  it('returns "good" for identical series', () => {
    const dates = [];
    const values = [];
    for (let i = 0; i < 30; i++) {
      dates.push(`202506${String(i + 1).padStart(2, '0')}`);
      values.push(Math.max(0, 5 * Math.sin(i * 0.5)));
    }
    const result = compareRainfallSources(
      { dates, values },
      { dates, values },
    );
    assert.equal(result.level, 'good');
    assert.equal(result.totalRatio, 1);
    assert.equal(result.dailyCorrelation, 1);
    assert.equal(result.overlapDays, 30);
  });

  it('returns "poor" when one source has much more rain', () => {
    const dates = [];
    const imergVals = [];
    const merraVals = [];
    for (let i = 0; i < 30; i++) {
      dates.push(`202506${String(i + 1).padStart(2, '0')}`);
      const base = 5 + Math.sin(i) * 3;
      imergVals.push(Math.max(0, base * 3)); // 3× more rain
      merraVals.push(Math.max(0, base));
    }
    const result = compareRainfallSources(
      { dates, values: imergVals },
      { dates, values: merraVals },
    );
    // totalRatio should be ~3.0, which is > 1.6 → "poor"
    assert.equal(result.level, 'poor');
  });

  it('handles mismatched date formats (YYYY-MM-DD vs YYYYMMDD)', () => {
    const dates1 = [];
    const dates2 = [];
    const values = [];
    for (let i = 0; i < 20; i++) {
      const day = String(i + 1).padStart(2, '0');
      dates1.push(`202506${day}`);
      dates2.push(`2025-06-${day}`);
      values.push(i * 0.5);
    }
    const result = compareRainfallSources(
      { dates: dates1, values },
      { dates: dates2, values },
    );
    assert.equal(result.overlapDays, 20);
    assert.equal(result.level, 'good');
  });
});

// ─── extractDailyWeather ────────────────────────────────────────────────────

describe('extractDailyWeather — PowerAnalysis to DailyWeather', () => {
  it('extracts core fields from a mock power analysis', () => {
    const mockPower = {
      series: {
        dates: ['20250601', '20250602'],
        t2m: [28, 29],
        t2mMax: [33, 34],
        t2mMin: [23, 24],
        prectotcorr: [0, 5],
        rh2m: [70, 75],
        ws10m: [2, 3],
      },
      currentTemp: 28,
      currentTempMax: 33,
      heatStressDays: 0,
      growingSeasonAvg: 28,
      annualRainfall: 1000,
      growingSeasonRainfall: 300,
      rainfallVariability: 5,
      drySpells: 1,
      tenYearTempTrend: 0.02,
      tenYearRainfallTrend: -5,
      source: 'live',
      attribution: 'test',
    };

    const weather = extractDailyWeather(mockPower);
    assert.deepStrictEqual(weather.dates, ['20250601', '20250602']);
    assert.deepStrictEqual(weather.precipMm, [0, 5]);
    assert.deepStrictEqual(weather.tMean, [28, 29]);
    assert.deepStrictEqual(weather.tMax, [33, 34]);
    assert.deepStrictEqual(weather.tMin, [23, 24]);
  });

  it('returns empty arrays when series has no matching fields', () => {
    const mockPower = { series: { dates: ['20250601'] } };
    const weather = extractDailyWeather(mockPower);
    assert.deepStrictEqual(weather.precipMm, []);
    assert.deepStrictEqual(weather.tMean, []);
  });
});
