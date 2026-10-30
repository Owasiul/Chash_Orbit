import type { Locale } from '@/lib/i18n';

export type RelativeTimeUnit =
  | 'year'
  | 'quarter'
  | 'month'
  | 'week'
  | 'day'
  | 'hour'
  | 'minute'
  | 'second';

function intlLocale(locale: Locale) {
  return locale === 'bn-BD' ? 'bn-BD' : 'en-US';
}

export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  return new Intl.NumberFormat(intlLocale(locale), options).format(value);
}

export function formatCurrency(
  value: number,
  locale: Locale,
  currency = 'BDT',
) {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
  }).format(value);
}

export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(date);
}

export function formatRelativeTime(
  value: number,
  unit: RelativeTimeUnit,
  locale: Locale,
) {
  return new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: 'auto',
  }).format(value, unit);
}

export function getPluralCategory(value: number, locale: Locale) {
  return new Intl.PluralRules(intlLocale(locale)).select(value);
}

export function formatPlural(
  value: number,
  locale: Locale,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
) {
  const category = getPluralCategory(value, locale);
  const template = forms[category] ?? forms.other;
  return template.replace(/\{count\}/g, formatNumber(value, locale));
}
