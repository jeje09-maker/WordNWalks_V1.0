
'use client';

import { createContext, useState, ReactNode, useMemo, useEffect } from 'react';
import { translations, defaultLang, languages } from '@/lib/i18n';

type Lang = (typeof languages)[number]['code'];
type TranslationKeys = keyof (typeof translations)['en'];

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKeys) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(defaultLang);

  // 브라우저 언어 자동 감지 및 로컬 스토리지 저장 로직
  useEffect(() => {
    // 1. 이전에 사용자가 수동으로 선택한 언어가 있는지 확인
    const savedLang = localStorage.getItem('user-language') as Lang;
    
    if (savedLang && languages.some(l => l.code === savedLang)) {
      setLang(savedLang);
    } else {
      // 2. 수동 선택 기록이 없다면 브라우저 언어 감지
      const browserLang = navigator.language.split('-')[0] as Lang;
      const isSupported = languages.some(l => l.code === browserLang);
      
      if (isSupported) {
        setLang(browserLang);
      }
    }
  }, []);

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    // 사용자가 언어를 변경하면 로컬 스토리지에 저장하여 다음 방문 시에도 유지
    localStorage.setItem('user-language', newLang);
  };

  const t = useMemo(() => {
    return (key: TranslationKeys): string => {
      const langData = translations[lang] || translations[defaultLang] || translations['en'];
      const fallbackData = translations[defaultLang] || translations['en'];
      
      return langData[key] || fallbackData[key] || key;
    };
  }, [lang]);

  const value = useMemo(() => {
    return {
      lang,
      setLang: handleSetLang,
      t,
    };
  }, [lang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
