import { NextResponse } from 'next/server';
import { hasBengaliScript, searchLocation } from '@/lib/location';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get('q')?.trim() ?? '';
  const requestedLanguage = url.searchParams.get('language');
  const language = requestedLanguage === 'bn' ? 'bn' : 'en';
  if (q.length < 2) return NextResponse.json({ results: [] });
  try {
    const results = await searchLocation(q, hasBengaliScript(q) ? 'bn' : language);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}
