import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { translateMessage, type Locale } from '@/lib/i18n';

function requestLocale(req: Request): Locale {
  const savedLocale = req.headers
    .get('cookie')
    ?.split(';')
    .map(cookie => cookie.trim())
    .find(cookie => cookie.startsWith('chash-orbit-locale='))
    ?.split('=')[1];

  if (savedLocale === 'bn' || savedLocale === 'bn-BD') return 'bn-BD';
  return req.headers.get('accept-language')?.toLowerCase().startsWith('bn')
    ? 'bn-BD'
    : 'en';
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = requestLocale(req);
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
    if (!farm) {
      return NextResponse.json(
        { error: translateMessage(locale, 'errors.farm-not-found') },
        { status: 404 },
      );
    }
    return NextResponse.json({ farm });
  } catch (error) {
    console.error('[api/field] Failed to load farm:', error);
    return NextResponse.json(
      { error: translateMessage(locale, 'errors.request-failed') },
      { status: 500 },
    );
  }
}
