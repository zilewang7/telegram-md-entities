/**
 * Locale detection and persistence. Priority: `?lang=` query, then the saved
 * choice, then the browser language (Chinese browsers get Chinese).
 */
import { translate } from './messages';
import type { Locale } from './messages';

const STORAGE_KEY = 'tgmd.locale';

const isLocale = (value: string | null): value is Locale => value === 'zh' || value === 'en';

export const detectLocale = (): Locale => {
  const fromQuery = new URLSearchParams(window.location.search).get('lang');
  if (isLocale(fromQuery)) return fromQuery;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    // Storage can throw in private mode; fall through to the browser language
  }

  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
};

export const rememberLocale = (locale: Locale): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Ignore: the choice simply will not persist
  }
};

/** Keep <html lang>, the document title and the description in sync */
export const applyDocumentLocale = (locale: Locale): void => {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = translate(locale, 'app.documentTitle');
  const description = document.querySelector('meta[name="description"]');
  if (description !== null) {
    description.setAttribute('content', translate(locale, 'app.description'));
  }
};
