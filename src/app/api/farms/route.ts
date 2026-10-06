import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const farms = await db.farm.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include: {
        preferences: true,
        crops: { include: { crop: true } },
        rotationPlan: { include: { years: { include: { crop: true } } } },
      },
    });
    return NextResponse.json({ farms });
  } catch (e) {
    return NextResponse.json({ farms: [], error: (e as Error).message }, { status: 200 });
  }
}
