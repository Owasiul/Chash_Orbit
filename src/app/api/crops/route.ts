import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedCrops, CROP_LIBRARY, ONBOARDING_CROP_OPTIONS } from '@/lib/crops';
import { FAO_CROPS, searchFaoCrops, type CropCategory } from '@/lib/crop-dataset';
import { resolveCrop } from '@/lib/crops/resolver';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const category = (searchParams.get('category') as CropCategory) || undefined;

  // Lazy-seed the crop library if it's empty.
  let count = 0;
  try {
    count = await db.crop.count();
  } catch {
    // database might still be initializing
  }
  if (count === 0) {
    try {
      await seedCrops(db);
    } catch {
      // ignore — DB errors mean we fall back to the static library
    }
  }

  const filteredFao = q || category ? searchFaoCrops(q, category) : FAO_CROPS;

  return NextResponse.json({
    crops: CROP_LIBRARY,
    faoCrops: filteredFao,
    options: ONBOARDING_CROP_OPTIONS,
    totalCrops: CROP_LIBRARY.length,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const cropName = body?.name?.trim();

    if (!cropName) {
      return NextResponse.json({ error: 'Crop name is required' }, { status: 400 });
    }

    const resolved = await resolveCrop(cropName);

    // Optionally persist into SQLite database
    try {
      await db.crop.upsert({
        where: { name: resolved.name },
        create: {
          name: resolved.name,
          family: resolved.family,
          season: resolved.season,
          waterDemand: resolved.water.optMaxMm > 900 ? 'high' : resolved.water.optMaxMm < 450 ? 'low' : 'medium',
          waterMm: Math.round((resolved.water.optMinMm + resolved.water.optMaxMm) / 2),
          rootDepth: resolved.rootDepth,
          nitrogenEffect: resolved.nitrogenEffect,
          heatTolerance: resolved.tolerances.heat,
          droughtTolerance: resolved.tolerances.drought,
          floodTolerance: resolved.tolerances.flood,
          growTempMin: resolved.temp.optMin,
          growTempMax: resolved.temp.optMax,
          baseIncome: resolved.baseIncome,
          soilBenefits: resolved.soilBenefits,
        },
        update: {},
      });
    } catch {
      // Best-effort cache
    }

    return NextResponse.json({ crop: resolved });
  } catch (err) {
    console.error('Error resolving custom crop:', err);
    return NextResponse.json({ error: 'Failed to resolve crop' }, { status: 500 });
  }
}
