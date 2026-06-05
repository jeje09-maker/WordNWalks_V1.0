import { en } from './i18n/en';
import { ko } from './i18n/ko';

export const languages = [
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'en', name: 'English' },
];

export const defaultLang = 'ko';

export const translations: Record<string, any> = {
  en, ko
};

// Fallback logic to ensure all keys exist
Object.keys(translations).forEach(lang => {
  if (lang !== 'en' && lang !== 'ko') {
      translations[lang] = { ...translations.ko, ...translations[lang] };
  }
});
