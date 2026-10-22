import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import te from './locales/te.json';
import hi from './locales/hi.json';

export type SupportedLanguage = 'en' | 'te' | 'hi';

export const LANGUAGE_STORAGE_KEY = 'heatsense-language';
export const STORE_STORAGE_KEY = 'heatsense-storage';

const isSupported = (value: unknown): value is SupportedLanguage =>
  value === 'en' || value === 'te' || value === 'hi';

/**
 * Resolves the language to boot with.
 *
 * The zustand store persists the whole app state under STORE_STORAGE_KEY, while the
 * language is mirrored in LANGUAGE_STORAGE_KEY for fast synchronous reads. Both are
 * consulted so the UI never boots with a language that disagrees with the store.
 */
function readInitialLanguage(): SupportedLanguage {
  if (typeof localStorage === 'undefined') return 'en';

  const mirrored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (isSupported(mirrored)) return mirrored;

  try {
    const raw = localStorage.getItem(STORE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw)?.state?.language;
      if (isSupported(parsed)) return parsed;
    }
  } catch {
    // Malformed or unreadable persisted state: fall through to the default.
  }

  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      te: { translation: te },
      hi: { translation: hi },
    },
    lng: readInitialLanguage(),
    fallbackLng: 'en',
    // All resources are bundled, so initialisation can be synchronous. This removes
    // the first-paint window where components can render untranslated key paths.
    initImmediate: false,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
  });

export default i18n;
