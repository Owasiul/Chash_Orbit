import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRisks,
  computeCropCompatibility,
  computeRecommendations,
  buildRotationPlan,
  analyze,
} from '@/lib/decision/engine';
import { CROP_LIBRARY, getCropByName } from '@/lib/crops';

function createMockEnvironment(overrides = {}) {
  return {
    temperature: {
      current: 26,
      currentMax: 32,
      heatStressDays: 10,
      growingSeasonAvg: 25,
      tenYearTrend: 0.02,
      source: 'live',
      attribution: 'NASA POWER',
      ...(overrides.temperature ?? {}),
    },
    rainfall: {
      annualRainfall: 1200,
      growingSeasonRainfall: 450,
      variability: 7,
      drySpells: 2,
      tenYearTrend: -1.5,
      source: 'live',
      attribution: 'NASA POWER',
      ...(overrides.rainfall ?? {}),
    },
    soilMoisture: {
      currentPct: 45,
      seasonalDeficit: 50,
      profile: [],
      source: 'live',
      attribution: 'Derived',
      ...(overrides.soilMoisture ?? {}),
    },
    vegetation: {
      ndvi: 0.55,
      health: 'good',
      seasonalPattern: [],
      recentTrend: 0.01,
      source: 'live',
      attribution: 'MODIS',
      ...(overrides.vegetation ?? {}),
    },
    overallSource: 'live',
    overallAttribution: 'NASA POWER + MODIS',
    ...overrides,
  };
}

function createFarmerInputs(overrides = {}) {
  return {
    latitude: 24.3745,
    longitude: 88.6042,
    area: 2.5,
    areaUnit: 'hectares',
    currentCrop: 'Rice',
    desiredCrops: ['Wheat', 'Chickpea', 'Lentil', 'Maize', 'Mustard', 'Soybean'],
    irrigation: 'limited',
    soilType: 'loamy',
    priorities: {
      soil: 25,
      water: 25,
      climate: 25,
      income: 25,
    },
    ...overrides,
  };
}

describe('Decision Engine Tests', () => {
  describe('1. Scoring bounds (0 - 100)', () => {
    it('keeps all risk scores bounded between 0 and 100 under diverse conditions', () => {
      const testCases = [
        createMockEnvironment(),
        createMockEnvironment({
          temperature: { heatStressDays: 100, growingSeasonAvg: 45, current: 42, currentMax: 48, tenYearTrend: 1.0, source: 'live', attribution: 'test' },
          rainfall: { growingSeasonRainfall: 10, annualRainfall: 50, variability: 0, drySpells: 20, tenYearTrend: -5, source: 'live', attribution: 'test' },
          soilMoisture: { currentPct: 0, seasonalDeficit: 400, profile: [], source: 'live', attribution: 'test' },
        }),
        createMockEnvironment({
          temperature: { heatStressDays: 0, growingSeasonAvg: 5, current: 4, currentMax: 8, tenYearTrend: -0.5, source: 'live', attribution: 'test' },
          rainfall: { growingSeasonRainfall: 2500, annualRainfall: 5000, variability: 50, drySpells: 0, tenYearTrend: 5, source: 'live', attribution: 'test' },
          soilMoisture: { currentPct: 100, seasonalDeficit: 0, profile: [], source: 'live', attribution: 'test' },
        }),
      ];

      for (const env of testCases) {
        const risks = computeRisks(env);
        assert.ok(risks.heatRisk >= 0 && risks.heatRisk <= 100, `heatRisk ${risks.heatRisk} out of bounds`);
        assert.ok(risks.droughtRisk >= 0 && risks.droughtRisk <= 100, `droughtRisk ${risks.droughtRisk} out of bounds`);
        assert.ok(risks.floodRisk >= 0 && risks.floodRisk <= 100, `floodRisk ${risks.floodRisk} out of bounds`);
      }
    });

    it('keeps all compatibility, recommendation, and rotation plan scores between 0 and 100', () => {
      const env = createMockEnvironment();
      const priorityVariations = [
        { soil: 100, water: 0, climate: 0, income: 0 },
        { soil: 0, water: 100, climate: 0, income: 0 },
        { soil: 0, water: 0, climate: 100, income: 0 },
        { soil: 0, water: 0, climate: 0, income: 100 },
        { soil: 50, water: 50, climate: 50, income: 50 },
        { soil: 0, water: 0, climate: 0, income: 0 },
      ];

      for (const priorities of priorityVariations) {
        const inputs = createFarmerInputs({ priorities });
        const result = analyze(inputs, env);

        for (const c of result.cropCompatibility) {
          assert.ok(c.climateFit >= 0 && c.climateFit <= 100, `climateFit ${c.climateFit} out of bounds for ${c.crop}`);
          assert.ok(c.waterFit >= 0 && c.waterFit <= 100, `waterFit ${c.waterFit} out of bounds for ${c.crop}`);
          assert.ok(c.soilFit >= 0 && c.soilFit <= 100, `soilFit ${c.soilFit} out of bounds for ${c.crop}`);
          assert.ok(c.rotationFit >= 0 && c.rotationFit <= 100, `rotationFit ${c.rotationFit} out of bounds for ${c.crop}`);
          assert.ok(c.seasonFit >= 0 && c.seasonFit <= 100, `seasonFit ${c.seasonFit} out of bounds for ${c.crop}`);
          assert.ok(c.overallFit >= 0 && c.overallFit <= 100, `overallFit ${c.overallFit} out of bounds for ${c.crop}`);
        }

        for (const r of result.recommendations) {
          assert.ok(r.score >= 0 && r.score <= 100, `recommendation score ${r.score} out of bounds for ${r.crop}`);
        }

        const plan = result.rotationPlan;
        assert.ok(plan.overallScore >= 0 && plan.overallScore <= 100, `plan overallScore ${plan.overallScore} out of bounds`);
        assert.ok(plan.soilScore >= 0 && plan.soilScore <= 100, `plan soilScore ${plan.soilScore} out of bounds`);
        assert.ok(plan.waterScore >= 0 && plan.waterScore <= 100, `plan waterScore ${plan.waterScore} out of bounds`);
        assert.ok(plan.climateScore >= 0 && plan.climateScore <= 100, `plan climateScore ${plan.climateScore} out of bounds`);
        assert.ok(plan.incomeScore >= 0 && plan.incomeScore <= 100, `plan incomeScore ${plan.incomeScore} out of bounds`);

        for (const yr of plan.years) {
          assert.ok(yr.score >= 0 && yr.score <= 100, `year score ${yr.score} out of bounds for ${yr.crop}`);
        }
      }
    });
  });

  describe('2. Priority weighting', () => {
    it('shifts ranking and scores when income priority is increased', () => {
      const env = createMockEnvironment();
      const highIncomeInputs = createFarmerInputs({
        desiredCrops: ['Potato', 'Millet'],
        priorities: { soil: 0, water: 0, climate: 0, income: 100 },
      });
      const lowIncomeInputs = createFarmerInputs({
        desiredCrops: ['Potato', 'Millet'],
        priorities: { soil: 100, water: 0, climate: 0, income: 0 },
      });

      const risks = computeRisks(env);
      const highCompat = computeCropCompatibility(highIncomeInputs, env, risks);
      const lowCompat = computeCropCompatibility(lowIncomeInputs, env, risks);

      const potatoHigh = highCompat.find(c => c.crop === 'Potato');
      const milletHigh = highCompat.find(c => c.crop === 'Millet');
      const potatoLow = lowCompat.find(c => c.crop === 'Potato');
      const milletLow = lowCompat.find(c => c.crop === 'Millet');

      assert.ok(potatoHigh && milletHigh && potatoLow && milletLow);
      // Potato has baseIncome 85, Millet has baseIncome 55.
      // Under income=100, Potato should have a higher score advantage over Millet than under income=0.
      const diffHigh = potatoHigh.overallFit - milletHigh.overallFit;
      const diffLow = potatoLow.overallFit - milletLow.overallFit;
      assert.ok(diffHigh > diffLow, `Expected Potato-Millet advantage under high income (${diffHigh}) > under low income (${diffLow})`);
    });

    it('weights rotation plan overall score according to farmer priority weights', () => {
      const env = createMockEnvironment();
      const prioritiesList = [
        { soil: 100, water: 0, climate: 0, income: 0 },
        { soil: 0, water: 100, climate: 0, income: 0 },
        { soil: 0, water: 0, climate: 100, income: 0 },
        { soil: 0, water: 0, climate: 0, income: 100 },
      ];

      for (const priorities of prioritiesList) {
        const inputs = createFarmerInputs({ priorities });
        const result = analyze(inputs, env);
        const plan = result.rotationPlan;

        if (priorities.soil === 100) {
          assert.equal(plan.overallScore, plan.soilScore, 'Overall score should equal soil score when soil priority is 100%');
        } else if (priorities.water === 100) {
          assert.equal(plan.overallScore, plan.waterScore, 'Overall score should equal water score when water priority is 100%');
        } else if (priorities.climate === 100) {
          assert.equal(plan.overallScore, plan.climateScore, 'Overall score should equal climate score when climate priority is 100%');
        } else if (priorities.income === 100) {
          assert.equal(plan.overallScore, plan.incomeScore, 'Overall score should equal income score when income priority is 100%');
        }
      }
    });
  });

  describe('3. Rotation never repeats a crop family in consecutive years', () => {
    it('ensures consecutive rotation years belong to different plant families across multiple scenarios', () => {
      const testCrops = ['Rice', 'Wheat', 'Maize', 'Potato', 'Chickpea', 'Lentil', 'Soybean', 'Cotton', 'Tomato'];
      const env = createMockEnvironment();

      for (const curCrop of testCrops) {
        const inputs = createFarmerInputs({
          currentCrop: curCrop,
          desiredCrops: ['Rice', 'Wheat', 'Maize', 'Potato', 'Chickpea', 'Lentil', 'Soybean', 'Millet', 'Mustard'],
        });
        const result = analyze(inputs, env);
        const years = result.rotationPlan.years;

        assert.equal(years.length, 4, 'Rotation plan should have exactly 4 years');

        for (let i = 1; i < years.length; i++) {
          const prevCrop = getCropByName(years[i - 1].crop);
          const currCrop = getCropByName(years[i].crop);
          assert.ok(prevCrop && currCrop, 'Both crops must exist in library');
          assert.notEqual(
            currCrop.family,
            prevCrop.family,
            `Year ${years[i].year} (${currCrop.name}, ${currCrop.family}) repeated family of Year ${years[i - 1].year} (${prevCrop.name}, ${prevCrop.family})`,
          );
        }
      }
    });
  });

  describe('4. Legume / cereal alternation', () => {
    it('starts with a legume after a cereal (nitrogen depleter)', () => {
      const env = createMockEnvironment();
      // Rice is a Poaceae cereal, depleter
      const inputs = createFarmerInputs({
        currentCrop: 'Rice',
        desiredCrops: ['Wheat', 'Chickpea', 'Lentil', 'Maize'],
      });
      const result = analyze(inputs, env);
      const y1Crop = getCropByName(result.rotationPlan.years[0].crop);
      assert.ok(y1Crop);
      assert.equal(y1Crop.nitrogenEffect, 'fixer', `Expected Year 1 after Rice to be a nitrogen fixer, got ${y1Crop.name} (${y1Crop.nitrogenEffect})`);
    });

    it('starts with a cereal/depleter after a legume (nitrogen fixer)', () => {
      const env = createMockEnvironment();
      // Chickpea is a Fabaceae legume, fixer
      const inputs = createFarmerInputs({
        currentCrop: 'Chickpea',
        desiredCrops: ['Wheat', 'Lentil', 'Maize', 'Soybean'],
      });
      const result = analyze(inputs, env);
      const y1Crop = getCropByName(result.rotationPlan.years[0].crop);
      assert.ok(y1Crop);
      assert.equal(y1Crop.nitrogenEffect, 'depleter', `Expected Year 1 after Chickpea to be a nitrogen depleter, got ${y1Crop.name} (${y1Crop.nitrogenEffect})`);
    });

    it('alternates depleters and fixers across consecutive rotation years', () => {
      const env = createMockEnvironment();
      const inputs = createFarmerInputs({
        currentCrop: 'Rice',
        desiredCrops: ['Wheat', 'Chickpea', 'Maize', 'Lentil', 'Soybean'],
      });
      const result = analyze(inputs, env);
      const years = result.rotationPlan.years;

      for (let i = 1; i < years.length; i++) {
        const prev = getCropByName(years[i - 1].crop);
        const curr = getCropByName(years[i].crop);
        assert.ok(prev && curr);
        if (prev.nitrogenEffect === 'depleter') {
          assert.equal(curr.nitrogenEffect, 'fixer', `Year ${years[i].year} (${curr.name}) should be fixer after Year ${years[i - 1].year} (${prev.name}, depleter)`);
        } else if (prev.nitrogenEffect === 'fixer') {
          assert.equal(curr.nitrogenEffect, 'depleter', `Year ${years[i].year} (${curr.name}) should be depleter after Year ${years[i - 1].year} (${prev.name}, fixer)`);
        }
      }
    });
  });

  describe('5. Cover-crop rule when soil-health priority is high', () => {
    it('assigns a cover crop in year 4 when soil priority is >= 30 and year 4 crop is not a fixer', () => {
      const env = createMockEnvironment();
      // Current crop Chickpea -> Year 1 depleter -> Year 2 fixer -> Year 3 depleter -> Year 4 non-fixer
      const inputs = createFarmerInputs({
        currentCrop: 'Chickpea',
        desiredCrops: ['Wheat', 'Lentil', 'Maize', 'Soybean'],
        priorities: { soil: 40, water: 20, climate: 20, income: 20 },
      });
      const result = analyze(inputs, env);
      const y4 = result.rotationPlan.years[3];
      const y4Crop = getCropByName(y4.crop);
      assert.ok(y4Crop);

      if (y4Crop.nitrogenEffect !== 'fixer') {
        assert.equal(y4.coverCrop, 'Mung / cover crop', 'Expected Mung / cover crop in year 4 with soil priority >= 30');
      } else {
        // If year 4 happens to be a fixer, cover crop is not added
        assert.equal(y4.coverCrop, null);
      }
    });

    it('does not assign a cover crop when soil priority is < 30', () => {
      const env = createMockEnvironment();
      const inputs = createFarmerInputs({
        currentCrop: 'Chickpea',
        desiredCrops: ['Wheat', 'Lentil', 'Maize', 'Soybean'],
        priorities: { soil: 20, water: 30, climate: 25, income: 25 },
      });
      const result = analyze(inputs, env);
      const y4 = result.rotationPlan.years[3];
      assert.equal(y4.coverCrop, null, 'Expected no cover crop when soil priority is < 30');
    });
  });
});
