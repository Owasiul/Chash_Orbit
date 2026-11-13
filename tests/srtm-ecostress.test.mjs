// Tests for SRTM Topography and NASA ECOSTRESS modules

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySlope,
  degreesToAspect,
  classifyDrainage,
  calculateSlopeAndAspect,
  demoTopography,
} from '@/lib/nasa/srtm';
import {
  calculateVpdKpa,
  deriveEcostressMetrics,
  classifyEcostressStress,
  demoEcostress,
} from '@/lib/nasa/ecostress';
import { computeRisks } from '@/lib/decision/engine';

// ─── SRTM Topography Tests ──────────────────────────────────────────────────

describe('SRTM Topography — Classification and Math', () => {
  it('classifies slopes into standard agronomic categories', () => {
    assert.equal(classifySlope(0.5), 'flat');
    assert.equal(classifySlope(1.9), 'flat');
    assert.equal(classifySlope(2.0), 'gentle');
    assert.equal(classifySlope(4.9), 'gentle');
    assert.equal(classifySlope(5.0), 'moderate');
    assert.equal(classifySlope(9.9), 'moderate');
    assert.equal(classifySlope(10.0), 'steep');
    assert.equal(classifySlope(25.0), 'steep');
  });

  it('determines aspect compass direction from azimuth', () => {
    assert.equal(degreesToAspect(0, 0.2), 'flat'); // flat when slope is negligible
    assert.equal(degreesToAspect(0, 3.0), 'N');
    assert.equal(degreesToAspect(45, 3.0), 'NE');
    assert.equal(degreesToAspect(90, 3.0), 'E');
    assert.equal(degreesToAspect(135, 3.0), 'SE');
    assert.equal(degreesToAspect(180, 3.0), 'S');
    assert.equal(degreesToAspect(225, 3.0), 'SW');
    assert.equal(degreesToAspect(270, 3.0), 'W');
    assert.equal(degreesToAspect(315, 3.0), 'NW');
    assert.equal(degreesToAspect(355, 3.0), 'N');
  });

  it('identifies drainage and ponding risk based on slope and elevation', () => {
    // Low-lying flat ground in delta plains -> ponding risk
    assert.equal(classifyDrainage(15, 0.5, 0.8), 'ponding-risk');
    // High slope -> well drained
    assert.equal(classifyDrainage(100, 9.0, 12), 'well-drained');
    // Gentle slope -> moderate
    assert.equal(classifyDrainage(40, 4.0, 3.0), 'moderate');
  });

  it('calculates slope and aspect accurately from cardinal elevation grid', () => {
    const lat = 23.8;
    const latOffset = 0.001; // ~111.32m
    const lonOffset = 0.001 / Math.cos((lat * Math.PI) / 180);

    // Uniform slope rising toward the North by 5m over ~222m
    const center = 20;
    const zN = 22.5;
    const zS = 17.5;
    const zE = 20;
    const zW = 20;

    const { slopeDeg, slopePct, aspectDeg } = calculateSlopeAndAspect(
      [center, zN, zS, zE, zW],
      latOffset,
      lonOffset,
      lat,
    );

    assert.ok(slopeDeg > 0 && slopeDeg < 10, `Expected gentle slope, got ${slopeDeg}°`);
    assert.ok(slopePct > 0, `Expected positive slope percentage, got ${slopePct}%`);
    assert.equal(aspectDeg, 0); // Facing North
  });

  it('generates plausible demo topography bounded properly', () => {
    const demo = demoTopography(23.8103, 90.4125);
    assert.ok(demo.elevationM > 0, 'Elevation should be positive');
    assert.ok(demo.maxElevationM >= demo.minElevationM, 'Max elev should >= min elev');
    assert.ok(demo.reliefM >= 0, 'Relief should be non-negative');
    assert.ok(demo.slopeDeg >= 0 && demo.slopeDeg <= 60, 'Slope should be bounded');
    assert.equal(demo.source, 'DEMO');
  });
});

// ─── ECOSTRESS Tests ────────────────────────────────────────────────────────

describe('ECOSTRESS — Evaporative Stress & Thermal Anomaly', () => {
  it('calculates Vapor Pressure Deficit (VPD) accurately', () => {
    // At 100% RH, VPD must be 0
    assert.equal(calculateVpdKpa(25, 100), 0);

    // At 30°C and 50% RH: satVp is ~4.24 kPa -> VPD is ~2.12 kPa
    const vpd = calculateVpdKpa(30, 50);
    assert.ok(vpd > 1.8 && vpd < 2.4, `Expected ~2.12 kPa, got ${vpd}`);
  });

  it('derives optimal ESI and evaporative cooling under abundant moisture', () => {
    // Cool air, high soil moisture, full transpiration
    const metrics = deriveEcostressMetrics(26, 75, 80, 4.5, 4.5);

    assert.ok(metrics.esi >= 0.75, `Expected high ESI under good water, got ${metrics.esi}`);
    // Canopy should be cooler than air (negative thermal anomaly)
    assert.ok(
      metrics.thermalAnomalyC <= 0,
      `Canopy should be evaporatively cooled, got ${metrics.thermalAnomalyC}°C`
    );
    assert.ok(metrics.lstC <= 26, `LST ${metrics.lstC} should be <= air temp 26`);
    assert.equal(classifyEcostressStress(metrics.esi), 'optimal');
  });

  it('derives severe ESI stress and canopy overheating under dry, hot drought', () => {
    // 38°C hot air, 25% dry RH, dry root zone (15% moisture), low ETa
    const metrics = deriveEcostressMetrics(38, 25, 15, 1.0, 6.0);

    assert.ok(metrics.esi < 0.4, `Expected low ESI under drought, got ${metrics.esi}`);
    // Canopy should overheat above ambient air (positive thermal anomaly)
    assert.ok(
      metrics.thermalAnomalyC > 1.5,
      `Canopy should overheat above air, got ${metrics.thermalAnomalyC}°C`
    );
    assert.ok(metrics.lstC > 38, `LST ${metrics.lstC} should be > air temp 38`);
    assert.equal(classifyEcostressStress(metrics.esi), 'severe-stress');
  });

  it('generates consistent demo ECOSTRESS telemetry', () => {
    const demo = demoEcostress(23.8103, 90.4125);
    assert.ok(demo.esi >= 0 && demo.esi <= 1.0, 'ESI must be 0-1');
    assert.ok(Number.isFinite(demo.lstC), 'LST must be finite');
    assert.ok(demo.waterUseEfficiency > 0, 'WUE must be positive');
    assert.equal(demo.source, 'DEMO');
  });
});

// ─── Engine Integration with SRTM & ECOSTRESS ───────────────────────────────

describe('Decision Engine — SRTM Topography & ECOSTRESS Sensitivity', () => {
  function makeBaseEnvironment() {
    return {
      temperature: {
        current: 28,
        currentMax: 33,
        heatStressDays: 5,
        growingSeasonAvg: 27,
        tenYearTrend: 0.02,
        source: 'live',
        attribution: 'NASA POWER',
      },
      rainfall: {
        annualRainfall: 1100,
        growingSeasonRainfall: 500,
        variability: 7,
        drySpells: 1,
        source: 'live',
        attribution: 'NASA GPM',
        dataQuality: { validDays: 365, expectedDays: 365, coveragePct: 100, missingDays: 0, isReliable: true },
      },
      soilMoisture: {
        rootZoneWaterMm: 80,
        rootZoneWaterPct: 50,
        rootZoneCapacityMm: 160,
        referenceEtMmPerDay: 4.2,
        cropEtMmPerDay: 4.0,
        totalGrowingSeasonEtcMm: 360,
        seasonalDeficit: 20,
        effectiveRainfallMm: 450,
        rainfallTrendMmPerYear: null,
        soilMoistureTrendPctPerYear: null,
        source: 'DERIVED',
        status: 'live',
        attribution: 'FAO-56',
        dataQuality: { validDays: 90, missingDays: 0, coveragePct: 100, isReliable: true },
        currentPct: 50,
      },
      vegetation: {
        ndvi: 0.65,
        health: 'good',
        seasonalPattern: [],
        recentTrend: 0.01,
        source: 'live',
        attribution: 'MODIS',
      },
      overallSource: 'live',
      overallAttribution: 'Test',
    };
  }

  it('adjusts flood risk when SRTM indicates ponding-prone low-lying terrain', () => {
    const baseEnv = makeBaseEnvironment();
    const baseRisks = computeRisks(baseEnv);

    // Environment with low-lying flat ponding risk terrain from SRTM
    const pondingEnv = {
      ...baseEnv,
      topography: {
        elevationM: 12,
        minElevationM: 11,
        maxElevationM: 13,
        reliefM: 2,
        slopePct: 0.5,
        slopeDeg: 0.3,
        slopeCategory: 'flat',
        aspect: 'flat',
        aspectDeg: 0,
        drainageClass: 'ponding-risk',
        terrainRoughness: 'smooth',
        source: 'SRTM_30M',
        status: 'live',
        attribution: 'SRTM',
        resolution: '30 m',
      },
    };

    const pondingRisks = computeRisks(pondingEnv);
    assert.ok(
      pondingRisks.floodRisk > baseRisks.floodRisk,
      `Ponding risk (${pondingRisks.floodRisk}) should exceed flat baseline (${baseRisks.floodRisk})`
    );
  });

  it('adjusts heat and drought risk when ECOSTRESS indicates canopy overheating and transpirational stress', () => {
    const baseEnv = makeBaseEnvironment();
    const baseRisks = computeRisks(baseEnv);

    // Environment with severe canopy overheating and transpirational collapse from ECOSTRESS
    const stressedEnv = {
      ...baseEnv,
      ecostress: {
        esi: 0.25, // severe evaporative stress
        stressLevel: 'severe-stress',
        lstC: 34,
        thermalAnomalyC: 4.5, // leaf heating +4.5°C above ambient
        waterUseEfficiency: 0.8,
        sceneId: 'ECOv002_TEST',
        acquisitionDate: new Date().toISOString(),
        dayNight: 'DAY',
        source: 'NASA_ECOSTRESS',
        status: 'live',
        attribution: 'ECOSTRESS',
        resolution: '70 m',
      },
    };

    const stressedRisks = computeRisks(stressedEnv);
    assert.ok(
      stressedRisks.heatRisk > baseRisks.heatRisk,
      `ECOSTRESS thermal anomaly should raise heat risk: ${stressedRisks.heatRisk} > ${baseRisks.heatRisk}`
    );
    assert.ok(
      stressedRisks.droughtRisk > baseRisks.droughtRisk,
      `ECOSTRESS transpirational shutdown should raise drought risk: ${stressedRisks.droughtRisk} > ${baseRisks.droughtRisk}`
    );
  });
});
