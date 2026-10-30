'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/lib/locale';
import type { Locale } from '@/lib/i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useTranslation();
  const nextLocale: Locale = locale === 'en' ? 'bn-BD' : 'en';
  const label = t(locale === 'en' ? 'Switch language to Bengali' : 'Switch language to English');

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <button
      type="button"
      onClick={() => setLocale(nextLocale)}
      aria-label={label}
      title={label}
      className="fixed right-4 top-14 z-100 rounded-full border border-amber-400/30 bg-black/70 px-3 py-2 font-mono text-xs text-amber-100 shadow-lg backdrop-blur transition-colors hover:bg-amber-400/15"
    >
      {locale === 'en' ? 'বাংলা' : 'English'}
    </button>
  );
}
