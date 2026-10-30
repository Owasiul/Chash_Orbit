'use client';

import * as React from 'react';
import { translateMessage } from '@/lib/i18n';
import type { Locale, TranslationValues } from '@/lib/i18n';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
  type RelativeTimeUnit,
} from '@/lib/formatting';

type TranslationContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (message: string, values?: TranslationValues) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  currency: (value: number, currency?: string) => string;
  date: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  relativeTime: (value: number, unit: RelativeTimeUnit) => string;
};

const STORAGE_KEY = 'chash-orbit-locale';
const TranslationContext = React.createContext<TranslationContextValue | null>(null);

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'bn-BD' || value === 'bn';
}

function normalizeLocale(value: string): Locale {
  return value === 'bn' ? 'bn-BD' : value === 'bn-BD' ? 'bn-BD' : 'en';
}

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const [locale, setCurrentLocale] = React.useState<Locale>(initialLocale);

  const setLocale = React.useCallback((nextLocale: Locale) => {
    setCurrentLocale(nextLocale);
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${STORAGE_KEY}=${nextLocale}; path=/; max-age=31536000; samesite=lax${secure}`;

    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch (error) {
      console.error('Could not save the language preference in local storage:', error);
    }
  }, []);

  React.useEffect(() => {
    document.documentElement.lang = locale;
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !isLocale(event.newValue)) return;
      setCurrentLocale(normalizeLocale(event.newValue));
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [locale]);

  const t = React.useCallback(
    (message: string, values?: TranslationValues) => translateMessage(locale, message, values),
    [locale],
  );
  const number = React.useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => formatNumber(value, locale, options),
    [locale],
  );
  const currency = React.useCallback(
    (value: number, currencyCode = 'BDT') => formatCurrency(value, locale, currencyCode),
    [locale],
  );
  const date = React.useCallback(
    (value: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatDate(value, locale, options),
    [locale],
  );
  const relativeTime = React.useCallback(
    (value: number, unit: RelativeTimeUnit) => formatRelativeTime(value, unit, locale),
    [locale],
  );

  const contextValue = React.useMemo(
    () => ({ locale, setLocale, t, number, currency, date, relativeTime }),
    [locale, setLocale, t, number, currency, date, relativeTime],
  );

  return (
    <TranslationContext.Provider value={contextValue}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = React.useContext(TranslationContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LocaleProvider.');
  }
  return context;
}
