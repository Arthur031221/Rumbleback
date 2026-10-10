import type { Lang } from '../core/cities.ts';
import de from './locales/de.json' with { type: 'json' };
import en from './locales/en.json' with { type: 'json' };
import es from './locales/es.json' with { type: 'json' };
import fr from './locales/fr.json' with { type: 'json' };
import ja from './locales/ja.json' with { type: 'json' };
import ko from './locales/ko.json' with { type: 'json' };
import ptBR from './locales/pt-BR.json' with { type: 'json' };
import zhCN from './locales/zh-CN.json' with { type: 'json' };
import zhTW from './locales/zh-TW.json' with { type: 'json' };

export type { Lang };
export type Messages = Record<string, string>;

export const LOCALES: Record<Lang, Messages> = { en, 'zh-TW': zhTW, 'zh-CN': zhCN, ja, ko, es, fr, de, 'pt-BR': ptBR };
export const LANGS = Object.keys(LOCALES) as Lang[];

let current: Lang = 'en';

/** The supported language that best matches a saved choice or the browser's language list. */
export function pickLanguage(saved: string | null | undefined, preferred: readonly string[]): Lang {
  const match = (tag: string): Lang | null => {
    const lower = tag.toLowerCase();
    const exact = LANGS.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    if (lower.startsWith('zh')) return /hant|tw|hk|mo/.test(lower) ? 'zh-TW' : 'zh-CN';
    if (lower.startsWith('pt')) return 'pt-BR';
    return LANGS.find((l) => l.toLowerCase() === lower.split('-')[0]) ?? null;
  };
  if (saved) {
    const s = match(saved);
    if (s) return s;
  }
  for (const tag of preferred) {
    const m = match(tag);
    if (m) return m;
  }
  return 'en';
}

export function setLanguage(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
}

export const language = (): Lang => current;

/** The message for a key with `{name}` placeholders filled in. A missing key falls back to English, then to the key. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const text = LOCALES[current][key] ?? en[key as keyof typeof en] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function number(n: number, digits = 0): string {
  return new Intl.NumberFormat(current, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

/** Seconds with one decimal below ten, whole seconds after. */
export function seconds(n: number): string {
  return t('unit.s', { n: number(n, Math.abs(n) < 10 ? 1 : 0) });
}

/** Seconds to a tenth, for comparing an analyst's pick with the model's arrival. */
export function tenths(n: number): string {
  return t('unit.s', { n: number(n, 1) });
}

export function km(n: number): string {
  return t('unit.km', { n: number(n, n < 10 ? 1 : 0) });
}

const MOMENT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
};

export function utcDate(ms: number): string {
  return new Intl.DateTimeFormat(current, { ...MOMENT, timeZone: 'UTC' }).format(ms);
}

/** The moment in the viewer's own time zone, or null when that zone is UTC and the line would repeat the first. */
export function localDate(ms: number): string | null {
  if (new Date(ms).getTimezoneOffset() === 0) return null;
  return new Intl.DateTimeFormat(current, { ...MOMENT, timeZoneName: 'short' }).format(ms);
}

/** Fills elements marked data-i18n (text), data-i18n-label, data-i18n-title and data-i18n-placeholder. */
export function translateTree(root: ParentNode): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-i18n]')) el.textContent = t(el.dataset.i18n!);
  for (const [attr, data] of [
    ['aria-label', 'i18nLabel'],
    ['title', 'i18nTitle'],
    ['placeholder', 'i18nPlaceholder'],
  ] as const) {
    for (const el of root.querySelectorAll<HTMLElement>(`[data-${data.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase())}]`)) {
      el.setAttribute(attr, t(el.dataset[data]!));
    }
  }
}
