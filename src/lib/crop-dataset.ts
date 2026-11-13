// src/lib/crop-dataset.ts
// Comprehensive FAO EcoCrop dataset loader and agronomic indexing service.

import rawFaoCrops from '@/data/fao-crops.json' with { type: 'json' };
import type { CropSpec, Demand, NitrogenEffect, RootDepth, Season, Tolerance } from './crops/types';

export type CropCategory =
  | 'cereal'
  | 'pulse'
  | 'oilseed'
  | 'vegetable'
  | 'fruit'
  | 'tuber'
  | 'fiber'
  | 'cash_crop'
  | 'cover_crop';

export interface FaoCropSpec {
  id: string;
  name: string;
  scientificName: string;
  aliases: string[];
  family: string;
  category: CropCategory;
  season: Season;
  plantingMonths: number[];
  harvestMonths: number[];
  growingDays: [number, number]; // [minDays, maxDays]

  // FAO EcoCrop Cardinal Response Envelopes
  temp: {
    absMin: number;
    optMin: number;
    optMax: number;
    absMax: number;
  };
  water: {
    absMinMm: number;
    optMinMm: number;
    optMaxMm: number;
    absMaxMm: number;
  };

  rootDepth: RootDepth;
  nitrogenEffect: NitrogenEffect;
  soilTextures: ('sandy' | 'loamy' | 'clay')[];
  phRange: { min: number; optMin: number; optMax: number; max: number };

  tolerances: {
    heat: Tolerance;
    drought: Tolerance;
    flood: Tolerance;
    salinity: Tolerance;
  };

  baseIncome: number;
  soilBenefits: string;
  source?: 'FAO_ECOCROP' | 'AI_INFERRED';
}

// In-memory dynamic crops registry (holds AI-inferred or user-registered crops)
const DYNAMIC_CROPS: Map<string, FaoCropSpec> = new Map();

export const FAO_CROPS: FaoCropSpec[] = (rawFaoCrops as FaoCropSpec[]).map(c => ({
  ...c,
  source: 'FAO_ECOCROP' as const,
}));

/**
 * Register a newly inferred or custom crop into the active runtime pool.
 */
export function registerDynamicCrop(crop: FaoCropSpec): void {
  DYNAMIC_CROPS.set(crop.name.toLowerCase(), crop);
  for (const alias of crop.aliases) {
    DYNAMIC_CROPS.set(alias.toLowerCase(), crop);
  }
}

/**
 * Find a crop by exact name, normalized name, or alias.
 */
export function findFaoCrop(query: string): FaoCropSpec | undefined {
  if (!query || typeof query !== 'string') return undefined;
  const q = query.trim().toLowerCase();

  // Check dynamic runtime crops
  if (DYNAMIC_CROPS.has(q)) {
    return DYNAMIC_CROPS.get(q);
  }

  // Exact name match
  const exact = FAO_CROPS.find(c => c.name.toLowerCase() === q);
  if (exact) return exact;

  // Exact alias match
  const aliasMatch = FAO_CROPS.find(c => c.aliases.some(a => a.toLowerCase() === q));
  if (aliasMatch) return aliasMatch;

  // Fuzzy prefix / substring match
  const fuzzy = FAO_CROPS.find(
    c =>
      c.name.toLowerCase().includes(q) ||
      q.includes(c.name.toLowerCase()) ||
      c.aliases.some(a => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))
  );
  return fuzzy;
}

/**
 * Search crops by substring and optional category filter.
 */
export function searchFaoCrops(query = '', category?: CropCategory): FaoCropSpec[] {
  const q = query.trim().toLowerCase();
  const all = [...FAO_CROPS, ...Array.from(DYNAMIC_CROPS.values())];

  // Deduplicate by name
  const seen = new Set<string>();
  const unique = all.filter(c => {
    if (seen.has(c.name.toLowerCase())) return false;
    seen.add(c.name.toLowerCase());
    return true;
  });

  return unique.filter(crop => {
    if (category && crop.category !== category) return false;
    if (!q) return true;
    return (
      crop.name.toLowerCase().includes(q) ||
      crop.scientificName.toLowerCase().includes(q) ||
      crop.family.toLowerCase().includes(q) ||
      crop.aliases.some(a => a.toLowerCase().includes(q))
    );
  });
}

/**
 * Convert an FAO crop specification into the legacy CropSpec structure.
 * This guarantees 100% backwards compatibility with all existing decision,
 * recommendation, and UI systems.
 */
export function faoToLegacyCropSpec(fao: FaoCropSpec): CropSpec {
  // Infer water demand category from optMaxMm
  let waterDemand: Demand = 'medium';
  if (fao.water.optMaxMm < 450) waterDemand = 'low';
  else if (fao.water.optMaxMm > 900) waterDemand = 'high';

  return {
    name: fao.name,
    family: fao.family,
    season: fao.season,
    plantingMonths: fao.plantingMonths,
    harvestMonths: fao.harvestMonths,
    growingDays: Math.round((fao.growingDays[0] + fao.growingDays[1]) / 2),
    waterDemand,
    waterMm: Math.round((fao.water.optMinMm + fao.water.optMaxMm) / 2),
    rootDepth: fao.rootDepth,
    nitrogenEffect: fao.nitrogenEffect,
    heatTolerance: fao.tolerances.heat,
    droughtTolerance: fao.tolerances.drought,
    floodTolerance: fao.tolerances.flood,
    growTempMin: fao.temp.optMin,
    growTempMax: fao.temp.optMax,
    baseIncome: fao.baseIncome,
    soilBenefits: fao.soilBenefits,
    source: fao.name === 'Rice' ? 'BRRI/FAO' : fao.name === 'Wheat' || fao.name === 'Chickpea' ? 'BARI/FAO' : 'FAO EcoCrop',
    sourceCitation: fao.name === 'Rice'
      ? 'BRRI (Bangladesh Rice Research Institute) & FAO Irrigation and Drainage Paper 56'
      : fao.name === 'Wheat'
      ? 'BARI Wheat Research Centre & FAO 56'
      : 'FAO EcoCrop Database & Agronomic Specifications',
  };
}

/**
 * Full expanded list of crops as CropSpec items.
 */
export function getExpandedCropLibrary(): CropSpec[] {
  const all = [...FAO_CROPS, ...Array.from(DYNAMIC_CROPS.values())];
  const seen = new Set<string>();
  const list: CropSpec[] = [];

  for (const fao of all) {
    if (!seen.has(fao.name.toLowerCase())) {
      seen.add(fao.name.toLowerCase());
      list.push(faoToLegacyCropSpec(fao));
    }
  }
  return list;
}
