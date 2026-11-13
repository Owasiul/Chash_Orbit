import type { PowerAnalysis } from './power';


export type DataSource =
  | 'NASA_POWER'
  | 'NASA_GPM_IMERG'
  | 'NASA_SMAP'
  | 'NASA_MODIS'
  | 'DERIVED'
  | 'DEMO';

export type DataStatus =
  | 'live'
  | 'cached'
  | 'fallback'
  | 'unavailable';

export interface EnvironmentalObservation<T = number> {
  value: T;
  unit: string;
  source: DataSource;
  status: DataStatus;
  measurement: 'surface' | 'root-zone' | 'profile';
  confidence: 'high' | 'medium' | 'low';
  datasetName?: string;
  observationDate?: string;
  spatialResolution?: string;
}

export interface SoilMoistureDataQuality {
  validDays: number;
  missingDays: number;
  coveragePct: number;
  isReliable: boolean;
}

export interface CropGrowthStage {
  stage: 'initial' | 'development' | 'mid-season' | 'late-season';
  durationDays: number;
  kc: number;
}

export interface SoilMoistureAnalysis {
  // Root-zone storage (top ~1 metre)
  rootZoneWaterMm: number;
  rootZoneWaterPct: number;
  rootZoneCapacityMm: number;

  // Backward compatibility aliases
  /** @deprecated Use rootZoneWaterMm to clarify layer distinction. */
  currentMm?: number;
  /** @deprecated Use rootZoneWaterPct to clarify layer distinction. */
  currentPct?: number;

  // NASA POWER Model Assimilation Layers
  surfaceSoilWetnessPct?: number | null; // GWETTOP (0-5cm)
  rootZoneSoilWetnessPct?: number | null; // GWETROOT (~1m)
  profileSoilWetnessPct?: number | null; // GWETPROF (full profile)

  // Evapotranspiration metrics
  referenceEtMmPerDay: number;
  cropEtMmPerDay: number;
  totalGrowingSeasonEtcMm: number;

  // Crop-stage water deficit
  seasonalDeficit: number;
  effectiveRainfallMm: number;

  // Separate, honest trend exposure
  rainfallTrendMmPerYear: number | null;
  soilMoistureTrendPctPerYear: number | null; // null until direct SMAP time-series is active
  /** @deprecated Replaced by rainfallTrendMmPerYear & soilMoistureTrendPctPerYear */
  tenYearTrend?: number | null;

  source: DataSource;
  status: DataStatus;
  attribution: string;
  resolution?: string;
  dataQuality: SoilMoistureDataQuality;
  /** True when rootZoneWaterPct comes from NASA POWER GWETROOT instead of the water-balance model. */
  measured?: boolean;
}

export interface SoilCondition {
  texture: 'sandy' | 'loamy' | 'clay' | 'unknown';
  organicMatter: 'low' | 'medium' | 'high';
  organicMatterProxyConfidence: 'low' | 'medium';
  organicMatterProxyNote: string;
  moistureCondition: 'deficit' | 'adequate' | 'surplus';
  nitrogenBalance: 'depleting' | 'stable' | 'building';
  nitrogenRotationNote: string;
  erosionRisk: 'low' | 'medium' | 'high';
  erosionRiskFactors: {
    slopeFactor: string;
    vegetationCoverFactor: string;
    rainfallIntensityFactor: string;
  };
  waterRetention: 'low' | 'medium' | 'high' | 'unknown';
  source: DataSource;
  attribution: string;
}

// ─────────────────────────────────────────────
// Soil Capacity & Texture Modeling
// ─────────────────────────────────────────────

export function getAvailableWaterCapacity(
  texture: 'sandy' | 'loamy' | 'clay' | 'unknown',
  rootingDepthM = 1.0
): number {
  // Available Water Capacity (mm/m):
  // Sandy: ~90 mm/m, Loamy: ~160 mm/m, Clay: ~190 mm/m, Unknown: 150 mm/m standard
  const awcTable: Record<string, number> = {
    sandy: 90,
    loamy: 160,
    clay: 190,
    unknown: 150,
  };
  const awc = awcTable[texture] || 150;
  return Math.round(awc * rootingDepthM);
}

// ─────────────────────────────────────────────
// Evapotranspiration Calculations
// ─────────────────────────────────────────────

/**
 * Calculates extraterrestrial radiation (Ra) in mm/day equivalent from latitude and DOY (FAO-56)
 */
function calculateExtraterrestrialRadiation(latDeg: number, dayOfYear: number): number {
  const latRad = (latDeg * Math.PI) / 180.0;
  const delta = 0.409 * Math.sin(((2 * Math.PI) / 365.0) * dayOfYear - 1.39);
  const tanTan = -Math.tan(latRad) * Math.tan(delta);
  const ws = Math.acos(Math.max(-1.0, Math.min(1.0, tanTan)));
  const dr = 1 + 0.033 * Math.cos(((2 * Math.PI) / 365.0) * dayOfYear);
  // Gsc = 0.0820 MJ/m2/min
  const raMj = ((24 * 60) / Math.PI) * 0.082 * dr * (
    ws * Math.sin(latRad) * Math.sin(delta) +
    Math.cos(latRad) * Math.cos(delta) * Math.sin(ws)
  );
  return 0.408 * Math.max(0, raMj);
}

/**
 * Reference Evapotranspiration (ET0) using NASA POWER solar radiation + temperature
 */
export function calculateReferenceET0(
  tMean: number,
  tMax: number | null,
  tMin: number | null,
  solarRadMJ: number | null,
  latDeg: number,
  dayOfYear: number
): number {
  // Option 1A: FAO-56 Radiation Method using NASA POWER ALLSKY_SFC_SW_DWN (MJ/m2/day)
  if (Number.isFinite(solarRadMJ) && (solarRadMJ as number) > 0 && Number.isFinite(tMean)) {
    const delta = (4098 * (0.6108 * Math.exp((17.27 * tMean) / (tMean + 237.3)))) / Math.pow(tMean + 237.3, 2);
    const gamma = 0.067; // Psychrometric constant (kPa/°C)
    const et0 = 0.408 * (delta / (delta + gamma)) * (solarRadMJ as number);
    return Math.max(0.5, Math.min(15.0, et0));
  }

  // Option 1B: Full Hargreaves-Samani method with Ra and Diurnal Range
  const ra = calculateExtraterrestrialRadiation(latDeg, dayOfYear);
  if (Number.isFinite(tMax) && Number.isFinite(tMin) && Number.isFinite(tMean) && (tMax as number) > (tMin as number)) {
    const td = Math.max(0.5, (tMax as number) - (tMin as number));
    const et0 = 0.0023 * (tMean + 17.8) * Math.sqrt(td) * ra;
    return Math.max(0.5, Math.min(15.0, et0));
  }

  // Fallback: Modified Temperature-Ra method with assumed diurnal range
  if (Number.isFinite(tMean)) {
    const assumedTd = 10.0;
    const et0 = 0.0023 * (tMean + 17.8) * Math.sqrt(assumedTd) * ra;
    return Math.max(0.5, Math.min(12.0, et0));
  }

  return 3.0; // Default climatological reference
}

// ─────────────────────────────────────────────
// Robust Root-Zone Water-Balance Model
// ─────────────────────────────────────────────

interface WaterBalanceResult {
  store: number[];
  validDays: number;
  missingDays: number;
  coveragePct: number;
  isReliable: boolean;
  dailyEtc: number[];
}

function waterBalance(
  prec: number[],
  t2m: number[],
  capacity = 150,
  kc = 1.0,
  latitude = 23.8,
  dates: string[] = []
): WaterBalanceResult {
  const store: number[] = [];
  const dailyEtc: number[] = [];
  let bucket = capacity * 0.5; // Start at 50% available capacity
  let validDays = 0;
  let missingDays = 0;

  for (let i = 0; i < prec.length; i++) {
    const p = prec[i];
    const t = t2m[i];

    // Do NOT treat missing observations as zero or guess 2 mm/day PET
    if (!Number.isFinite(p) || !Number.isFinite(t)) {
      missingDays++;
      store.push(bucket);
      dailyEtc.push(0);
      continue;
    }

    validDays++;

    // Determine Day of Year from date string if present
    let doy = 180;
    if (dates[i] && dates[i].length >= 8) {
      const clean = dates[i].replace(/-/g, '');
      const d = new Date(Date.UTC(+clean.slice(0, 4), +clean.slice(4, 6) - 1, +clean.slice(6, 8)));
      const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
      doy = Math.floor((d.getTime() - start.getTime()) / 86400000);
    }

    const et0 = calculateReferenceET0(t, null, null, null, latitude, doy);
    const etc = et0 * kc;
    dailyEtc.push(etc);

    // Infiltration and storage constraint
    bucket = Math.max(0, Math.min(capacity, bucket + p - etc));
    store.push(bucket);
  }

  const total = prec.length || 1;
  const coveragePct = Math.round((validDays / total) * 1000) / 10;

  return {
    store,
    validDays,
    missingDays,
    coveragePct,
    isReliable: coveragePct >= 80,
    dailyEtc,
  };
}

// ─────────────────────────────────────────────
// Seasonal Water Deficit
// D = ETc - Peffective - I - DeltaS
// ─────────────────────────────────────────────

function calculateEffectiveRainfall(precipitationMm: number[]): number {
  let effective = 0;
  for (const p of precipitationMm) {
    if (Number.isFinite(p) && p > 2.0) {
      // USDA-SCS daily approximation: daily rain <= 2mm is lost to canopy interception & surface evaporation
      effective += Math.max(0, (p - 2.0) * 0.8);
    }
  }
  return Math.round(effective * 10) / 10;
}

/**
 * Replaces the modelled root-zone wetness with NASA POWER's measured GWETROOT
 * (last-7-day mean, 0..1) when it is available. The seasonal deficit stays modelled.
 */
export function applyMeasuredRootWetness(
  sm: SoilMoistureAnalysis,
  wetness: number | null,
  status: 'live' | 'cached',
): SoilMoistureAnalysis {
  if (typeof wetness !== 'number' || !Number.isFinite(wetness) || wetness < 0 || wetness > 1) return sm;
  const pct = Math.round(wetness * 1000) / 10;
  const mm = Math.round((pct / 100) * sm.rootZoneCapacityMm * 10) / 10;
  sm.rootZoneWaterPct = pct;
  sm.currentPct = pct;
  sm.rootZoneWaterMm = mm;
  sm.currentMm = mm;
  sm.rootZoneSoilWetnessPct = Math.round(pct);
  sm.measured = true;
  sm.source = 'NASA_POWER';
  sm.status = status;
  sm.attribution =
    'NASA POWER GWETROOT root-zone soil wetness (MERRA-2 reanalysis, last 7 days). ' +
    'Seasonal deficit comes from an FAO-56 water balance driven by rainfall and temperature.';
  return sm;
}

export function deriveSoilMoisture(
  power: PowerAnalysis,
  cropWaterMm: number,
  options: {
    soilTexture?: 'sandy' | 'loamy' | 'clay' | 'unknown';
    rootingDepthM?: number;
    cropKc?: number;
    latitude?: number;
    irrigationAppliedMm?: number;
    analysisDays?: number;
    /** NASA POWER GWETROOT (0..1), recent mean. Replaces the modelled root-zone wetness when present. */
    measuredRootWetness?: number | null;
  } = {}
): SoilMoistureAnalysis {
  const texture = options.soilTexture || 'unknown';
  const capacity = getAvailableWaterCapacity(texture, options.rootingDepthM || 1.0);
  const kc = options.cropKc || 1.0;
  const lat = options.latitude ?? 23.8;
  const irrigation = options.irrigationAppliedMm || 0;

  if (Number.isNaN(power.annualRainfall) || !power.series?.dates?.length) {
    return {
      rootZoneWaterMm: 0,
      rootZoneWaterPct: 0,
      rootZoneCapacityMm: capacity,
      currentMm: 0,
      currentPct: 0,
      referenceEtMmPerDay: 0,
      cropEtMmPerDay: 0,
      totalGrowingSeasonEtcMm: 0,
      seasonalDeficit: 0,
      effectiveRainfallMm: 0,
      rainfallTrendMmPerYear: null,
      soilMoistureTrendPctPerYear: null,
      tenYearTrend: null,
      source: 'DERIVED',
      status: 'unavailable',
      attribution: 'No NASA POWER observations available for this location.',
      resolution: '0.5° (~50 km derived water balance)',
      dataQuality: { validDays: 0, missingDays: 0, coveragePct: 0, isReliable: false },
    };
  }

  const s = power.series;
  const n = s.dates.length;
  const windowDays = Math.min(n, options.analysisDays || 90);
  const startIndex = Math.max(0, n - windowDays);

  const precSlice = s.prectotcorr.slice(startIndex);
  const t2mSlice = s.t2m.slice(startIndex);
  const datesSlice = s.dates.slice(startIndex);

  const wb = waterBalance(precSlice, t2mSlice, capacity, kc, lat, datesSlice);

  const modelledMm = wb.store.length ? wb.store[wb.store.length - 1] : 0;
  const w = options.measuredRootWetness;
  const measured = typeof w === 'number' && Number.isFinite(w) && w >= 0 && w <= 1;
  const currentPct = measured
    ? Math.round(w * 1000) / 10
    : Math.max(0, Math.min(100, (modelledMm / capacity) * 100));
  const currentMm = measured ? (currentPct / 100) * capacity : modelledMm;

  // Physical Water Deficit Equation: D = ETc - Peffective - I - DeltaS
  const totalEtc = wb.dailyEtc.reduce((a, b) => a + b, 0);
  const effectiveRainfall = calculateEffectiveRainfall(precSlice);
  const storageStart = wb.store[0] || (capacity * 0.5);
  const storageEnd = currentMm;
  const deltaStorage = storageStart - storageEnd; // Positive delta S indicates soil storage buffer supplied water

  const physicalDeficit = Math.max(0, totalEtc - effectiveRainfall - irrigation - deltaStorage);

  const avgEt0 = wb.dailyEtc.length ? totalEtc / (wb.dailyEtc.length * kc) : 0;
  const avgEtc = wb.dailyEtc.length ? totalEtc / wb.dailyEtc.length : 0;

  // NASA POWER Model-based Soil Wetness Parameters (Section 3.C)
  // Guard: a missing/JSON-null last value must read as null, never as 0 % wet
  // (null * 100 === 0 would report the soil as bone dry).
  const powerAny = power as any;
  const wetnessPct = (arr?: number[]): number | null => {
    if (!arr?.length) return null;
    const v = arr[arr.length - 1];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1
      ? Math.round(v * 100)
      : null;
  };
  const surfaceWetness = wetnessPct(powerAny.series?.gwettop);
  const rootWetness = wetnessPct(powerAny.series?.gwetroot);
  const profileWetness = wetnessPct(powerAny.series?.gwetprof);

  return {
    rootZoneWaterMm: Math.round(currentMm * 10) / 10,
    rootZoneWaterPct: Math.round(currentPct * 10) / 10,
    rootZoneCapacityMm: capacity,

    currentMm: Math.round(currentMm * 10) / 10,
    currentPct: Math.round(currentPct * 10) / 10,

    surfaceSoilWetnessPct: surfaceWetness,
    rootZoneSoilWetnessPct: measured ? Math.round(currentPct) : rootWetness,
    profileSoilWetnessPct: profileWetness,

    referenceEtMmPerDay: Math.round(avgEt0 * 10) / 10,
    cropEtMmPerDay: Math.round(avgEtc * 10) / 10,
    totalGrowingSeasonEtcMm: Math.round(totalEtc * 10) / 10,

    seasonalDeficit: Math.round(physicalDeficit * 10) / 10,
    effectiveRainfallMm: effectiveRainfall,

    // Removed arbitrary 0.05 scaling
    rainfallTrendMmPerYear: Number.isFinite(power.tenYearRainfallTrend)
      ? Math.round(power.tenYearRainfallTrend * 10) / 10
      : null,
    soilMoistureTrendPctPerYear: null, // Scientifically honest: no direct SMAP time-series yet
    tenYearTrend: null,

    measured,
    source: measured ? 'NASA_POWER' : 'DERIVED',
    status: measured ? (power.source === 'cached' ? 'cached' : 'live') : 'fallback',
    attribution: measured
      ? 'NASA POWER GWETROOT root-zone soil wetness (MERRA-2 reanalysis, last 7 days). Seasonal deficit comes from a water balance driven by POWER rainfall and temperature.'
      : 'Root-zone soil water balance driven by NASA POWER daily rainfall and temperature (MERRA-2). Direct soil wetness was not available for this location.',
    resolution: '0.5° (~50 km derived water balance)',
    dataQuality: {
      validDays: wb.validDays,
      missingDays: wb.missingDays,
      coveragePct: wb.coveragePct,
      isReliable: wb.isReliable,
    },
  };
}

// ─────────────────────────────────────────────
// Soil Condition Inferences
// ─────────────────────────────────────────────

export function deriveSoilCondition(
  soilType: 'sandy' | 'loamy' | 'clay' | 'unknown',
  power: PowerAnalysis,
  sm: SoilMoistureAnalysis,
  ndvi: number,
  currentCropIsLegume: boolean,
  options: {
    slope?: 'flat' | 'gentle' | 'moderate' | 'steep';
    peakDailyRainfallMm?: number;
    nodulationActive?: boolean;
  } = {}
): SoilCondition {
  // Do NOT assume loamy if unknown
  const texture = soilType;

  // Water retention: accurately reflecting uncertainty when texture is unknown
  const waterRetention: SoilCondition['waterRetention'] =
    texture === 'clay' ? 'high' : texture === 'loamy' ? 'medium' : texture === 'sandy' ? 'low' : 'unknown';

  // Organic matter proxy: Greenness (NDVI) does not directly measure organic matter
  const organicMatter: SoilCondition['organicMatter'] = ndvi > 0.55 ? 'high' : ndvi > 0.35 ? 'medium' : 'low';
  const organicMatterProxyConfidence: SoilCondition['organicMatterProxyConfidence'] =
    texture === 'unknown' ? 'low' : 'medium';
  const organicMatterProxyNote =
    'NDVI reflects vegetative canopy vigor and serves only as an indirect proxy for biological soil activity. Direct soil testing is recommended for verified SOC levels.';

  // Moisture condition evaluated against root-zone capacity percentage
  const moistureCondition: SoilCondition['moistureCondition'] =
    sm.rootZoneWaterPct < 30 ? 'deficit' : sm.rootZoneWaterPct > 75 ? 'surplus' : 'adequate';

  // Nitrogen balance: Crop-specific rotation guidance and stress conditions
  let nitrogenBalance: SoilCondition['nitrogenBalance'] = 'depleting';
  let nitrogenRotationNote = 'Cereal / non-legume cropping depletes soil nitrogen; replenishing rotation recommended.';

  if (currentCropIsLegume) {
    if (sm.rootZoneWaterPct < 25) {
      nitrogenBalance = 'stable';
      nitrogenRotationNote =
        'Legume cultivated, but severe root-zone moisture deficit inhibits Rhizobium nodule nitrogen fixation.';
    } else {
      nitrogenBalance = 'building';
      nitrogenRotationNote =
        'Symbiotic biological nitrogen fixation active. Recommended to leave biomass residues post-harvest.';
    }
  }

  // Erosion risk: Multifactorial (slope, vegetation cover, rainfall intensity, texture)
  const slope = options.slope || 'gentle';
  const peakRain = options.peakDailyRainfallMm ?? (power.rainfallVariability * 3.5);

  const slopeScore = slope === 'steep' ? 3 : slope === 'moderate' ? 2 : slope === 'gentle' ? 1 : 0;
  const coverScore = ndvi < 0.25 ? 3 : ndvi < 0.45 ? 2 : 0; // Low NDVI leaves topsoil exposed
  const rainScore = peakRain > 45 || power.rainfallVariability > 8 ? 2 : peakRain > 25 ? 1 : 0;
  const textureErodibility = texture === 'sandy' ? 1 : 0;

  const totalErosionScore = slopeScore + coverScore + rainScore + textureErodibility;
  const erosionRisk: SoilCondition['erosionRisk'] =
    totalErosionScore >= 5 ? 'high' : totalErosionScore >= 2 ? 'medium' : 'low';

  return {
    texture,
    organicMatter,
    organicMatterProxyConfidence,
    organicMatterProxyNote,
    moistureCondition,
    nitrogenBalance,
    nitrogenRotationNote,
    erosionRisk,
    erosionRiskFactors: {
      slopeFactor: `Slope category: ${slope}`,
      vegetationCoverFactor: ndvi > 0.45 ? 'Adequate canopy protection' : 'Sparse cover, high raindrop impact',
      rainfallIntensityFactor:
        rainScore >= 2 ? 'High storm intensity detected' : 'Moderate rainfall intensity',
    },
    waterRetention,
    source: 'DERIVED',
    attribution:
      'Derived through multi-criteria environmental modeling (NASA POWER rainfall variability, NDVI canopy protection, and user field topography). Not a direct soil lab assay.',
  };
}
export {
  deriveSoilMoistureV2,
  runWaterBalance,
  referenceEt0,
  kcForDay,
  relativeYieldFromWater,
  EXAMPLE_RICE_CURVE,
  type SoilMoistureV2Options,
  type WaterBalanceResult,
  type KcCurve,
  type DailyWeather,
  type Et0Inputs,
  type Et0Method,
} from './gpm-imerg';

