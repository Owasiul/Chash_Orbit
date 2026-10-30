'use client';

import Link from 'next/link';
import { useTranslation } from '@/lib/locale';

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-amber-300">404</p>
      <h1 className="text-3xl font-light text-foreground">{t('errors.not-found')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('errors.page-not-found-description')}
      </p>
      <Link
        href="/"
        className="rounded-full border border-amber-400/30 px-4 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-400/10"
      >
        {t('common.return-to-home')}
      </Link>
    </main>
  );
}
