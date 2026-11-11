import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePolygon,
  createPolygonFeature,
  createPresetField,
  RAJSHAHI_DEMO_FIELD,
  formatArea,
  MIN_FIELD_AREA_HA,
  MAX_FIELD_AREA_HA,
} from '@/lib/polygon';

describe('Polygon & Spatial Geometry Tests', () => {
  it('validates the Rajshahi demo polygon successfully with correct metrics', () => {
    const feature = createPolygonFeature(RAJSHAHI_DEMO_FIELD.coordinates, { id: 'rajshahi-field' });
    const result = validatePolygon(feature);

    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
    assert.ok(result.areaHa > 2.0 && result.areaHa < 3.5, `Expected area ~2.7 ha, got ${result.areaHa}`);
    assert.ok(result.areaAcres > 5.0 && result.areaAcres < 8.5);

    // Centroid should be inside Rajshahi coordinates
    const [lng, lat] = result.centroid;
    assert.ok(Math.abs(lng - 88.604) < 0.005, `Lng centroid ${lng} deviated`);
    assert.ok(Math.abs(lat - 24.374) < 0.005, `Lat centroid ${lat} deviated`);

    // Bbox should encapsulate the coordinates
    const [minLng, minLat, maxLng, maxLat] = result.bbox;
    assert.ok(minLng <= 88.6030 && maxLng >= 88.6050);
    assert.ok(minLat <= 24.3738 && maxLat >= 24.3751);
  });

  it('detects and rejects self-intersecting polygons (bowtie shape)', () => {
    // Bowtie: edges (0,0)->(1,1) and (0,1)->(1,0) cross each other
    const bowtieCoords = [
      [0, 0],
      [1, 1],
      [0, 1],
      [1, 0],
      [0, 0],
    ];
    const bowtieFeature = createPolygonFeature(bowtieCoords);
    const result = validatePolygon(bowtieFeature);

    assert.equal(result.valid, false);
    assert.ok(result.error && result.error.includes('Self-intersection detected'), `Expected self-intersection error, got ${result.error}`);
  });

  it('rejects polygons that are too small (< 0.01 ha / 100 m²)', () => {
    // Micro polygon (approx 1m x 1m = 1 m² = 0.0001 ha)
    const microCoords = [
      [88.600000, 24.370000],
      [88.600010, 24.370000],
      [88.600010, 24.370010],
      [88.600000, 24.370010],
      [88.600000, 24.370000],
    ];
    const microFeature = createPolygonFeature(microCoords);
    const result = validatePolygon(microFeature);

    assert.equal(result.valid, false);
    assert.ok(result.error && result.error.includes('too small'));
  });

  it('rejects polygons that exceed maximum allowed area (> 5,000 ha)', () => {
    // Huge polygon (approx 1 degree x 1 degree ~ 10,000 km² = 1,000,000 ha)
    const hugeCoords = [
      [88.0, 24.0],
      [89.0, 24.0],
      [89.0, 25.0],
      [88.0, 25.0],
      [88.0, 24.0],
    ];
    const hugeFeature = createPolygonFeature(hugeCoords);
    const result = validatePolygon(hugeFeature);

    assert.equal(result.valid, false);
    assert.ok(result.error && result.error.includes('5,000 ha'));
  });

  it('automatically closes unclosed polygon rings in createPolygonFeature', () => {
    const unclosedCoords = [
      [88.6030, 24.3738],
      [88.6050, 24.3739],
      [88.6048, 24.3751],
      [88.6028, 24.3750],
      // missing duplicate first point
    ];
    const feature = createPolygonFeature(unclosedCoords);
    const ring = feature.geometry.coordinates[0];
    assert.equal(ring.length, 5);
    assert.deepEqual(ring[0], ring[4]);
  });

  it('formats area strings cleanly with hectares and acres', () => {
    assert.equal(formatArea(2.73), '2.73 ha (6.75 ac)');
    assert.equal(formatArea(15.2), '15.2 ha (37.6 ac)');
  });

  it('generates a valid ~1.0 hectare preset field around given coordinates', () => {
    const coords = createPresetField(91.11458, 23.23939, 1.0);
    assert.equal(coords.length, 5);
    assert.deepEqual(coords[0], coords[4]);

    const feature = createPolygonFeature(coords, { id: 'preset-field' });
    const result = validatePolygon(feature);

    assert.equal(result.valid, true);
    assert.equal(result.error, undefined);
    assert.ok(result.areaHa > 0.95 && result.areaHa < 1.05, `Expected ~1.0 ha, got ${result.areaHa}`);
    assert.ok(result.areaAcres > 2.3 && result.areaAcres < 2.6);
  });
});
