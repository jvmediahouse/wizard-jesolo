import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import it from './locales/it.json';
import en from './locales/en.json';
import de from './locales/de.json';

function detectInitialLanguage(): 'it' | 'de' | 'en' {
  if (typeof navigator === 'undefined') return 'en';
  const candidates = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean);
  for (const raw of candidates) {
    const code = raw.toLowerCase().split('-')[0];
    if (code === 'it') return 'it';
    if (code === 'de') return 'de';
    if (code === 'en') return 'en';
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    it: { translation: it },
    en: { translation: en },
    de: { translation: de },
  },
  lng: detectInitialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
