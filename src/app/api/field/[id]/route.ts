import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const farm = await db.farm.findUnique({
      where: { id },
      include: {
        preferences: true,
        crops: { include: { crop: true } },
        observations: { orderBy: { observationDate: 'desc' }, take: 5 },
        rotationPlan: { include: { years: { include: { crop: true } } } },
      },
    });
    if (!farm) return NextResponse.json({ error: 'Farm not found' }, { status: 404 });
    return NextResponse.json({ farm });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
