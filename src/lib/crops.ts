// Chash Orbit — Crop Library
// Reference data for common crops used in rotation recommendations.
// Values are illustrative agronomic attributes used by the decision engine
// to compute compatibility scores against NASA observations.

export type Demand = 'low' | 'medium' | 'high';
export type Tolerance = 'low' | 'medium' | 'high';
export type NitrogenEffect = 'fixer' | 'depleter' | 'neutral';
export type RootDepth = 'shallow' | 'medium' | 'deep';
export type Season = 'kharif' | 'rabi' | 'summer' | 'year_round';

export interface CropSpec {
  name: string;
  family: string;
  season: Season;
  /**
   * Calendar months (1-12) when this crop is typically planted in the
   * Northern Hemisphere. For the Southern Hemisphere the engine shifts
   * these by +6 months automatically.
   */
  plantingMonths: number[];
  /**
   * Calendar months (1-12) when this crop is typically harvested in the
   * Northern Hemisphere. Shifted by +6 for the Southern Hemisphere.
   */
  harvestMonths: number[];
  /**
   * Approximate growing duration in days — used by the planner to show
   * expected timelines.
   */
  growingDays: number;
  waterDemand: Demand;
  waterMm: number;          // seasonal water need (mm)
  rootDepth: RootDepth;
  nitrogenEffect: NitrogenEffect;
  heatTolerance: Tolerance;
  droughtTolerance: Tolerance;
  floodTolerance: Tolerance;
  growTempMin: number;     // °C
  growTempMax: number;     // °C
  baseIncome: number;      // relative profitability index 1-100
  soilBenefits: string;
}

// ── Crop library ────────────────────────────────────────────────────────────
// plantingMonths / harvestMonths are Northern Hemisphere calendar months (1-12).
// The engine shifts them by +6 for the Southern Hemisphere automatically.
export const CROP_LIBRARY: CropSpec[] = [
  {
    name: 'Rice', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [10, 11], growingDays: 120,
    waterDemand: 'high', waterMm: 1100, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'low',
    floodTolerance: 'high', growTempMin: 20, growTempMax: 35, baseIncome: 72,
    soilBenefits: 'Builds organic matter under flooded paddy; depletes nitrogen.',
  },
  {
    name: 'Wheat', family: 'Poaceae', season: 'rabi',
    plantingMonths: [11, 12], harvestMonths: [3, 4], growingDays: 130,
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 68,
    soilBenefits: 'Staple cereal; responds well to residual nitrogen from legumes.',
  },
  {
    name: 'Maize', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 100,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 35, baseIncome: 70,
    soilBenefits: 'Deep rooting improves soil structure; high nitrogen demand.',
  },
  {
    name: 'Potato', family: 'Solanaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 110,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'low', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 85,
    soilBenefits: 'High-value tuber; loosens compacted surface soil.',
  },
  {
    name: 'Tomato', family: 'Solanaceae', season: 'kharif',
    plantingMonths: [6, 7, 8], harvestMonths: [9, 10, 11], growingDays: 90,
    waterDemand: 'medium', waterMm: 600, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 18, growTempMax: 30, baseIncome: 80,
    soilBenefits: 'High-value vegetable; needs steady moisture and good drainage.',
  },
  {
    name: 'Chickpea', family: 'Fabaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 110,
    waterDemand: 'low', waterMm: 250, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 30, baseIncome: 75,
    soilBenefits: 'Nitrogen-fixing legume; improves soil fertility for following cereal.',
  },
  {
    name: 'Lentil', family: 'Fabaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 120,
    waterDemand: 'low', waterMm: 220, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'medium', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 72,
    soilBenefits: 'Nitrogen-fixing legume; suits rainfed rabi systems.',
  },
  {
    name: 'Soybean', family: 'Fabaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 100,
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 35, baseIncome: 78,
    soilBenefits: 'Nitrogen-fixing; improves soil structure; versatile oilseed/legume.',
  },
  {
    name: 'Sorghum', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [10, 11], growingDays: 120,
    waterDemand: 'low', waterMm: 300, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 60,
    soilBenefits: 'Deep roots break hardpans; very drought tolerant.',
  },
  {
    name: 'Millet', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 80,
    waterDemand: 'low', waterMm: 250, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 55,
    soilBenefits: 'Short-season cereal; thrives on marginal soils.',
  },
  {
    name: 'Mung', family: 'Fabaceae', season: 'summer',
    plantingMonths: [3, 4], harvestMonths: [5, 6], growingDays: 65,
    waterDemand: 'low', waterMm: 200, rootDepth: 'shallow',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 36, baseIncome: 65,
    soilBenefits: 'Fast nitrogen-fixing cover/relay crop; short cycle fits between cereals.',
  },
  {
    name: 'Mustard', family: 'Brassicaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 120,
    waterDemand: 'low', waterMm: 280, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 76,
    soilBenefits: 'Oilseed; taproot opens subsoil; breaks some cereal disease cycles.',
  },
  {
    name: 'Cotton', family: 'Malvaceae', season: 'kharif',
    plantingMonths: [5, 6], harvestMonths: [10, 11, 12], growingDays: 160,
    waterDemand: 'medium', waterMm: 600, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 38, baseIncome: 82,
    soilBenefits: 'Deep taproot exploits subsoil moisture; long season crop.',
  },
  {
    name: 'Vegetables', family: 'Mixed', season: 'year_round',
    plantingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], growingDays: 90,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 32, baseIncome: 88,
    soilBenefits: 'High-value; needs reliable irrigation and fertile soil.',
  },
  {
    name: 'Fruit', family: 'Mixed', season: 'year_round',
    plantingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], growingDays: 180,
    waterDemand: 'medium', waterMm: 700, rootDepth: 'deep',
    nitrogenEffect: 'neutral', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 35, baseIncome: 90,
    soilBenefits: 'Perennial; long-term soil cover; needs steady water.',
  },
];

export function getCropByName(name: string): CropSpec | undefined {
  return CROP_LIBRARY.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function listCropNames(): string[] {
  return CROP_LIBRARY.map(c => c.name);
}

// ── Season helpers ─────────────────────────────────────────────────────────
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Return planting months adjusted for hemisphere. For the Southern Hemisphere
 * (lat < 0), shift each NH month by +6 (wrapping). For year-round crops or
 * Northern Hemisphere, return as-is.
 */
export function getAdjustedPlantingMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') return crop.plantingMonths;
  if (lat >= 0) return crop.plantingMonths;
  // Southern Hemisphere: shift by 6 months
  return crop.plantingMonths.map(m => ((m + 5) % 12) + 1);
}

/** Return harvest months adjusted for hemisphere. */
export function getAdjustedHarvestMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') return crop.harvestMonths;
  if (lat >= 0) return crop.harvestMonths;
  return crop.harvestMonths.map(m => ((m + 5) % 12) + 1);
}

/** Is the current calendar month within ±1 of the crop's planting window? */
export function isCurrentlyPlantable(crop: CropSpec, lat: number, month?: number): boolean {
  const currentMonth = month ?? (new Date().getMonth() + 1); // 1-12
  const plantingMs = getAdjustedPlantingMonths(crop, lat);
  // Allow ±1 month tolerance around the planting window
  for (const pm of plantingMs) {
    const dist = Math.min(
      Math.abs(currentMonth - pm),
      12 - Math.abs(currentMonth - pm),
    );
    if (dist <= 1) return true;
  }
  return false;
}

/** Calendar months from typical planting through harvest (hemisphere-adjusted). */
export function getGrowingWindowMonths(crop: CropSpec, lat: number): number[] {
  if (crop.season === 'year_round') {
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  }
  const plantMonths = getAdjustedPlantingMonths(crop, lat);
  const harvestMonths = getAdjustedHarvestMonths(crop, lat);
  const allMonths = new Set<number>();
  if (plantMonths.length >= 1 && harvestMonths.length >= 1) {
    let m = plantMonths[0]!;
    const end = harvestMonths[harvestMonths.length - 1]!;
    for (let i = 0; i < 12; i++) {
      allMonths.add(m);
      if (m === end) break;
      m = (m % 12) + 1;
    }
  }
  plantMonths.forEach(pm => allMonths.add(pm));
  harvestMonths.forEach(hm => allMonths.add(hm));
  return Array.from(allMonths).sort((a, b) => a - b);
}

/** Is the current calendar month within the crop's growing or planting window? */
export function isInGrowingWindow(crop: CropSpec, lat: number, month?: number): boolean {
  const currentMonth = month ?? (new Date().getMonth() + 1);
  return getGrowingWindowMonths(crop, lat).includes(currentMonth);
}

/** Is the current month within ±1 of the crop's harvest window? */
export function isInHarvestWindow(crop: CropSpec, lat: number, month?: number): boolean {
  if (crop.season === 'year_round') return true;
  const currentMonth = month ?? (new Date().getMonth() + 1);
  const harvestMs = getAdjustedHarvestMonths(crop, lat);
  for (const hm of harvestMs) {
    const dist = Math.min(
      Math.abs(currentMonth - hm),
      12 - Math.abs(currentMonth - hm),
    );
    if (dist <= 1) return true;
  }
  return false;
}

/**
 * Human-readable planting season label, e.g. "Jun–Jul" or "Oct–Nov".
 * Adjusted for hemisphere.
 */
export function getPlantingLabel(crop: CropSpec, lat: number): string {
  const ms = getAdjustedPlantingMonths(crop, lat);
  if (ms.length === 12) return 'Year-round';
  if (ms.length === 0) return 'Unknown';
  const first = MONTH_ABBR[ms[0] - 1];
  const last = MONTH_ABBR[ms[ms.length - 1] - 1];
  return first === last ? first : `${first}–${last}`;
}

/** Human-readable harvest season label. */
export function getHarvestLabel(crop: CropSpec, lat: number): string {
  const ms = getAdjustedHarvestMonths(crop, lat);
  if (ms.length === 12) return 'Year-round';
  if (ms.length === 0) return 'Unknown';
  const first = MONTH_ABBR[ms[0] - 1];
  const last = MONTH_ABBR[ms[ms.length - 1] - 1];
  return first === last ? first : `${first}–${last}`;
}

/**
 * Returns the number of months until the next planting window. 0 means
 * the crop is plantable right now.
 */
export function monthsUntilPlanting(crop: CropSpec, lat: number, month?: number): number {
  const currentMonth = month ?? (new Date().getMonth() + 1);
  const plantMonths = getAdjustedPlantingMonths(crop, lat);
  if (plantMonths.length === 12) return 0;
  let minDist = 12;
  for (const pm of plantMonths) {
    const dist = pm >= currentMonth ? pm - currentMonth : 12 - currentMonth + pm;
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// Used by the onboarding form
export const ONBOARDING_CROP_OPTIONS = [
  'Rice', 'Wheat', 'Maize', 'Potato', 'Tomato', 'Chickpea', 'Lentil',
  'Soybean', 'Sorghum', 'Millet', 'Mung', 'Mustard', 'Cotton',
  'Vegetables', 'Fruit', 'Other',
];

// ── Soil texture reference ─────────────────────────────────────────────────
export const SOIL_TYPES = ['unknown', 'sandy', 'loamy', 'clay'] as const;
export type SoilType = typeof SOIL_TYPES[number];

export const IRRIGATION_TYPES = ['rainfed', 'limited', 'reliable'] as const;
export type IrrigationType = typeof IRRIGATION_TYPES[number];

// Infer a default soil type from regional / climatic signals when farmer
// doesn't know it. This is a derived estimate, never claimed as NASA data.
export function inferSoilType(lat: number, _lng: number): SoilType {
  // Coarse heuristic used only when farmer selects "I don't know":
  //   - humid tropical belts (|lat| < 23) → clay-leaning
  //   - subtropical alluvial belts (23-30) → loamy
  //   - arid / temperate (>30) → sandy-leaning
  const absLat = Math.abs(lat);
  if (absLat < 23) return 'clay';
  if (absLat < 30) return 'loamy';
  return 'sandy';
}

// ── Database seed ───────────────────────────────────────────────────────────
export async function seedCrops(db: import('@prisma/client').PrismaClient): Promise<void> {
  for (const crop of CROP_LIBRARY) {
    await db.crop.upsert({
      where: { name: crop.name },
      create: {
        name: crop.name,
        family: crop.family,
        season: crop.season,
        waterDemand: crop.waterDemand,
        waterMm: crop.waterMm,
        rootDepth: crop.rootDepth,
        nitrogenEffect: crop.nitrogenEffect,
        heatTolerance: crop.heatTolerance,
        droughtTolerance: crop.droughtTolerance,
        floodTolerance: crop.floodTolerance,
        growTempMin: crop.growTempMin,
        growTempMax: crop.growTempMax,
        baseIncome: crop.baseIncome,
        soilBenefits: crop.soilBenefits,
      },
      update: {
        family: crop.family,
        season: crop.season,
        waterDemand: crop.waterDemand,
        waterMm: crop.waterMm,
        rootDepth: crop.rootDepth,
        nitrogenEffect: crop.nitrogenEffect,
        heatTolerance: crop.heatTolerance,
        droughtTolerance: crop.droughtTolerance,
        floodTolerance: crop.floodTolerance,
        growTempMin: crop.growTempMin,
        growTempMax: crop.growTempMax,
        baseIncome: crop.baseIncome,
        soilBenefits: crop.soilBenefits,
      },
    });
  }
}
