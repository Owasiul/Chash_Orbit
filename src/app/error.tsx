'use client';

import { useEffect } from 'react';
import { useTranslation } from '@/lib/locale';

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error('Application rendering failed:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-light text-foreground">{t('errors.something-went-wrong')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {t('errors.unexpected-error-description')}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full border border-amber-400/30 px-4 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-400/10"
      >
        {t('common.try-again')}
      </button>
    </main>
  );
}
