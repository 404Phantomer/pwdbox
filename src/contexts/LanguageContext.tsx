import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  Language, 
  languages, 
  getSavedLanguage, 
  saveLanguage, 
  translate,
  en
} from '../locales';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLanguages: typeof languages;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getSavedLanguage());

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    saveLanguage(newLanguage);
  };

  const t = (key: string, params: Record<string, string | number> = {}): string => {
    const translations = languages[language].translations;
    return translate(key, translations, params);
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t,
    availableLanguages: languages,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Convenience hook for just the translation function
export const useTranslation = () => {
  const { t } = useLanguage();
  return { t };
}; 