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

export const CROP_LIBRARY: CropSpec[] = getExpandedCropLibrary();

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
