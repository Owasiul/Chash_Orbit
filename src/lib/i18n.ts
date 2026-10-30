import enAuth from '@/messages/en/auth.json';
import enCommon from '@/messages/en/common.json';
import enDashboard from '@/messages/en/dashboard.json';
import enErrors from '@/messages/en/errors.json';
import enFooter from '@/messages/en/footer.json';
import enNavbar from '@/messages/en/navbar.json';
import enProfile from '@/messages/en/profile.json';
import enSettings from '@/messages/en/settings.json';
import enValidation from '@/messages/en/validation.json';
import bnAuth from '@/messages/bn-BD/auth.json';
import bnCommon from '@/messages/bn-BD/common.json';
import bnDashboard from '@/messages/bn-BD/dashboard.json';
import bnErrors from '@/messages/bn-BD/errors.json';
import bnFooter from '@/messages/bn-BD/footer.json';
import bnNavbar from '@/messages/bn-BD/navbar.json';
import bnProfile from '@/messages/bn-BD/profile.json';
import bnSettings from '@/messages/bn-BD/settings.json';
import bnValidation from '@/messages/bn-BD/validation.json';

export type Locale = 'en' | 'bn-BD';
export type TranslationValues = Record<string, string | number>;

type Catalog = Record<string, string>;

const EN_NAMESPACES: Record<string, Catalog> = {
  common: enCommon,
  auth: enAuth,
  dashboard: enDashboard,
  errors: enErrors,
  footer: enFooter,
  navbar: enNavbar,
  profile: enProfile,
  settings: enSettings,
  validation: enValidation,
};

const BN_NAMESPACES: Record<string, Catalog> = {
  common: bnCommon,
  auth: bnAuth,
  dashboard: bnDashboard,
  errors: bnErrors,
  footer: bnFooter,
  navbar: bnNavbar,
  profile: bnProfile,
  settings: bnSettings,
  validation: bnValidation,
};

function flattenNamespaces(namespaces: Record<string, Catalog>): Catalog {
  const flat: Catalog = {};
  for (const [namespace, messages] of Object.entries(namespaces)) {
    for (const [key, value] of Object.entries(messages)) {
      flat[`${namespace}.${key}`] = value;
    }
  }
  return flat;
}

const ENGLISH_MESSAGES = flattenNamespaces(EN_NAMESPACES);
const BENGALI_MESSAGES = flattenNamespaces(BN_NAMESPACES);

const BENGALI_DIGITS = '০১২৩৪৫৬৭৮৯';
const PLACEHOLDER = /\{([a-zA-Z0-9_]+)\}/g;

function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

const englishKeyByMessage = new Map<string, string>();
for (const [key, message] of Object.entries(ENGLISH_MESSAGES)) {
  if (!englishKeyByMessage.has(message)) {
    englishKeyByMessage.set(message, key);
  }
}

function resolveKey(message: string): string | undefined {
  if (hasOwn(ENGLISH_MESSAGES, message)) return message;
  return englishKeyByMessage.get(message);
}

function getTemplate(locale: Locale, key: string, fallback: string): string {
  const catalog = locale === 'bn-BD' ? BENGALI_MESSAGES : ENGLISH_MESSAGES;
  return catalog[key] ?? fallback;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

type CompiledTemplate = {
  key: string;
  template: string;
  names: string[];
  regex: RegExp;
};

const COMPILED_TEMPLATES: CompiledTemplate[] = Object.entries(ENGLISH_MESSAGES)
  .filter(([, template]) => template.includes('{'))
  .map(([key, template]) => {
    const names: string[] = [];
    let pattern = '^';
    let lastIndex = 0;
    const token = /\{([a-zA-Z0-9_]+)\}/g;
    let match: RegExpExecArray | null = token.exec(template);

    while (match !== null) {
      pattern += escapeRegExp(template.slice(lastIndex, match.index));
      pattern += '(.+?)';
      names.push(match[1]);
      lastIndex = match.index + match[0].length;
      match = token.exec(template);
    }

    pattern += escapeRegExp(template.slice(lastIndex)) + '$';
    return { key, template, names, regex: new RegExp(pattern) };
  })
  .sort((a, b) => b.template.length - a.template.length);

function matchTemplate(
  message: string,
): { key: string; values: TranslationValues } | null {
  for (const item of COMPILED_TEMPLATES) {
    const match = item.regex.exec(message);
    if (!match) continue;

    const values: TranslationValues = {};
    item.names.forEach((name, index) => {
      values[name] = match[index + 1] ?? '';
    });

    return { key: item.key, values };
  }
  return null;
}

const bengaliNumberFormat = new Intl.NumberFormat('bn-BD', {
  useGrouping: false,
  maximumFractionDigits: 20,
});

function toBengaliDigits(value: string): string {
  return value.replace(/[0-9]/g, digit => BENGALI_DIGITS[Number(digit)]);
}

function localizeValue(locale: Locale, value: string | number): string {
  if (typeof value === 'number') {
    return locale === 'bn-BD'
      ? bengaliNumberFormat.format(value)
      : String(value);
  }

  if (locale === 'bn-BD') {
    const key = resolveKey(value);
    if (key) return BENGALI_MESSAGES[key] ?? value;
  }

  return value;
}

function interpolate(
  locale: Locale,
  template: string,
  values?: TranslationValues,
): string {
  const rendered = values
    ? template.replace(PLACEHOLDER, (placeholder, name: string) => {
        const value = values[name];
        return value == null ? placeholder : localizeValue(locale, value);
      })
    : template;

  return locale === 'bn-BD' ? toBengaliDigits(rendered) : rendered;
}

const FRAGMENT_SEPARATOR = /(\s*[–—]\s*|,\s+)/;

function translateFragment(locale: Locale, value: string): string {
  if (locale !== 'bn-BD') return value;

  const parts = value.split(FRAGMENT_SEPARATOR);
  if (parts.length === 1) return value;

  return parts
    .map((part, index) => {
      if (index % 2 === 1) return part;
      const key = resolveKey(part);
      return key ? getTemplate(locale, key, part) : part;
    })
    .join('');
}

export function translateMessage(
  locale: Locale,
  message: string,
  values?: TranslationValues,
): string {
  if (!message) return message;

  const key = resolveKey(message);
  if (key) {
    return interpolate(locale, getTemplate(locale, key, message), values);
  }

  const matched = matchTemplate(message);
  if (matched) {
    const template = getTemplate(locale, matched.key, message);
    return interpolate(locale, template, { ...matched.values, ...values });
  }

  return translateFragment(locale, message);
}
