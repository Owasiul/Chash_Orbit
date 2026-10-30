import { cookies, headers } from 'next/headers';
import type { Locale } from '@/lib/i18n';

const LOCALE_COOKIE = 'chash-orbit-locale';

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const saved = cookieStore.get(LOCALE_COOKIE)?.value;
  if (saved === 'bn' || saved === 'bn-BD') return 'bn-BD';
  if (saved === 'en') return 'en';

  const requestHeaders = await headers();
  return requestHeaders.get('accept-language')?.toLowerCase().startsWith('bn')
    ? 'bn-BD'
    : 'en';
}
