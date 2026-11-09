import {
  findFaoCrop,
  faoToLegacyCropSpec,
  getExpandedCropLibrary,
} from '../crop-dataset';
import type { CropSpec } from './types';
import {
  getAdjustedHarvestMonths,
  getAdjustedPlantingMonths,
  getGrowingWindowMonths,
  getHarvestLabel,
  getPlantingLabel,
  isCurrentlyPlantable,
  isInGrowingWindow,
  isInHarvestWindow,
  monthsUntilPlanting,
} from './seasonality';
import { inferSoilType } from './soil';

export type { Demand, Tolerance, NitrogenEffect, RootDepth, Season } from './types';
export type { CropSpec, IrrigationType, SoilType } from './types';
export { ONBOARDING_CROP_OPTIONS, IRRIGATION_TYPES, SOIL_TYPES } from './types';
export {
  getAdjustedHarvestMonths,
  getAdjustedPlantingMonths,
  getGrowingWindowMonths,
  getHarvestLabel,
  getPlantingLabel,
  inferSoilType,
  isCurrentlyPlantable,
  isInGrowingWindow,
  isInHarvestWindow,
  monthsUntilPlanting,
};


export const BASELINE_CROPS: CropSpec[] = [
  {
    name: 'Rice', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [10, 11], growingDays: 120,
    waterDemand: 'high', waterMm: 1100, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'low',
    floodTolerance: 'high', growTempMin: 20, growTempMax: 35, baseIncome: 72,
    soilBenefits: 'Builds organic matter under flooded paddy; depletes nitrogen.',
    source: 'BRRI/FAO',
    sourceCitation: 'BRRI (Bangladesh Rice Research Institute) & FAO Irrigation and Drainage Paper 56',
  },
  {
    name: 'Wheat', family: 'Poaceae', season: 'rabi',
    plantingMonths: [11, 12], harvestMonths: [3, 4], growingDays: 130,
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 68,
    soilBenefits: 'Staple cereal; responds well to residual nitrogen from legumes.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Wheat Research Centre & FAO 56',
  },
  {
    name: 'Maize', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 100,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 35, baseIncome: 70,
    soilBenefits: 'Deep rooting improves soil structure; high nitrogen demand.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Maize Division & FAO 56',
  },
  {
    name: 'Potato', family: 'Solanaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 110,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'low', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 25, baseIncome: 85,
    soilBenefits: 'High-value tuber; loosens compacted surface soil.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Tuber Crops Research Centre (TCRC) & FAO 56',
  },
  {
    name: 'Tomato', family: 'Solanaceae', season: 'kharif',
    plantingMonths: [6, 7, 8], harvestMonths: [9, 10, 11], growingDays: 90,
    waterDemand: 'medium', waterMm: 600, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 18, growTempMax: 30, baseIncome: 80,
    soilBenefits: 'High-value vegetable; needs steady moisture and good drainage.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Horticulture Research Centre & FAO 56',
  },
  {
    name: 'Chickpea', family: 'Fabaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 110,
    waterDemand: 'low', waterMm: 250, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 30, baseIncome: 75,
    soilBenefits: 'Nitrogen-fixing legume; improves soil fertility for following cereal.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Pulses Research Centre & ICRISAT/FAO 56',
  },
  {
    name: 'Lentil', family: 'Fabaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 120,
    waterDemand: 'low', waterMm: 220, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'medium', droughtTolerance: 'high',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 72,
    soilBenefits: 'Nitrogen-fixing legume; suits rainfed rabi systems.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Pulses Research Centre & FAO 56',
  },
  {
    name: 'Soybean', family: 'Fabaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 100,
    waterDemand: 'medium', waterMm: 450, rootDepth: 'medium',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 35, baseIncome: 78,
    soilBenefits: 'Nitrogen-fixing; improves soil structure; versatile oilseed/legume.',
    source: 'BARI/FAO',
    sourceCitation: 'BARI Oilseed Research Centre & FAO 56',
  },
  {
    name: 'Sorghum', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [10, 11], growingDays: 120,
    waterDemand: 'low', waterMm: 300, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 60,
    soilBenefits: 'Deep roots break hardpans; very drought tolerant.',
    source: 'FAO',
    sourceCitation: 'ICRISAT & FAO Crop Water Management (Paper 56)',
  },
  {
    name: 'Millet', family: 'Poaceae', season: 'kharif',
    plantingMonths: [6, 7], harvestMonths: [9, 10], growingDays: 80,
    waterDemand: 'low', waterMm: 250, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'high',
    floodTolerance: 'medium', growTempMin: 20, growTempMax: 38, baseIncome: 55,
    soilBenefits: 'Short-season cereal; thrives on marginal soils.',
    source: 'FAO',
    sourceCitation: 'ICRISAT & FAO 56',
  },
  {
    name: 'Mung', family: 'Fabaceae', season: 'summer',
    plantingMonths: [3, 4], harvestMonths: [5, 6], growingDays: 65,
    waterDemand: 'low', waterMm: 200, rootDepth: 'shallow',
    nitrogenEffect: 'fixer', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 36, baseIncome: 65,
    soilBenefits: 'Fast nitrogen-fixing cover/relay crop; short cycle fits between cereals.',
    source: 'BARI',
    sourceCitation: 'BARI Pulses Research Centre & AVRDC/WorldVeg',
  },
  {
    name: 'Mustard', family: 'Brassicaceae', season: 'rabi',
    plantingMonths: [10, 11], harvestMonths: [2, 3], growingDays: 120,
    waterDemand: 'low', waterMm: 280, rootDepth: 'medium',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 10, growTempMax: 28, baseIncome: 76,
    soilBenefits: 'Oilseed; taproot opens subsoil; breaks some cereal disease cycles.',
    source: 'BARI',
    sourceCitation: 'BARI Oilseed Research Centre',
  },
  {
    name: 'Cotton', family: 'Malvaceae', season: 'kharif',
    plantingMonths: [5, 6], harvestMonths: [10, 11, 12], growingDays: 160,
    waterDemand: 'medium', waterMm: 600, rootDepth: 'deep',
    nitrogenEffect: 'depleter', heatTolerance: 'high', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 22, growTempMax: 38, baseIncome: 82,
    soilBenefits: 'Deep taproot exploits subsoil moisture; long season crop.',
    source: 'CDB/FAO',
    sourceCitation: 'Cotton Development Board (CDB) Bangladesh & FAO 56',
  },
  {
    name: 'Vegetables', family: 'Mixed', season: 'year_round',
    plantingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], growingDays: 90,
    waterDemand: 'medium', waterMm: 500, rootDepth: 'shallow',
    nitrogenEffect: 'depleter', heatTolerance: 'medium', droughtTolerance: 'low',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 32, baseIncome: 88,
    soilBenefits: 'High-value; needs reliable irrigation and fertile soil.',
    source: 'illustrative',
    sourceCitation: 'Illustrative composite agronomic profile',
  },
  {
    name: 'Fruit', family: 'Mixed', season: 'year_round',
    plantingMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], harvestMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], growingDays: 180,
    waterDemand: 'medium', waterMm: 700, rootDepth: 'deep',
    nitrogenEffect: 'neutral', heatTolerance: 'medium', droughtTolerance: 'medium',
    floodTolerance: 'low', growTempMin: 15, growTempMax: 35, baseIncome: 90,
    soilBenefits: 'Perennial; long-term soil cover; needs steady water.',
    source: 'illustrative',
    sourceCitation: 'Illustrative composite perennial profile',
  },
];

function buildMergedLibrary(): CropSpec[] {
  const map = new Map<string, CropSpec>();
  for (const c of BASELINE_CROPS) {
    map.set(c.name.toLowerCase(), c);
  }
  const expanded = getExpandedCropLibrary();
  for (const c of expanded) {
    if (!map.has(c.name.toLowerCase())) {
      map.set(c.name.toLowerCase(), c);
    }
  }
  return Array.from(map.values());
}

export const CROP_LIBRARY: CropSpec[] = buildMergedLibrary();


export function getCropByName(name: string): CropSpec | undefined {
  if (!name) return undefined;

  const match = CROP_LIBRARY.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (match) return match;

  const fao = findFaoCrop(name);
  if (fao) {
    return faoToLegacyCropSpec(fao);
  }

  return undefined;
}

export function listCropNames(): string[] {
  return CROP_LIBRARY.map(c => c.name);
}

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
