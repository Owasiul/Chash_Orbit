// Sanity checks against places where the agronomic answer is well known.
// They call the running dev server (npm run dev), so they are skipped when it is not up.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.GOLDEN_BASE_URL ?? 'http://localhost:3000';

async function serverUp() {
  try {
    const r = await fetch(`${BASE}/api/crops`, { signal: AbortSignal.timeout(3000) });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function analyze(latitude, longitude, desiredCrops, irrigation = 'limited') {
  const res = await fetch(`${BASE}/api/field/analyze`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      latitude,
      longitude,
      desiredCrops,
      irrigation,
      priorities: { soil: 25, water: 25, climate: 25, income: 25 },
    }),
    signal: AbortSignal.timeout(120000),
  });
  assert.equal(res.status, 200);
  return res.json();
}

const up = await serverUp();

describe('golden locations', { skip: up ? false : 'dev server not running' }, () => {
  it('Antarctica is not farmable', async () => {
    const d = await analyze(-80, 0, ['Wheat', 'Maize']);
    assert.equal(d.viability.farmable, false);
    assert.equal(d.recommendations.length, 0);
  });

  it('open ocean is not farmable', async () => {
    const d = await analyze(0, -30, ['Wheat', 'Maize']);
    assert.equal(d.viability.farmable, false);
  });

  it('Sahel (Niger) ranks millet or sorghum above rice and wheat', async () => {
    const d = await analyze(14.0, 2.1, ['Rice', 'Wheat', 'Millet', 'Sorghum']);
    const order = [...d.cropCompatibility].sort((a, b) => b.overallFit - a.overallFit).map(c => c.crop);
    assert.ok(['Millet', 'Sorghum'].includes(order[0]), `top crop was ${order[0]}`);
    assert.ok(order.indexOf('Rice') > order.indexOf(order[0]));
  });

  it('Iowa ranks maize or soybean above rice', async () => {
    const d = await analyze(41.9, -93.6, ['Rice', 'Maize', 'Soybean']);
    const order = [...d.cropCompatibility].sort((a, b) => b.overallFit - a.overallFit).map(c => c.crop);
    assert.ok(['Maize', 'Soybean'].includes(order[0]), `top crop was ${order[0]}`);
  });

  it('high Andes (La Paz) ranks potato above rice and maize and reports high elevation', async () => {
    const d = await analyze(-16.5, -68.15, ['Rice', 'Potato', 'Maize']);
    const order = [...d.cropCompatibility].sort((a, b) => b.overallFit - a.overallFit).map(c => c.crop);
    assert.equal(order[0], 'Potato');
    assert.ok(d.environment.rawPower.fieldElevationM > 3000);
  });

  it('Bangladesh is farmable and reports measured soil moisture', async () => {
    const d = await analyze(23.8, 90.4, ['Rice', 'Wheat', 'Chickpea']);
    assert.equal(d.viability.farmable, true);
    assert.equal(d.environment.soilMoisture.measured, true);
  });
});
