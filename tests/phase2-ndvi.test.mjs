// Chash Orbit — Phase 2 Tests
// Verifies:
// 1. Polygon-to-km area window calculation for ORNL DAAC Subsets
// 2. South Asia regional bias correction detection and adjustment (-0.28)
// 3. Fallback and live MODIS NDVI derivation with spatial resolution disclosure
// 4. Sentinel-2 STAC metadata integration

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePolygonKmWindow,
  isSouthAsia,
  applyRegionalBias,
  deriveVegetation,
} from '../src/lib/nasa/modis.ts';
import { demoPower } from '../src/lib/nasa/environment.ts';

describe('Phase 2 — Polygon-aware NASA & MODIS NDVI', () => {
  it('computes spatial km window accurately from polygon coordinates', () => {
    // Single pixel / smallholder field
    const smallWindow = computePolygonKmWindow([
      [88.6030, 24.3738],
      [88.6050, 24.3739],
      [88.6048, 24.3751],
      [88.6028, 24.3750],
      [88.6030, 24.3738],
    ]);
    assert.equal(smallWindow.kmAboveBelow, 0);
    assert.equal(smallWindow.kmLeftRight, 0);
    assert.equal(smallWindow.totalWindowKm, 0.25); // single 250m pixel

    // Large commercial field / landscape (~10 km x ~10 km)
    const largeWindow = computePolygonKmWindow([
      [88.50, 24.30],
      [88.60, 24.30],
      [88.60, 24.40],
      [88.50, 24.40],
      [88.50, 24.30],
    ]);
    assert.ok(largeWindow.kmAboveBelow > 0);
    assert.ok(largeWindow.kmLeftRight > 0);
    assert.ok(largeWindow.totalWindowKm >= 10);
  });

  it('correctly identifies South Asia bounding box (lat 6°-37°N, lng 68°-98°E)', () => {
    // Bangladesh (Rajshahi)
    assert.equal(isSouthAsia(24.37, 88.60), true);
    // India (New Delhi)
    assert.equal(isSouthAsia(28.61, 77.20), true);
    // Pakistan (Lahore)
    assert.equal(isSouthAsia(31.52, 74.35), true);

    // Outside South Asia:
    // California, USA
    assert.equal(isSouthAsia(36.77, -119.41), false);
    // Kenya
    assert.equal(isSouthAsia(-1.29, 36.82), false);
    // UK
    assert.equal(isSouthAsia(51.50, -0.12), false);
  });

  it('applies calibrated regional bias (-0.28) in South Asia while preserving bounds', () => {
    // In South Asia: 0.65 raw -> 0.37 corrected
    const corrected = applyRegionalBias(0.65, 24.37, 88.60);
    assert.equal(corrected, 0.37);

    // Low raw value clamps to 0.05
    const clampedLow = applyRegionalBias(0.20, 24.37, 88.60);
    assert.equal(clampedLow, 0.05);

    // Outside South Asia: unmodified
    const unadjusted = applyRegionalBias(0.65, 36.77, -119.41);
    assert.equal(unadjusted, 0.65);
  });

  it('derives vegetation with honest spatial resolution labels and Sentinel-2 STAC link', () => {
    const powerDemo = demoPower(24.37, 88.60);

    // When power is demo, vegetation is labeled demo
    const derivedDemo = deriveVegetation(powerDemo, 24.37, 88.60, null);
    assert.equal(derivedDemo.source, 'demo');
    assert.ok(derivedDemo.resolution?.includes('0.5°'));
    assert.ok(derivedDemo.ndvi >= 0.05 && derivedDemo.ndvi <= 0.85);

    // When power is live, unobserved MODIS is labeled derived
    const powerLive = { ...powerDemo, source: 'live' };
    const derivedLive = deriveVegetation(powerLive, 24.37, 88.60, null);
    assert.equal(derivedLive.source, 'derived');
    assert.ok(derivedLive.resolution?.includes('0.5°'));

    // Test live MODIS observations
    const mockModis = {
      source: 'live',
      observations: [
        { date: '2024-08-01', ndvi: 0.42 },
        { date: '2024-08-17', ndvi: 0.45 },
        { date: '2024-09-02', ndvi: 0.48 },
      ],
      areaWindowKm: 1.0,
    };

    const mockSentinel = {
      sceneId: 'S2C_MSIL2A_20261104T043941_R033_T45RXH',
      datetime: '2026-11-04T04:39:41.025Z',
      cloudCoverPct: 12.4,
    };

    const live = deriveVegetation(powerLive, 24.37, 88.60, mockModis, undefined, mockSentinel);
    assert.equal(live.source, 'live');
    assert.equal(live.ndvi, 0.45);
    assert.ok(live.resolution?.includes('250 m'));
    assert.equal(live.ndviLoading, false);
    assert.equal(live.sentinel2SceneId, 'S2C_MSIL2A_20261104T043941_R033_T45RXH');
    assert.equal(live.sentinel2CloudCover, 12.4);
  });
});
