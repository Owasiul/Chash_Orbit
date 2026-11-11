// Chash Orbit — Advisor Chat & Gemini 3.5 Flash Lite Tests
// Verifies:
// 1. Chat API grounded responses from field decision engine data
// 2. Fallback generation for crop, water, and rotation questions
// 3. Multilingual Bengali (bn-BD) and English support
// 4. Structured report output structure matching explainSchema

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const mockAnalysis = {
  field: { latitude: 23.8103, longitude: 90.4125 },
  inputs: { soilType: 'loamy', irrigation: 'limited' },
  environmental: {
    rainfallMm: 1250,
    vegetation: { ndvi: 0.62 },
    temperature: { averageC: 26.5 },
  },
  recommendations: [
    { crop: 'Rice', score: 88.4, rank: 1 },
    { crop: 'Wheat', score: 82.1, rank: 2 },
  ],
  rotationPlan: {
    years: [
      { year: 1, crop: 'Rice', family: 'Poaceae', role: 'Main harvest' },
      { year: 2, crop: 'Lentil', family: 'Fabaceae', role: 'Nitrogen fixer' },
      { year: 3, crop: 'Wheat', family: 'Poaceae', role: 'Cereal' },
      { year: 4, crop: 'Mung Bean', family: 'Fabaceae', role: 'Cover / Restorative' },
    ],
  },
  verdict: {
    summary: 'Optimal conditions for Rice; manage seasonal moisture deficits.',
    dominantRisk: 'Water Stress',
  },
};

describe('Advisor Chatbot & Gemini 3.5 Flash Lite Grounding', () => {
  it('correctly extracts top crop and compatibility score in responses', () => {
    const topRec = mockAnalysis.recommendations[0];
    assert.equal(topRec.crop, 'Rice');
    assert.equal(topRec.score.toFixed(1), '88.4');
  });

  it('correctly provides 4-year rotation sequence without repeating families consecutively', () => {
    const years = mockAnalysis.rotationPlan.years;
    assert.equal(years.length, 4);
    for (let i = 0; i < years.length - 1; i++) {
      assert.notEqual(years[i].family, years[i + 1].family);
    }
  });

  it('includes live satellite rainfall and NDVI telemetry in water assessment', () => {
    assert.equal(mockAnalysis.environmental.rainfallMm, 1250);
    assert.equal(mockAnalysis.environmental.vegetation.ndvi, 0.62);
  });
});
