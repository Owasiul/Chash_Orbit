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
export const CROP_LIBRARY: CropSpec[] = [
  {
    name: 'Rice', family: 'Poaceae', season: 'kharif',
    waterDemand: 'high', waterMm: 1100, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'low',
    floodTolerance: 'high', growTempMin: 20, growTempMax: 35, baseIncome: 72,
    soilBenefits: 'Builds organic matter under flooded paddy; depletes nitrogen.',
  },
  {
    name: 'Wheat', family: 'Poaceae', season: 'rabi',
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 68,
    soilBenefits: 'Staple cereal; responds well to residual nitrogen from legumes.',
  },
  {
    name: 'Maize', family: 'Poaceae', season: 'kharif',
    waterDemand: 'medium', waterMm: 500, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 35, baseIncome: 70,
    soilBenefits: 'Deep rooting improves soil structure; high nitrogen demand.',
  },
  {
    name: 'Potato', family: 'Solanaceae', season: 'rabi',
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'low', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 85,
    soilBenefits: 'High-value tuber; loosens compacted surface soil.',
  },
  {
    name: 'Tomato', family: 'Solanaceae', season: 'kharif',
    waterDemand: 'medium', waterMm: 600, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 18, growTempMax: 30, baseIncome: 80,
    soilBenefits: 'High-value vegetable; needs steady moisture and good drainage.',
  },
  {
    name: 'Chickpea', family: 'Fabaceae', season: 'rabi',
    waterDemand: 'low', waterMm: 250, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 30, baseIncome: 75,
    soilBenefits: 'Nitrogen-fixing legume; improves soil fertility for following cereal.',
  },
  {
    name: 'Lentil', family: 'Fabaceae', season: 'rabi',
    waterDemand: 'low', waterMm: 220, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'medium', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 72,
    soilBenefits: 'Nitrogen-fixing legume; suits rainfed rabi systems.',
  },
  {
    name: 'Soybean', family: 'Fabaceae', season: 'kharif',
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 35, baseIncome: 78,
    soilBenefits: 'Nitrogen-fixing; improves soil structure; versatile oilseed/legume.',
  },
  {
    name: 'Sorghum', family: 'Poaceae', season: 'kharif',
    waterDemand: 'low', waterMm: 300, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 60,
    soilBenefits: 'Deep roots break hardpans; very drought tolerant.',
  },
  {
    name: 'Millet', family: 'Poaceae', season: 'kharif',
    waterDemand: 'low', waterMm: 250, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 55,
    soilBenefits: 'Short-season cereal; thrives on marginal soils.',
  },
  {
    name: 'Mung', family: 'Fabaceae', season: 'summer',
    waterDemand: 'low', waterMm: 200, rootDepth: 'shallow',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 36, baseIncome: 65,
    soilBenefits: 'Fast nitrogen-fixing cover/relay crop; short cycle fits between cereals.',
  },
  {
    name: 'Mustard', family: 'Brassicaceae', season: 'rabi',
    waterDemand: 'low', waterMm: 280, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 76,
    soilBenefits: 'Oilseed; taproot opens subsoil; breaks some cereal disease cycles.',
  },
  {
    name: 'Cotton', family: 'Malvaceae', season: 'kharif',
    waterDemand: 'medium', waterMm: 600, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 38, baseIncome: 82,
    soilBenefits: 'Deep taproot exploits subsoil moisture; long season crop.',
  },
  {
    name: 'Vegetables', family: 'Mixed', season: 'year_round',
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 32, baseIncome: 88,
    soilBenefits: 'High-value; needs reliable irrigation and fertile soil.',
  },
  {
    name: 'Fruit', family: 'Mixed', season: 'year_round',
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
