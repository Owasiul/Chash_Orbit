// Field Shift — pre-warm the NASA cache for the demo farms.
// Run after every deploy so judges see LIVE/CACHED data, never DEMO, and the
// slow MODIS NDVI fetch (~30s cold) has already happened.
//
//   BASE_URL=https://your-host npm run warm-cache
//
// Keep FARMS in sync with SAMPLE_FARMS in src/lib/location.ts.

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const MAX_PASSES = 4;
const PASS_DELAY_MS = 45_000;

const FARMS = [
  { name: 'Rajshahi', latitude: 24.3745, longitude: 88.6042, crops: ['Wheat', 'Chickpea', 'Lentil', 'Maize'] },
  { name: 'Punjab', latitude: 30.37, longitude: 75.55, crops: ['Wheat', 'Chickpea', 'Maize'] },
  { name: 'Iowa', latitude: 41.878, longitude: -93.0977, crops: ['Soybean', 'Maize', 'Wheat'] },
  { name: 'California Central Valley', latitude: 37.5, longitude: -120.5, crops: ['Tomato', 'Wheat', 'Chickpea'] },
  { name: 'Ludhiana', latitude: 30.901, longitude: 75.8573, crops: ['Wheat', 'Chickpea', 'Maize'] },
  { name: 'Dhaka', latitude: 23.8103, longitude: 90.4125, crops: ['Rice', 'Lentil', 'Potato'] },
];

async function analyze(farm) {
  const res = await fetch(`${BASE_URL}/api/field/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: farm.latitude,
      longitude: farm.longitude,
      locationName: farm.name,
      desiredCrops: farm.crops,
      irrigation: 'limited',
      priorities: { soil: 25, water: 25, climate: 25, income: 25 },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const { environment } = await res.json();
  return { power: environment.overallSource, ndvi: environment.vegetation.source };
}

const isWarm = r => r && r.power !== 'demo' && (r.ndvi === 'live' || r.ndvi === 'cached');

let pending = FARMS;
for (let pass = 1; pass <= MAX_PASSES && pending.length; pass++) {
  if (pass > 1) await new Promise(r => setTimeout(r, PASS_DELAY_MS));
  const results = await Promise.all(pending.map(f => analyze(f).catch(e => ({ error: e.message }))));
  results.forEach((r, i) =>
    console.log(`pass ${pass} · ${pending[i].name.padEnd(26)} ${r.error ?? `POWER=${r.power} NDVI=${r.ndvi}`}`),
  );
  pending = pending.filter((_, i) => !isWarm(results[i]));
}

if (pending.length) {
  console.error(`Not warm after ${MAX_PASSES} passes: ${pending.map(f => f.name).join(', ')}`);
  process.exit(1);
}
console.log('All demo farms warm.');
