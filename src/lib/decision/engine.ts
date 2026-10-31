// Chash Orbit — Decision engine
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
  isCurrentlyPlantable,
  isInHarvestWindow,
  getPlantingLabel,
  getHarvestLabel,
  monthsUntilPlanting,
  getAdjustedPlantingMonths,
  getGrowingWindowMonths,
} from '@/lib/crops';
import { aggregateMonths, buildMonthlyClimatology } from '@/lib/nasa/climatology';
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
  seasonFit: number;     // 0..100 — how well the current time matches planting window
  overallFit: number;
  reasons: string[];
  /** Human-readable planting season, e.g. "Jun–Jul" */
  plantingSeason: string;
  /** Human-readable harvest season, e.g. "Oct–Nov" */
  harvestSeason: string;
  /** Whether this crop can be planted right now (±1 month tolerance) */
  isPlantableNow: boolean;
  /** Months until the next planting window (0 = now) */
  monthsUntilPlant: number;
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
  /** When to plant this crop, e.g. "Jun–Jul" */
  plantingSeason: string;
  /** When to harvest, e.g. "Oct–Nov" */
  harvestSeason: string;
  /** Approximate growing duration in days */
  growingDays: number;
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
  // Drought risk: low soil moisture + seasonal deficit + low growing-season rain.
  // Continuous ramps (not 0/15/30/50 steps) so a small change in the input moves
  // the score a little, and What-if sliders respond smoothly.
  const smDeficit = env.soilMoisture.seasonalDeficit;
  const drought = clamp(
    50 * ramp(45 - env.soilMoisture.currentPct, 0, 30) +      // dry root zone: full weight at <=15 %
    30 * ramp(smDeficit, 25, 125) +                            // shortfall vs crop demand
    20 * (1 - ramp(env.rainfall.growingSeasonRainfall, 100, 300)), // little rain in the last 90 days
    0, 100,
  );
  // Flood risk: rain-heavy, erratic, or already saturated.
  const flood = clamp(
    35 * ramp(env.rainfall.variability, 5, 12) +
    25 * ramp(env.rainfall.growingSeasonRainfall, 400, 800) +
    40 * ramp(env.soilMoisture.currentPct, 70, 95),
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

/** 0 at or below `lo`, 1 at or above `hi`, linear in between. */
function ramp(v: number, lo: number, hi: number): number {
  return clamp((v - lo) / (hi - lo), 0, 1);
}

/** NASA POWER stats during this crop's planting→harvest months (not “last 90 days”). */
function cropWindowSignals(crop: CropSpec, env: Environment, lat: number) {
  const power = env.rawPower;
  if (!power?.series.dates.length) {
    return {
      tempAvgC: env.temperature.growingSeasonAvg,
      rainMm: env.rainfall.growingSeasonRainfall,
      heatStressDays: env.temperature.heatStressDays,
      fromCropWindow: false as const,
    };
  }
  const months = getGrowingWindowMonths(crop, lat);
  const clim = buildMonthlyClimatology(power.series);
  const agg = aggregateMonths(clim, months);
  if (agg.monthsUsed === 0 || Number.isNaN(agg.tempAvgC)) {
    return {
      tempAvgC: env.temperature.growingSeasonAvg,
      rainMm: env.rainfall.growingSeasonRainfall,
      heatStressDays: env.temperature.heatStressDays,
      fromCropWindow: false as const,
    };
  }
  return {
    tempAvgC: agg.tempAvgC,
    rainMm: agg.rainMm,
    heatStressDays: agg.heatStressDays,
    fromCropWindow: true as const,
  };
}

function climateFit(crop: CropSpec, env: Environment, risks: Risks, lat: number): number {
  const window = cropWindowSignals(crop, env, lat);
  const t = window.tempAvgC;
  let tempScore: number;
  if (t >= crop.growTempMin && t <= crop.growTempMax) tempScore = 100;
  else if (t < crop.growTempMin) tempScore = clamp(100 - (crop.growTempMin - t) * 8, 0, 100);
  else tempScore = clamp(100 - (t - crop.growTempMax) * 8, 0, 100);

  // Heat stress during this crop's season (from POWER daily in those months)
  const heatThreshold = 20;
  const cropHeatRisk = clamp((window.heatStressDays / heatThreshold) * 100, 0, 100);
  const heatMap = { low: 0, medium: 0.5, high: 1 } as const;
  const heatScore = clamp(50 + heatMap[crop.heatTolerance] * 50 - cropHeatRisk * 0.4, 0, 100);

  const droughtMap = { low: 0, medium: 0.5, high: 1 } as const;
  const droughtScore = clamp(50 + droughtMap[crop.droughtTolerance] * 50 - risks.droughtRisk * 0.3, 0, 100);

  return Math.round(tempScore * 0.4 + heatScore * 0.3 + droughtScore * 0.3);
}

function waterFit(crop: CropSpec, env: Environment, irrigation: IrrigationType, risks: Risks, lat: number): number {
  const window = cropWindowSignals(crop, env, lat);
  const ratio = window.rainMm / Math.max(1, crop.waterMm);
  // Continuous version of the old 35 / 55 / 75 / 90 steps: 35 at <=0.4, 90 at >=1.2.
  const rainScore = 35 + 55 * ramp(ratio, 0.4, 1.2);

  const irrigUplift = irrigation === 'reliable' ? 25 : irrigation === 'limited' ? 12 : 0;

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

// ── Season/timing fit ───────────────────────────────────────────────────────
// Scores how well the current time of year matches the crop's planting window,
// adjusted for hemisphere. This is the key fix: crops should not be recommended
// outside their natural growing season.
function seasonFit(crop: CropSpec, lat: number): number {
  if (crop.season === 'year_round') return 80; // always reasonable
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const plantMonths = getAdjustedPlantingMonths(crop, lat);

  // Find the closest planting month (circular distance on 1-12)
  let minDist = 12;
  for (const pm of plantMonths) {
    const dist = Math.min(
      Math.abs(currentMonth - pm),
      12 - Math.abs(currentMonth - pm),
    );
    if (dist < minDist) minDist = dist;
  }

  // Score based on distance to the nearest planting month:
  //   0 months → 100 (perfect timing)
  //   1 month  → 75  (close enough — can still prepare)
  //   2 months → 50  (feasible with planning)
  //   3 months → 35  (need to wait)
  //   4+ months → 25 (wrong season entirely)
  if (minDist === 0) return 100;
  if (minDist === 1) return 75;
  if (minDist === 2) return 50;
  if (minDist === 3) return 35;
  return 25;
}

function buildReasons(
  c: CropSpec,
  scores: { climateFit: number; waterFit: number; soilFit: number; rotationFit: number; seasonFit: number },
  env: Environment,
  risks: Risks,
  lat: number,
): string[] {
  const reasons: string[] = [];

  const plantLabel = getPlantingLabel(c, lat);
  const harvestLabel = getHarvestLabel(c, lat);
  const plantable = isCurrentlyPlantable(c, lat);
  const harvesting = isInHarvestWindow(c, lat);

  if (plantable) {
    reasons.push(`${c.name} is in planting season now (plant ${plantLabel}) — good timing to start.`);
  } else if (harvesting) {
    reasons.push(`${c.name} is in harvest season (${harvestLabel}) — plan the next crop after harvest, not a new planting now.`);
  } else if (scores.seasonFit <= 35) {
    const mUntil = monthsUntilPlanting(c, lat);
    reasons.push(`${c.name} is out of season — planting window is ${plantLabel} (${mUntil} month${mUntil !== 1 ? 's' : ''} away). Consider for future planning.`);
  } else {
    reasons.push(`${c.name}'s planting season (${plantLabel}) is approaching — prepare soon.`);
  }

  const window = cropWindowSignals(c, env, lat);
  const rainNote = window.fromCropWindow
    ? `NASA POWER rainfall during ${c.name}'s season (~${Math.round(window.rainMm)} mm)`
    : `Field rainfall (${Math.round(env.rainfall.annualRainfall)} mm/year)`;

  if (scores.waterFit >= 75) reasons.push(`${rainNote} covers ${c.name}'s seasonal water need (~${c.waterMm} mm).`);
  else if (scores.waterFit < 55) reasons.push(`${c.name} needs ~${c.waterMm} mm in-season; ${rainNote} — irrigation may be important.`);

  const tempNote = window.fromCropWindow
    ? `Mean temperature during ${c.name}'s season (~${Math.round(window.tempAvgC)}°C, NASA POWER)`
    : `Recent mean temperature (~${Math.round(env.temperature.growingSeasonAvg)}°C, NASA POWER)`;

  if (scores.climateFit >= 75) reasons.push(`${tempNote} sits inside ${c.name}'s optimal window (${c.growTempMin}–${c.growTempMax}°C).`);
  else if (scores.climateFit < 55) reasons.push(`${tempNote} and heat-stress days in that window (${window.heatStressDays}) push ${c.name} outside its comfort zone.`);
  if (c.nitrogenEffect === 'fixer') reasons.push(`${c.name} fixes nitrogen — improves soil fertility for the following crop.`);
  if (c.droughtTolerance === 'high' && risks.droughtRisk > 50) reasons.push(`High drought tolerance fits the field's seasonal moisture deficit (${env.soilMoisture.seasonalDeficit} mm).`);
  if (c.floodTolerance === 'high' && risks.floodRisk > 50) reasons.push(`Tolerates wet spells — matches this field's rainfall variability (σ=${env.rainfall.variability}).`);
  return reasons.slice(0, 5);
}

// Weighted average of the fit sub-scores; priorities shift the emphasis.
// Income uses the crop's profitability index directly, rotation and season
// fit are constant-weight terms on top of the farmer's priorities.
// Season fit acts as a soft gate: out-of-season crops get significantly lower
// scores even if they'd otherwise be a perfect match.
function scoreCrop(crop: CropSpec, env: Environment, risks: Risks, inputs: FarmerInputs, soilType: SoilType) {
  const lat = inputs.latitude;
  const climateF = climateFit(crop, env, risks, lat);
  const waterF = waterFit(crop, env, inputs.irrigation, risks, lat);
  const soilF = soilFit(crop, soilType);
  const rotationF = rotationFit(crop, inputs.currentCrop ?? null);
  let seasonF = seasonFit(crop, lat);
  // Mid-harvest window: good for rotation planning, not for planting this crop now.
  if (!isCurrentlyPlantable(crop, lat) && isInHarvestWindow(crop, lat) && crop.season !== 'year_round') {
    seasonF = Math.min(seasonF, 40);
  }
  const { soil, water, climate, income } = inputs.priorities;
  const totalP = Math.max(1, soil + water + climate + income);

  const overall =
    (climateF * climate + waterF * water + soilF * soil + crop.baseIncome * income + rotationF * 10 + seasonF * 22) /
    (totalP + 10 + 22);
  return { climateF, waterF, soilF, rotationF, seasonF, overall };
}

export function computeCropCompatibility(inputs: FarmerInputs, env: Environment, risks: Risks): CropCompatibility[] {
  const soilType: SoilType = inputs.soilType === 'unknown' ? inferSoilType(inputs.latitude, inputs.longitude) : inputs.soilType;

  const allCrops = inputs.desiredCrops.length
    ? inputs.desiredCrops
        .map(n => getCropByName(n))
        .filter((c): c is CropSpec => !!c)
    : CROP_LIBRARY;

  return allCrops.map(crop => {
    const { climateF, waterF, soilF, rotationF, seasonF, overall } = scoreCrop(crop, env, risks, inputs, soilType);
    return {
      crop: crop.name,
      climateFit: climateF,
      waterFit: waterF,
      soilFit: soilF,
      rotationFit: rotationF,
      seasonFit: seasonF,
      overallFit: Math.round(clamp(overall, 0, 100)),
      reasons: buildReasons(crop, { climateFit: climateF, waterFit: waterF, soilFit: soilF, rotationFit: rotationF, seasonFit: seasonF }, env, risks, inputs.latitude),
      plantingSeason: getPlantingLabel(crop, inputs.latitude),
      harvestSeason: getHarvestLabel(crop, inputs.latitude),
      isPlantableNow: isCurrentlyPlantable(crop, inputs.latitude),
      monthsUntilPlant: monthsUntilPlanting(crop, inputs.latitude),
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
  const soilType = inputs.soilType === 'unknown' ? inferSoilType(inputs.latitude, inputs.longitude) : inputs.soilType;
  const all = CROP_LIBRARY.filter(c => !excluded.has(c.name)).map(crop => ({
    crop,
    ...scoreCrop(crop, env, risks, inputs, soilType),
  }));

  all.sort((a, b) => {
    const aPlant = isCurrentlyPlantable(a.crop, inputs.latitude) ? 1 : 0;
    const bPlant = isCurrentlyPlantable(b.crop, inputs.latitude) ? 1 : 0;
    if (bPlant !== aPlant) return bPlant - aPlant;
    return b.overall - a.overall;
  });
  return all.slice(0, 6).map((r, i) => {
    const c = r.crop;
    const window = cropWindowSignals(c, env, inputs.latitude);
    const plantLabel = getPlantingLabel(c, inputs.latitude);
    const harvestLabel = getHarvestLabel(c, inputs.latitude);
    let why = '';
    if (!isCurrentlyPlantable(c, inputs.latitude) && isInHarvestWindow(c, inputs.latitude)) {
      why = `${c.name} fits this field climatically, but harvest is typically ${harvestLabel} — use it in your rotation plan rather than planting now.`;
    } else if (!isCurrentlyPlantable(c, inputs.latitude) && r.seasonF <= 35) {
      why = `${c.name} matches NASA climate signals for its season (${plantLabel}), but planting is ${monthsUntilPlanting(c, inputs.latitude)} month(s) away — best for planner year 2+.`;
    } else if (r.waterF >= 80 && risks.droughtRisk > 50) {
      why = `${c.name} scores highly because this field shows seasonal water stress (${env.soilMoisture.seasonalDeficit} mm deficit) and ${c.name} has ${c.droughtTolerance} drought tolerance with low water demand (~${c.waterMm} mm).`;
    } else if (c.nitrogenEffect === 'fixer' && inputs.priorities.soil >= 25) {
      why = `${c.name} fixes nitrogen, improving soil fertility — matches your ${inputs.priorities.soil}% soil-health priority and the field's ${inferSoilType(inputs.latitude, inputs.longitude)} soil.`;
    } else if (r.climateF >= 80 && window.fromCropWindow) {
      why = `${c.name}'s optimal window (${c.growTempMin}–${c.growTempMax}°C) matches NASA POWER during its season (~${Math.round(window.tempAvgC)}°C, plant ${plantLabel}).`;
    } else if (r.overall >= 75) {
      why = `${c.name} balances climate, water, soil, and rotation for this field in its planting window (${plantLabel}).`;
    } else {
      why = `${c.name} is the next-best available option given this field's NASA signals — consider trialing a small area in ${plantLabel}.`;
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
  const seasonRank = (name: string) => {
    const c = CROP_LIBRARY.find(x => x.name === name);
    if (!c) return 0;
    if (isCurrentlyPlantable(c, inputs.latitude)) return 3;
    if (monthsUntilPlanting(c, inputs.latitude) <= +2) return 2;
    return 1;
  };
  const bySeasonThenScore = (names: string[]) =>
    [...names].sort((a, b) => {
      const sr = seasonRank(b) - seasonRank(a);
      if (sr !== 0) return sr;
      return (compat.find(c => c.crop === b)?.overallFit ?? 0) - (compat.find(c => c.crop === a)?.overallFit ?? 0);
    });

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
  const ordered = bySeasonThenScore(candidateOrder);
  const orderedTop = bySeasonThenScore(topCompat.length ? topCompat : candidateOrder);
  if (cur && cur.nitrogenEffect === 'depleter') {
    y1 = orderedTop.find(n => byName(n)?.nitrogenEffect === 'fixer')
      ?? ordered.find(n => byName(n)?.nitrogenEffect === 'fixer')
      ?? ordered[0];
  } else if (cur && cur.nitrogenEffect === 'fixer') {
    y1 = orderedTop.find(n => byName(n)?.nitrogenEffect === 'depleter')
      ?? ordered.find(n => byName(n)?.nitrogenEffect === 'depleter')
      ?? ordered[0];
  } else {
    y1 = ordered[0];
  }

  const pushYear = (year: number, cropName: string, cover: string | null, irrigation: RotationYear['irrigationLevel'], score: number, reason: string) => {
    if (!cropName) return;
    const spec = byName(cropName);
    years.push({
      year,
      crop: cropName,
      coverCrop: cover,
      irrigationLevel: irrigation,
      score,
      reason,
      plantingSeason: spec ? getPlantingLabel(spec, inputs.latitude) : 'Unknown',
      harvestSeason: spec ? getHarvestLabel(spec, inputs.latitude) : 'Unknown',
      growingDays: spec?.growingDays ?? 90,
    });
    used.push(cropName);
    families.push(spec?.family ?? 'Unknown');
  };

  if (y1) {
    const c = byName(y1)!;
    const reason = cur
      ? `Follows ${cur.name} (${cur.nitrogenEffect}). ${c.nitrogenEffect === 'fixer' ? c.name + ' fixes nitrogen, restoring fertility after the previous depleting crop.' : 'Rotates away from the previous family to break pest/disease cycles.'}`
      : `Best first-year match for this field's climate and water signals.`;
    pushYear(1, y1, null, inputs.irrigation === 'reliable' ? 'reliable' : inputs.irrigation === 'limited' ? 'limited' : 'rainfed', compat.find(c => c.crop === y1)?.overallFit ?? recommendations.find(r => r.crop === y1)?.score ?? 80, reason);
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
    pushYear(y, pick, cover, inputs.irrigation === 'reliable' ? 'reliable' : 'limited', compat.find(cc => cc.crop === pick)?.overallFit ?? recommendations.find(r => r.crop === pick)?.score ?? 75, reason);
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

  const rationale = `This 4-year rotation alternates nitrogen-fixing legumes (${years.filter(y => byName(y.crop)?.nitrogenEffect === 'fixer').map(y => y.crop).join(', ')}) with nitrogen-demanding cereals, weighted by your priorities (soil ${inputs.priorities.soil}%, water ${inputs.priorities.water}%, climate ${inputs.priorities.climate}%, income ${inputs.priorities.income}%).`;

  return {
    name: 'Chash Orbit Recommended Rotation',
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
