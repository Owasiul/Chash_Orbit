import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { seedCrops, CROP_LIBRARY, ONBOARDING_CROP_OPTIONS } from '@/lib/crops';

export async function GET() {
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
  return NextResponse.json({
    crops: CROP_LIBRARY,
    options: ONBOARDING_CROP_OPTIONS,
  });
}
