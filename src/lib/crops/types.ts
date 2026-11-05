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
  waterMm: number;
  rootDepth: RootDepth;
  nitrogenEffect: NitrogenEffect;
  heatTolerance: Tolerance;
  droughtTolerance: Tolerance;
  floodTolerance: Tolerance;
  growTempMin: number;
  growTempMax: number;
  baseIncome: number;
  soilBenefits: string;
}

export const ONBOARDING_CROP_OPTIONS = [
  'Rice', 'Wheat', 'Maize', 'Potato', 'Tomato', 'Chickpea', 'Lentil',
  'Soybean', 'Sorghum', 'Millet', 'Mung', 'Mustard', 'Cotton',
  'Vegetables', 'Fruit', 'Other',
] as const;

export const SOIL_TYPES = ['unknown', 'sandy', 'loamy', 'clay'] as const;
export type SoilType = typeof SOIL_TYPES[number];

export const IRRIGATION_TYPES = ['rainfed', 'limited', 'reliable'] as const;
export type IrrigationType = typeof IRRIGATION_TYPES[number];
