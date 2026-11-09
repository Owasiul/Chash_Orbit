// scripts/test-crop-engine.mjs
// Automated verification suite for the Real Crop Dataset & NASA Suitability Engine.

import fs from 'node:fs';
import path from 'node:path';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details}`);
    failedTests++;
  }
}

console.log('\n======================================================');
console.log('  TEST SUITE 1: FAO EcoCrop Dataset Integrity');
console.log('======================================================');

const datasetPath = path.resolve('src/data/fao-crops.json');
assert(fs.existsSync(datasetPath), 'Dataset file exists at src/data/fao-crops.json');

const crops = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
assert(Array.isArray(crops) && crops.length >= 60, `Dataset contains at least 60 validated crops (actual: ${crops.length})`);

let invalidTemps = 0;
let invalidWaters = 0;
let missingFields = 0;

for (const c of crops) {
  const { temp, water, plantingMonths, harvestMonths, soilTextures } = c;
  if (!temp || temp.absMin >= temp.optMin || temp.optMin > temp.optMax || temp.optMax >= temp.absMax) {
    invalidTemps++;
    console.error(`Invalid temp for ${c.name}:`, temp);
  }
  if (!water || water.absMinMm >= water.optMinMm || water.optMinMm > water.optMaxMm || water.optMaxMm >= water.absMaxMm) {
    invalidWaters++;
    console.error(`Invalid water for ${c.name}:`, water);
  }
  if (!Array.isArray(plantingMonths) || plantingMonths.length === 0 || !Array.isArray(harvestMonths) || harvestMonths.length === 0) {
    missingFields++;
  }
  if (!Array.isArray(soilTextures) || soilTextures.length === 0) {
    missingFields++;
  }
}

assert(invalidTemps === 0, 'All crops have strictly ordered cardinal temperatures (absMin < optMin <= optMax < absMax)');
assert(invalidWaters === 0, 'All crops have strictly ordered cardinal water thresholds (absMinMm < optMinMm <= optMaxMm < absMaxMm)');
assert(missingFields === 0, 'All crops have valid phenology months and soil texture arrays');

console.log('\n======================================================');
console.log('  TEST SUITE 2: FAO Trapezoidal Suitability Model');
console.log('======================================================');

function faoTrapezoid(v, absMin, optMin, optMax, absMax) {
  if (v <= absMin || v >= absMax) return 0;
  if (v >= optMin && v <= optMax) return 100;
  if (v < optMin) return Math.max(0, Math.min(100, Math.round(((v - absMin) / (optMin - absMin)) * 100)));
  return Math.max(0, Math.min(100, Math.round(((absMax - v) / (absMax - optMax)) * 100)));
}

// Test case: Maize (absMin: 10, optMin: 18, optMax: 30, absMax: 38)
assert(faoTrapezoid(25, 10, 18, 30, 38) === 100, 'Inside optimal range (25°C) yields 100% suitability');
assert(faoTrapezoid(5, 10, 18, 30, 38) === 0, 'Below absolute minimum (5°C <= 10°C) yields 0% suitability (frost/dormant)');
assert(faoTrapezoid(42, 10, 18, 30, 38) === 0, 'Above absolute maximum (42°C >= 38°C) yields 0% suitability (sterility/wilting)');
assert(faoTrapezoid(14, 10, 18, 30, 38) === 50, 'Midway on lower ramp (14°C) yields exactly 50% suitability');
assert(faoTrapezoid(34, 10, 18, 30, 38) === 50, 'Midway on upper heat ramp (34°C) yields exactly 50% suitability');

console.log('\n======================================================');
console.log('  TEST SUITE 3: Real Agricultural Benchmarks');
console.log('======================================================');

const rice = crops.find(c => c.name === 'Rice');
const wheat = crops.find(c => c.name === 'Wheat');
const chickpea = crops.find(c => c.name === 'Chickpea');

// Bangladesh Monsoon: 29°C, 1600mm
const riceMonsoonTemp = faoTrapezoid(29, rice.temp.absMin, rice.temp.optMin, rice.temp.optMax, rice.temp.absMax);
const riceMonsoonWater = faoTrapezoid(1600, rice.water.absMinMm, rice.water.optMinMm, rice.water.optMaxMm, rice.water.absMaxMm);
assert(riceMonsoonTemp === 100, 'Rice in tropical monsoon (29°C) is 100% optimal');
assert(riceMonsoonWater === 100, 'Rice in monsoon rainfall (1600mm) is 100% optimal');

// Bangladesh Winter: 18°C, 30mm
const wheatWinterTemp = faoTrapezoid(18, wheat.temp.absMin, wheat.temp.optMin, wheat.temp.optMax, wheat.temp.absMax);
assert(wheatWinterTemp === 100, 'Wheat in cool winter (18°C) is 100% optimal');

const riceWinterTemp = faoTrapezoid(14, rice.temp.absMin, rice.temp.optMin, rice.temp.optMax, rice.temp.absMax);
assert(riceWinterTemp === 0, 'Paddy rice in cold winter (14°C) drops to 0% (below absMin 15°C)');

console.log('\n======================================================');
console.log('  TEST SUITE 4: Crop Aliases & Diversity');
console.log('======================================================');

const cornMatch = crops.find(c => c.aliases.includes('Corn'));
assert(cornMatch?.name === 'Maize', 'Alias "Corn" resolves accurately to "Maize"');

const gramMatch = crops.find(c => c.aliases.includes('Garbanzo'));
assert(gramMatch?.name === 'Chickpea', 'Alias "Garbanzo" resolves accurately to "Chickpea"');

const brinjalMatch = crops.find(c => c.aliases.includes('Brinjal'));
assert(brinjalMatch?.name === 'Eggplant', 'Alias "Brinjal" resolves accurately to "Eggplant"');

const nitrogenFixers = crops.filter(c => c.nitrogenEffect === 'fixer');
assert(nitrogenFixers.length >= 10, `At least 10 nitrogen-fixing legumes in dataset (actual: ${nitrogenFixers.length})`);

console.log('\n======================================================');
console.log(`  SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
console.log('======================================================');

if (failedTests > 0) {
  process.exit(1);
}
