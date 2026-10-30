import { NextResponse } from 'next/server';
import { hasBengaliScript, searchLocation } from '@/lib/location';
import { translateMessage, type Locale } from '@/lib/i18n';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const requestedLanguage = url.searchParams.get('language');
  const locale: Locale =
    requestedLanguage === 'bn' || requestedLanguage === 'bn-BD' ? 'bn-BD' : 'en';
  const language = locale === 'bn-BD' ? 'bn' : 'en';
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await searchLocation(q, hasBengaliScript(q) ? 'bn' : language);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('[location] Search provider request failed:', error);
    return NextResponse.json(
      {
        error: translateMessage(
          locale,
          'Location search is temporarily unavailable. Please try again shortly.',
        ),
      },
      { status: 503 },
    );
  }
}
