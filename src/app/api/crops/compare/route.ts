import { NextResponse } from 'next/server';
import { fetchEnvironment } from '@/lib/nasa/environment';
import {
  computeRisks,
  evaluateCropAtmosphere,
  type FarmerInputs,
} from '@/lib/decision/engine';
import { getCropByName, inferSoilType, type IrrigationType, type SoilType } from '@/lib/crops';
import { resolveCrop } from '@/lib/crops/resolver';
import { faoToLegacyCropSpec } from '@/lib/crop-dataset';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      latitude,
      longitude,
      cropNames,
      irrigation = 'rainfed',
      soilType: rawSoil = 'unknown',
    } = body;

    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return NextResponse.json({ error: 'Latitude and longitude are required' }, { status: 400 });
    }

    if (!Array.isArray(cropNames) || cropNames.length === 0) {
      return NextResponse.json({ error: 'cropNames must be a non-empty array' }, { status: 400 });
    }

    const soilType: SoilType = rawSoil === 'unknown' ? inferSoilType(latitude, longitude) : (rawSoil as SoilType);
    const resolvedIrrig: IrrigationType = irrigation as IrrigationType;

    // Fetch NASA Environment
    const env = await fetchEnvironment(latitude, longitude, 500, false);
    const risks = computeRisks(env);

    // Evaluate each requested crop
    const comparisons = await Promise.all(
      cropNames.map(async (name: string) => {
        let crop = getCropByName(name);
        if (!crop) {
          const resolvedFao = await resolveCrop(name);
          crop = faoToLegacyCropSpec(resolvedFao);
        }

        const atmosphere = evaluateCropAtmosphere(crop, env, latitude, resolvedIrrig, soilType);

        return {
          crop: crop.name,
          ...atmosphere,
        };
      })
    );

    // Synthesize comparative trade-off insights
    const plantableNow = comparisons.filter(c => c.crossCheck.isPlantableNow).map(c => c.cropName);
    const nitrogenFixers = comparisons.filter(c => c.nitrogenEffect === 'fixer').map(c => c.cropName);
    const lowestDeficit = [...comparisons].sort((a, b) => a.crossCheck.waterDeficitMm - b.crossCheck.waterDeficitMm)[0]?.cropName;
    const highestThermalSuitability = [...comparisons].sort((a, b) => b.crossCheck.tempSuitability - a.crossCheck.tempSuitability)[0]?.cropName;

    return NextResponse.json({
      fieldLocation: {
        latitude,
        longitude,
        soilType,
        irrigation: resolvedIrrig,
      },
      nasaAtmosphericBaseline: {
        growingSeasonAvgTempC: Math.round(env.temperature.growingSeasonAvg * 10) / 10,
        heatStressDays: env.temperature.heatStressDays,
        annualRainfallMm: Math.round(env.rainfall.annualRainfall),
        growingSeasonRainfallMm: Math.round(env.rainfall.growingSeasonRainfall),
        soilMoisturePct: Math.round((env.soilMoisture.currentPct ?? 0)),
        soilDeficitMm: Math.round(env.soilMoisture.seasonalDeficit),
        vegetationNdvi: Math.round(env.vegetation.ndvi * 100) / 100,
        source: env.overallSource,
      },
      fieldRisks: risks,
      comparisons,
      insights: {
        plantableNow,
        nitrogenFixers,
        lowestWaterDeficitCrop: lowestDeficit,
        highestThermalMatchCrop: highestThermalSuitability,
      },
    });
  } catch (err) {
    console.error('Crop comparison API failed:', err);
    return NextResponse.json({ error: 'Failed to compute crop comparison' }, { status: 500 });
  }
}
