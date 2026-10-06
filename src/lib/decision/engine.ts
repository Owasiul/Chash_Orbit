// Field Shift — Decision engine
// Computes field risks, crop compatibility, recommendations, and rotation
// plans from the environment + farmer inputs. Scoring is transparent: every
// score is the weighted sum of sub-scores that map directly to NASA signals
// and crop library attributes.

import {
  CROP_LIBRARY,
  type CropSpec,
  getCropByName,
  inferSoilType,
  type IrrigationType,
  type SoilType,
} from '@/lib/crops';
import type { Environment } from '@/lib/nasa/environment';

export interface Risks {
  heatRisk: number;       // 0..100 (higher = worse)
  droughtRisk: number;
  floodRisk: number;
  soilMoistureDeficit: number;
  summary: string;
}

export interface FarmerPriorities {
  soil: number;     // 0..100
  water: number;
  climate: number;
  income: number;
}

export interface FarmerInputs {
  latitude: number;
  longitude: number;
  area?: number;
  areaUnit?: 'acres' | 'hectares';
  currentCrop?: string | null;
  desiredCrops: string[];
  irrigation: IrrigationType;
  soilType: SoilType;
  priorities: FarmerPriorities;
}

export interface CropCompatibility {
  crop: string;
  climateFit: number;    // 0..100
  waterFit: number;
  soilFit: number;
  rotationFit: number;
  overallFit: number;
  reasons: string[];
}

export interface Recommendation {
  rank: number;
  crop: string;
  score: number;
  why: string;
}

export interface RotationYear {
  year: number;
  crop: string;
  coverCrop: string | null;
  irrigationLevel: 'rainfed' | 'limited' | 'reliable' | null;
  score: number;
  reason: string;
}

export interface RotationPlan {
  name: string;
  overallScore: number;
  soilScore: number;
  waterScore: number;
  climateScore: number;
  incomeScore: number;
  years: RotationYear[];
  rationale: string;
}

export interface AnalysisResult {
  risks: Risks;
  cropCompatibility: CropCompatibility[];
  recommendations: Recommendation[];
  rotationPlan: RotationPlan;
}

// ── Risks ─────────────────────────────────────────────────────────────────
export function computeRisks(env: Environment): Risks {
  // Heat risk: heat stress days (last 90d) vs a soft threshold of ~20 days
  const heat = clamp((env.temperature.heatStressDays / 20) * 100, 0, 100);
  // Drought risk: low soil moisture + low growing-season rainfall
  const smDeficit = env.soilMoisture.seasonalDeficit;
  const drought = clamp(
    (env.soilMoisture.currentPct < 30 ? 50 : 0) +
    (smDeficit > 100 ? 30 : smDeficit > 50 ? 15 : 0) +
    (env.rainfall.growingSeasonRainfall < 200 ? 20 : 0),
    0, 100,
  );
  // Flood risk: high rainfall variability + high recent rainfall
  const flood = clamp(
    (env.rainfall.variability > 10 ? 35 : 0) +
    (env.rainfall.growingSeasonRainfall > 600 ? 25 : 0) +
    (env.soilMoisture.currentPct > 85 ? 40 : 0),
    0, 100,
  );
  const soilMoistureDeficit = Math.round(smDeficit);

  let summary = 'Field conditions are within normal ranges.';
  const issues: string[] = [];
  if (heat > 60) issues.push('moderate to high heat stress');
  if (drought > 60) issues.push('seasonal water stress');
  if (flood > 60) issues.push('flood exposure in wet spells');
  if (soilMoistureDeficit > 80) issues.push('soil moisture below crop demand during dry season');
  if (issues.length) summary = `Your field is experiencing ${issues.join(', ')}.`;

  return { heatRisk: Math.round(heat), droughtRisk: Math.round(drought), floodRisk: Math.round(flood), soilMoistureDeficit, summary };
}

// ── Crop compatibility ─────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function climateFit(crop: CropSpec, env: Environment, risks: Risks): number {
  // Temperature window match
  const t = env.temperature.growingSeasonAvg;
  let tempScore: number;
  if (t >= crop.growTempMin && t <= crop.growTempMax) tempScore = 100;
  else if (t < crop.growTempMin) tempScore = clamp(100 - (crop.growTempMin - t) * 8, 0, 100);
  else tempScore = clamp(100 - (t - crop.growTempMax) * 8, 0, 100);

  // Heat tolerance vs heat risk
  const heatMap = { low: 0, medium: 0.5, high: 1 } as const;
  const heatScore = clamp(50 + heatMap[crop.heatTolerance] * 50 - risks.heatRisk * 0.4, 0, 100);

  // Drought tolerance vs drought risk
  const droughtMap = { low: 0, medium: 0.5, high: 1 } as const;
  const droughtScore = clamp(50 + droughtMap[crop.droughtTolerance] * 50 - risks.droughtRisk * 0.3, 0, 100);

  return Math.round(tempScore * 0.4 + heatScore * 0.3 + droughtScore * 0.3);
}

function waterFit(crop: CropSpec, env: Environment, irrigation: IrrigationType, risks: Risks): number {
  // Annual rainfall vs crop water need (rough seasonal comparison)
  const annual = env.rainfall.annualRainfall;
  const ratio = annual / Math.max(1, crop.waterMm);
  let rainScore: number;
  if (ratio >= 1.2) rainScore = 90;
  else if (ratio >= 0.9) rainScore = 75;
  else if (ratio >= 0.6) rainScore = 55;
  else rainScore = 35;

  // Irrigation uplift
  const irrigUplift = irrigation === 'reliable' ? 25 : irrigation === 'limited' ? 12 : 0;

  // Flood tolerance vs flood risk
  const floodMap = { low: 0, medium: 0.5, high: 1 } as const;
  const floodScore = clamp(50 + floodMap[crop.floodTolerance] * 50 - risks.floodRisk * 0.3, 0, 100);

  return clamp(Math.round(rainScore * 0.5 + irrigUplift + floodScore * 0.3), 0, 100);
}

function soilFit(crop: CropSpec, soilType: SoilType): number {
  // root depth × texture fit
  const retentionMap = { sandy: 0, loamy: 1, clay: 0.7, unknown: 0.6 } as const;
  const retention = retentionMap[soilType];
  let rootScore = 70;
  if (crop.rootDepth === 'deep') rootScore = soilType === 'clay' ? 60 : 85;
  if (crop.rootDepth === 'shallow') rootScore = soilType === 'sandy' ? 55 : 80;
  if (crop.rootDepth === 'medium') rootScore = 75;

  // Nitrogen effect: legumes are forgiving on poorer soils
  const nitrogenScore = crop.nitrogenEffect === 'fixer' ? 90 : crop.nitrogenEffect === 'neutral' ? 75 : 60;

  return clamp(Math.round(rootScore * 0.55 + retention * 100 * 0.25 + nitrogenScore * 0.2), 0, 100);
}

function rotationFit(crop: CropSpec, currentCropName: string | null): number {
  if (!currentCropName) return 75;
  const cur = getCropByName(currentCropName);
  if (!cur) return 75;
  if (cur.family === crop.family) {
    // same family → disease/nitrogen penalty
    return crop.nitrogenEffect === 'fixer' ? 60 : 45;
  }
  // legume following cereal (or vice versa) is the gold rotation
  if (cur.nitrogenEffect === 'depleter' && crop.nitrogenEffect === 'fixer') return 95;
  if (cur.nitrogenEffect === 'fixer' && crop.nitrogenEffect === 'depleter') return 90;
  return 78;
}

function buildReasons(c: CropSpec, scores: { climateFit: number; waterFit: number; soilFit: number; rotationFit: number }, env: Environment, risks: Risks): string[] {
  const reasons: string[] = [];
  if (scores.waterFit >= 75) reasons.push(`Field rainfall (${Math.round(env.rainfall.annualRainfall)} mm/year) covers ${c.name}'s seasonal water need (${c.waterMm} mm).`);
  else if (scores.waterFit < 55) reasons.push(`${c.name} needs ~${c.waterMm} mm water; field rainfall averages ${Math.round(env.rainfall.annualRainfall)} mm/year, so irrigation is important.`);
  if (scores.climateFit >= 75) reasons.push(`Growing-season temperature (~${Math.round(env.temperature.growingSeasonAvg)}°C) sits inside ${c.name}'s optimal window (${c.growTempMin}–${c.growTempMax}°C).`);
  else if (scores.climateFit < 55) reasons.push(`Temperature / heat-stress days (${env.temperature.heatStressDays} in last 90 days) push ${c.name} outside its comfort zone.`);
  if (c.nitrogenEffect === 'fixer') reasons.push(`${c.name} fixes nitrogen — improves soil fertility for the following crop.`);
  if (c.droughtTolerance === 'high' && risks.droughtRisk > 50) reasons.push(`High drought tolerance fits the field's seasonal moisture deficit (${env.soilMoisture.seasonalDeficit} mm).`);
  if (c.floodTolerance === 'high' && risks.floodRisk > 50) reasons.push(`Tolerates wet spells — matches this field's rainfall variability (σ=${env.rainfall.variability}).`);
  return reasons.slice(0, 4);
}

export function computeCropCompatibility(inputs: FarmerInputs, env: Environment, risks: Risks): CropCompatibility[] {
  const soilType: SoilType = inputs.soilType === 'unknown' ? inferSoilType(inputs.latitude, inputs.longitude) : inputs.soilType;

  const allCrops = inputs.desiredCrops.length
    ? inputs.desiredCrops
        .map(n => getCropByName(n))
        .filter((c): c is CropSpec => !!c)
    : CROP_LIBRARY;

  const { soil, water, climate, income } = inputs.priorities;
  // normalize priorities (they should already sum to 100 but guard anyway)
  const totalP = Math.max(1, soil + water + climate + income);

  return allCrops.map(crop => {
    const climateF = climateFit(crop, env, risks);
    const waterF = waterFit(crop, env, inputs.irrigation, risks);
    const soilF = soilFit(crop, soilType);
    const rotationF = rotationFit(crop, inputs.currentCrop ?? null);
    // Weighted overall — priorities shift the emphasis
    const overall =
      (climateF * climate + waterF * water + soilF * soil +
       (income > 0 ? crop.baseIncome * (income / 100) : 0) +
       rotationF * 10) / (totalP + (income > 0 ? income : 0) + 10);
    return {
      crop: crop.name,
      climateFit: climateF,
      waterFit: waterF,
      soilFit: soilF,
      rotationFit: rotationF,
      overallFit: Math.round(clamp(overall, 0, 100)),
      reasons: buildReasons(crop, { climateFit: climateF, waterFit: waterF, soilFit: soilF, rotationFit: rotationF }, env, risks),
    };
  }).sort((a, b) => b.overallFit - a.overallFit);
}

// ── Recommendations ("What could grow well here?") ─────────────────────────
export function computeRecommendations(
  inputs: FarmerInputs,
  compat: CropCompatibility[],
  env: Environment,
  risks: Risks,
): Recommendation[] {
  // Consider the full library (excluding current crop) and rank by overall fit,
  // then write a "Why?" sentence that cites a specific data signal.
  const excluded = new Set([inputs.currentCrop ?? '']);
  const all = CROP_LIBRARY.filter(c => !excluded.has(c.name)).map(crop => {
    const climateF = climateFit(crop, env, risks);
    const waterF = waterFit(crop, env, inputs.irrigation, risks);
    const soilType = inputs.soilType === 'unknown' ? inferSoilType(inputs.latitude, inputs.longitude) : inputs.soilType;
    const soilF = soilFit(crop, soilType);
    const rotationF = rotationFit(crop, inputs.currentCrop ?? null);
    const { soil, water, climate, income } = inputs.priorities;
    const totalP = Math.max(1, soil + water + climate + income);
    const overall =
      (climateF * climate + waterF * water + soilF * soil +
       (income > 0 ? crop.baseIncome * (income / 100) : 0) +
       rotationF * 10) / (totalP + (income > 0 ? income : 0) + 10);
    return { crop: crop, climateF, waterF, soilF, rotationF, overall };
  });

  all.sort((a, b) => b.overall - a.overall);
  return all.slice(0, 6).map((r, i) => {
    const c = r.crop;
    let why = '';
    if (r.waterF >= 80 && risks.droughtRisk > 50) {
      why = `${c.name} scores highly because this field shows seasonal water stress (${env.soilMoisture.seasonalDeficit} mm deficit) and ${c.name} has ${c.droughtTolerance} drought tolerance with low water demand (~${c.waterMm} mm).`;
    } else if (c.nitrogenEffect === 'fixer' && inputs.priorities.soil >= 25) {
      why = `${c.name} fixes nitrogen, improving soil fertility — matches your ${inputs.priorities.soil}% soil-health priority and the field's ${inferSoilType(inputs.latitude, inputs.longitude)} soil.`;
    } else if (r.climateF >= 80) {
      why = `${c.name}'s optimal temperature window (${c.growTempMin}–${c.growTempMax}°C) matches the field's growing-season mean (${Math.round(env.temperature.growingSeasonAvg)}°C).`;
    } else if (r.overall >= 75) {
      why = `${c.name} balances well across climate, water, soil, and rotation fit for this field — no major mismatch.`;
    } else {
      why = `${c.name} is the next-best available option given this field's signals, but scores are moderate — consider trialing a small area.`;
    }
    return {
      rank: i + 1,
      crop: c.name,
      score: Math.round(r.overall),
      why,
    };
  });
}

// ── Rotation plan ──────────────────────────────────────────────────────────
export function buildRotationPlan(
  inputs: FarmerInputs,
  compat: CropCompatibility[],
  recommendations: Recommendation[],
): RotationPlan {
  // Strategy: pick 4 years that
  //   1) never repeat a crop family back-to-back
  //   2) alternate cereal ↔ legume to balance nitrogen
  //   3) include a cover/relay crop if soil-health priority is high
  //   4) emphasise the farmer's top compatibility picks first

  const desired = new Set(inputs.desiredCrops);
  const recs = recommendations.map(r => r.crop);
  const topCompat = compat.filter(c => desired.has(c.crop)).map(c => c.crop);
  const candidateOrder = [...topCompat, ...recs];

  // Library lookups
  const byName = (n: string) => CROP_LIBRARY.find(c => c.name === n);

  const years: RotationYear[] = [];
  const used: string[] = [];
  const families: string[] = [];

  // Year 1 — start with current crop's rotation counterpart (often a legume
  // after a cereal, or vice versa), else the top recommendation.
  const currentCropName = inputs.currentCrop && byName(inputs.currentCrop) ? inputs.currentCrop : null;
  const cur = currentCropName ? byName(currentCropName)! : null;
  let y1: string | null = null;
  if (cur && cur.nitrogenEffect === 'depleter') {
    y1 = topCompat.find(n => byName(n)?.nitrogenEffect === 'fixer')
      ?? candidateOrder.find(n => byName(n)?.nitrogenEffect === 'fixer')
      ?? candidateOrder[0];
  } else if (cur && cur.nitrogenEffect === 'fixer') {
    y1 = topCompat.find(n => byName(n)?.nitrogenEffect === 'depleter')
      ?? candidateOrder.find(n => byName(n)?.nitrogenEffect === 'depleter')
      ?? candidateOrder[0];
  } else {
    y1 = candidateOrder[0];
  }

  const pushYear = (year: number, cropName: string, cover: string | null, irrigation: RotationYear['irrigationLevel'], score: number, reason: string) => {
    if (!cropName) return;
    years.push({ year, crop: cropName, coverCrop: cover, irrigationLevel: irrigation, score, reason });
    used.push(cropName);
    families.push(byName(cropName)?.family ?? 'Unknown');
  };

  if (y1) {
    const c = byName(y1)!;
    const reason = cur
      ? `Follows ${cur.name} (${cur.nitrogenEffect}). ${c.nitrogenEffect === 'fixer' ? c.name + ' fixes nitrogen, restoring fertility after the previous depleting crop.' : 'Rotates away from the previous family to break pest/disease cycles.'}`
      : `Best first-year match for this field's climate and water signals.`;
    pushYear(1, y1, null, inputs.irrigation === 'reliable' ? 'reliable' : inputs.irrigation === 'limited' ? 'limited' : 'rainfed', compat.find(c => c.crop === y1)?.overallFit ?? 80, reason);
  }

  // Years 2-4 — alternate legume ↔ cereal, avoid repeating family
  for (let y = years.length + 1; y <= 4; y++) {
    const last = byName(used[used.length - 1]) ?? null;
    const lastFamily = families[families.length - 1];
    const wantFixer = last?.nitrogenEffect === 'depleter';

    let pick: string | null = candidateOrder.find(n => {
      const c = byName(n);
      if (!c) return false;
      if (c.family === lastFamily) return false;
      if (used.includes(n) && y !== 4) return false; // allow only in year 4 if needed
      return wantFixer ? c.nitrogenEffect === 'fixer' : c.nitrogenEffect === 'depleter';
    }) ?? null;

    // Fallback: anything with a different family
    if (!pick) {
      pick = candidateOrder.find(n => {
        const c = byName(n);
        return c && c.family !== lastFamily && !used.includes(n);
      }) ?? candidateOrder.find(n => byName(n)?.family !== lastFamily) ?? candidateOrder[0];
    }

    const c = byName(pick)!;
    const cover = (inputs.priorities.soil >= 30 && y === 4 && c.nitrogenEffect !== 'fixer')
      ? 'Mung / cover crop'
      : null;
    const reason = cover
      ? `${c.name} closes the rotation; a mung cover crop after harvest will fix nitrogen and protect the soil before the next cycle.`
      : c.nitrogenEffect === 'fixer'
        ? `${c.name} fixes nitrogen after a depleting cereal year, rebuilding soil fertility.`
        : `${c.name} rotates away from the previous family and uses residual nitrogen from the prior legume year.`;
    pushYear(y, pick, cover, inputs.irrigation === 'reliable' ? 'reliable' : 'limited', compat.find(cc => cc.crop === pick)?.overallFit ?? 75, reason);
  }

  // Aggregate scores
  const soilScore = Math.round(mean(years.map((_, i) => (byName(used[i])?.nitrogenEffect === 'fixer' ? 90 : 65))));
  const waterScore = Math.round(mean(years.map((_, i) => byName(used[i])?.waterDemand === 'low' ? 90 : byName(used[i])?.waterDemand === 'medium' ? 70 : 55)));
  const climateScore = Math.round(mean(years.map((_, i) => byName(used[i])?.heatTolerance === 'high' ? 85 : 65)));
  const incomeScore = Math.round(mean(years.map((_, i) => byName(used[i])?.baseIncome ?? 70)));
  const overallScore = Math.round(
    (soilScore * inputs.priorities.soil + waterScore * inputs.priorities.water +
     climateScore * inputs.priorities.climate + incomeScore * inputs.priorities.income) /
    Math.max(1, inputs.priorities.soil + inputs.priorities.water + inputs.priorities.climate + inputs.priorities.income),
  );

  const rationale = `This 4-year rotation alternates nitrogen-fixing legumes (${years.filter((_, i) => byName(used[i])?.nitrogenEffect === 'fixer').map((_, i) => used[i]).join(', ')}) with nitrogen-demanding cereals, weighted by your priorities (soil ${inputs.priorities.soil}%, water ${inputs.priorities.water}%, climate ${inputs.priorities.climate}%, income ${inputs.priorities.income}%).`;

  return {
    name: 'Field Shift Recommended Rotation',
    overallScore,
    soilScore,
    waterScore,
    climateScore,
    incomeScore,
    years,
    rationale,
  };
}

function mean(a: number[]): number {
  return a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
}

// ── Full analysis ──────────────────────────────────────────────────────────
export function analyze(inputs: FarmerInputs, env: Environment): AnalysisResult {
  const risks = computeRisks(env);
  const cropCompatibility = computeCropCompatibility(inputs, env, risks);
  const recommendations = computeRecommendations(inputs, cropCompatibility, env, risks);
  const rotationPlan = buildRotationPlan(inputs, cropCompatibility, recommendations);
  return { risks, cropCompatibility, recommendations, rotationPlan };
}
