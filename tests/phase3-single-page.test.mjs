// Chash Orbit — Phase 3 Tests
// Verifies:
// 1. Executive verdict sentence synthesis from engine output
// 2. Risk dominance categorization (heat, drought, flood, stable)
// 3. Complete field output structure for single-page dashboard and print export

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function synthesizeVerdict(analysis) {
  const { recommendations, rotationPlan, risks, environment } = analysis;
  const firstCrop = rotationPlan?.years?.[0]?.crop ?? recommendations?.[0]?.crop ?? 'Pulse / Legume';
  const secondCrop = rotationPlan?.years?.[1]?.crop ?? recommendations?.[1]?.crop ?? 'Cereal';

  const { heatRisk = 0, droughtRisk = 0, floodRisk = 0 } = risks ?? {};
  const maxRisk = Math.max(heatRisk, droughtRisk, floodRisk);

  let riskLabel = '';
  let riskDetail = '';

  if (maxRisk === heatRisk && heatRisk >= 35) {
    riskLabel = 'Elevated heat stress';
    riskDetail = `${environment?.temperature?.heatStressDays ?? 12} heat-stress days (${heatRisk}/100)`;
  } else if (maxRisk === droughtRisk && droughtRisk >= 35) {
    riskLabel = 'Seasonal moisture deficit';
    riskDetail = `soil moisture deficit (${droughtRisk}/100)`;
  } else if (maxRisk === floodRisk && floodRisk >= 35) {
    riskLabel = 'Monsoon flood / waterlogging';
    riskDetail = `high rainfall intensity (${floodRisk}/100)`;
  } else {
    riskLabel = 'Low climate risk';
    riskDetail = `stable conditions (${maxRisk}/100)`;
  }

  return `Plant ${firstCrop} next, then ${secondCrop}; main risk: ${riskLabel} (${riskDetail}).`;
}

describe('Phase 3 — Single-Page Dashboard & Verdict Synthesis', () => {
  it('correctly synthesizes the one-sentence verdict with heat risk dominance', () => {
    const mockAnalysis = {
      recommendations: [{ crop: 'Lentil', score: 88, rank: 1, why: 'Excellent nitrogen fixation' }],
      rotationPlan: {
        years: [
          { year: 1, crop: 'Lentil', score: 88, reason: 'Restores nitrogen' },
          { year: 2, crop: 'Wheat', score: 85, reason: 'Utilizes fixed nitrogen' },
        ],
      },
      risks: { heatRisk: 55, droughtRisk: 20, floodRisk: 15 },
      environment: {
        temperature: { heatStressDays: 14 },
      },
    };

    const verdict = synthesizeVerdict(mockAnalysis);
    assert.equal(verdict, 'Plant Lentil next, then Wheat; main risk: Elevated heat stress (14 heat-stress days (55/100)).');
  });

  it('correctly identifies drought dominance in verdict synthesis', () => {
    const mockAnalysis = {
      recommendations: [{ crop: 'Chickpea', score: 84 }],
      rotationPlan: {
        years: [
          { year: 1, crop: 'Chickpea', score: 84 },
          { year: 2, crop: 'Sorghum', score: 80 },
        ],
      },
      risks: { heatRisk: 25, droughtRisk: 68, floodRisk: 10 },
      environment: { temperature: { heatStressDays: 3 } },
    };

    const verdict = synthesizeVerdict(mockAnalysis);
    assert.equal(verdict, 'Plant Chickpea next, then Sorghum; main risk: Seasonal moisture deficit (soil moisture deficit (68/100)).');
  });

  it('correctly identifies flood dominance in verdict synthesis', () => {
    const mockAnalysis = {
      recommendations: [{ crop: 'Rice', score: 82 }],
      rotationPlan: {
        years: [
          { year: 1, crop: 'Rice', score: 82 },
          { year: 2, crop: 'Mustard', score: 79 },
        ],
      },
      risks: { heatRisk: 20, droughtRisk: 15, floodRisk: 62 },
      environment: { temperature: { heatStressDays: 2 } },
    };

    const verdict = synthesizeVerdict(mockAnalysis);
    assert.equal(verdict, 'Plant Rice next, then Mustard; main risk: Monsoon flood / waterlogging (high rainfall intensity (62/100)).');
  });

  it('handles stable conditions when all risk scores are below threshold', () => {
    const mockAnalysis = {
      recommendations: [{ crop: 'Potato', score: 90 }],
      rotationPlan: {
        years: [
          { year: 1, crop: 'Potato', score: 90 },
          { year: 2, crop: 'Maize', score: 85 },
        ],
      },
      risks: { heatRisk: 18, droughtRisk: 15, floodRisk: 12 },
      environment: { temperature: { heatStressDays: 1 } },
    };

    const verdict = synthesizeVerdict(mockAnalysis);
    assert.equal(verdict, 'Plant Potato next, then Maize; main risk: Low climate risk (stable conditions (18/100)).');
  });
});
