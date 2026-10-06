import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchEnvironment, type Environment } from '@/lib/nasa/environment';
import { analyze, computeRisks, type FarmerInputs, type FarmerPriorities } from '@/lib/decision/engine';
import {
  inferSoilType,
  seedCrops,
  getCropByName,
  type IrrigationType,
  type SoilType,
} from '@/lib/crops';

// ── Request / response types ─────────────────────────────────────────────────
interface AnalyzeBody {
  latitude: number;
  longitude: number;
  locationName?: string;
  country?: string;
  area?: number;
  areaUnit?: 'acres' | 'hectares';
  currentCrop?: string | null;
  desiredCrops: string[];
  irrigation: IrrigationType | 'rainfed' | 'limited' | 'reliable';
  soilType?: SoilType;
  priorities: FarmerPriorities;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return bad('Invalid JSON body.');
  }

  // Validate
  const { latitude, longitude, desiredCrops, priorities, irrigation } = body;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return bad('latitude and longitude are required.');
  if (!Array.isArray(desiredCrops) || desiredCrops.length === 0) return bad('desiredCrops must be a non-empty array.');
  if (!priorities || typeof priorities.soil !== 'number' || typeof priorities.water !== 'number' || typeof priorities.climate !== 'number' || typeof priorities.income !== 'number') {
    return bad('priorities (soil, water, climate, income) are required.');
  }
  if (!['rainfed', 'limited', 'reliable'].includes(irrigation)) return bad('irrigation must be rainfed | limited | reliable.');

  // Ensure crop library is seeded (idempotent).
  try {
    if ((await db.crop.count()) === 0) await seedCrops(db);
  } catch {
    // ignore seed failure — we still have the static library
  }

  const soilType: SoilType = body.soilType ?? 'unknown';
  const resolvedSoil = soilType === 'unknown' ? inferSoilType(latitude, longitude) : soilType;

  const inputs: FarmerInputs = {
    latitude,
    longitude,
    area: body.area,
    areaUnit: body.areaUnit,
    currentCrop: body.currentCrop ?? null,
    desiredCrops,
    irrigation,
    soilType,
    priorities,
  };

  // ── Step 1: Find-or-create the Farm record ─────────────────────────────
  let farm;
  try {
    farm = await db.farm.upsert({
      where: { latitude_longitude: { latitude, longitude } },
      create: {
        name: body.locationName || `Field at ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`,
        latitude,
        longitude,
        locationName: body.locationName || '',
        country: body.country || null,
        area: body.area ?? null,
        areaUnit: body.areaUnit ?? 'acres',
        soilType: resolvedSoil,
        irrigationType: irrigation,
        currentCrop: body.currentCrop ?? null,
      },
      update: {
        locationName: body.locationName ?? undefined,
        country: body.country ?? undefined,
        area: body.area ?? undefined,
        areaUnit: body.areaUnit ?? undefined,
        soilType: resolvedSoil,
        irrigationType: irrigation,
        currentCrop: body.currentCrop ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: 'Failed to persist farm.', detail: (e as Error).message },
      { status: 500 },
    );
  }

  // ── Step 2: Save farmer preferences (replace existing) ─────────────────
  await db.farmerPreference.upsert({
    where: { farmId: farm.id },
    create: {
      farmId: farm.id,
      soilHealthWeight: priorities.soil,
      waterWeight: priorities.water,
      climateWeight: priorities.climate,
      incomeWeight: priorities.income,
    },
    update: {
      soilHealthWeight: priorities.soil,
      waterWeight: priorities.water,
      climateWeight: priorities.climate,
      incomeWeight: priorities.income,
    },
  }).catch(() => { /* best-effort */ });

  // ── Step 3: Save farmer crops (replace existing) ───────────────────────
  await db.farmerCrop.deleteMany({ where: { farmId: farm.id } }).catch(() => {});
  for (const cropName of desiredCrops) {
    const crop = await db.crop.findUnique({ where: { name: cropName } }).catch(() => null);
    if (crop) {
      await db.farmerCrop.create({
        data: {
          farmId: farm.id,
          cropId: crop.id,
          cropRole: 'considering',
        },
      }).catch(() => { /* ignore dupes */ });
    }
  }

  // ── Step 4: Fetch NASA environment ─────────────────────────────────────
  const currentCrop = body.currentCrop ? getCropByName(body.currentCrop) : null;
  const cropWaterMm = currentCrop?.waterMm ?? 500;
  const currentCropIsLegume = currentCrop?.nitrogenEffect === 'fixer';

  const env = await fetchEnvironment(latitude, longitude, cropWaterMm, currentCropIsLegume);

  // ── Step 5: Run decision engine ────────────────────────────────────────
  const result = analyze(inputs, env);

  // ── Step 6: Persist field observation (normalized) ─────────────────────
  try {
    await db.fieldObservation.create({
      data: {
        farmId: farm.id,
        temperature: env.temperature.current,
        rainfall: env.rainfall.annualRainfall,
        soilMoisture: env.soilMoisture.currentPct,
        ndvi: env.vegetation.ndvi,
        heatRisk: result.risks.heatRisk,
        droughtRisk: result.risks.droughtRisk,
        floodRisk: result.risks.floodRisk,
        soilMoistureDeficit: result.risks.soilMoistureDeficit,
        source: env.overallSource,
        observationDate: new Date(),
      },
    });
  } catch {
    // best-effort
  }

  // ── Step 7: Persist the rotation plan + years (replace existing) ────────
  try {
    await db.rotationPlan.deleteMany({ where: { farmId: farm.id } });
    const plan = await db.rotationPlan.create({
      data: {
        farmId: farm.id,
        name: result.rotationPlan.name,
        overallScore: result.rotationPlan.overallScore,
        soilScore: result.rotationPlan.soilScore,
        waterScore: result.rotationPlan.waterScore,
        climateScore: result.rotationPlan.climateScore,
        incomeScore: result.rotationPlan.incomeScore,
      },
    });
    for (const y of result.rotationPlan.years) {
      const cropRow = await db.crop.findUnique({ where: { name: y.crop } }).catch(() => null);
      if (cropRow) {
        await db.rotationYear.create({
          data: {
            rotationPlanId: plan.id,
            year: y.year,
            cropId: cropRow.id,
            coverCrop: y.coverCrop,
            irrigationLevel: y.irrigationLevel,
            score: y.score,
            reason: y.reason,
          },
        });
      }
    }
  } catch {
    // best-effort
  }

  // ── Step 8: Return the complete analysis ────────────────────────────────
  return NextResponse.json({
    farmId: farm.id,
    field: {
      farmId: farm.id,
      id: farm.id,
      name: farm.name,
      locationName: farm.locationName,
      country: farm.country,
      latitude: farm.latitude,
      longitude: farm.longitude,
      area: farm.area,
      areaUnit: farm.areaUnit,
      soilType: resolvedSoil,
      irrigationType: farm.irrigationType,
      currentCrop: farm.currentCrop,
      desiredCrops,
      priorities,
      createdAt: farm.createdAt,
      updatedAt: farm.updatedAt,
    },
    environment: {
      temperature: env.temperature,
      rainfall: env.rainfall,
      soilMoisture: env.soilMoisture,
      vegetation: env.vegetation,
      overallSource: env.overallSource,
      overallAttribution: env.overallAttribution,
    },
    risks: result.risks,
    cropCompatibility: result.cropCompatibility,
    recommendations: result.recommendations,
    rotationPlan: result.rotationPlan,
    sources: buildSourceList(env),
  });
}

function buildSourceList(env: Environment) {
  return [
    { name: 'Temperature', source: env.temperature.source, attribution: env.temperature.attribution },
    { name: 'Rainfall', source: env.rainfall.source, attribution: env.rainfall.attribution },
    { name: 'Soil moisture', source: env.soilMoisture.source, attribution: env.soilMoisture.attribution },
    { name: 'Vegetation (NDVI)', source: env.vegetation.source, attribution: env.vegetation.attribution },
  ];
}
