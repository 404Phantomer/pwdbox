import { en } from './en';
import { zh } from './zh';

export type Language = 'en' | 'zh';
export type TranslationKey = keyof typeof en;

// Language configurations
export const languages = {
  en: {
    name: 'English',
    nativeName: 'English',
    translations: en,
  },
  zh: {
    name: 'Chinese',
    nativeName: '中文',
    translations: zh,
  },
} as const;

export const defaultLanguage: Language = 'en';

// Get browser language
export const getBrowserLanguage = (): Language => {
  const browserLang = navigator.language.toLowerCase();
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
};

// Get saved language from localStorage
export const getSavedLanguage = (): Language => {
  const saved = localStorage.getItem('pwdbox-language') as Language;
  return saved && saved in languages ? saved : getBrowserLanguage();
};

// Save language to localStorage
export const saveLanguage = (language: Language): void => {
  localStorage.setItem('pwdbox-language', language);
};

// Simple translation function with placeholder support
export const translate = (
  key: string,
  translations: typeof en,
  params: Record<string, string | number> = {}
): string => {
  const keys = key.split('.');
  let value: any = translations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }
  
  // Handle pluralization (simple implementation)
  if (value.includes('|')) {
    const [singular, plural] = value.split('|');
    const count = params.count as number;
    value = count === 1 ? singular : plural;
  }
  
  // Replace placeholders
  return value.replace(/\{(\w+)\}/g, (match: string, paramKey: string) => {
    const replacement = params[paramKey];
    return replacement !== undefined ? String(replacement) : match;
  });
};

export { en, zh }; 