import { getLocales } from 'expo-localization';
import { useMemo } from 'react';
import { create } from 'zustand';

import { keychainBackend } from '../persistence/storage';

export type Lang = 'en' | 'vi';

export const LANGS: readonly { id: Lang; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'vi', name: 'Tiếng Việt' },
];

const ITEM = 'device-language';

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'vi' ? 'vi' : 'en';
  } catch {
    return 'en';
  }
}

function loadLang(): Lang {
  try {
    const saved = keychainBackend.get(ITEM);
    if (saved === 'en' || saved === 'vi') return saved;
  } catch {}
  return deviceLang();
}

interface LangStore {
  lang: Lang;
  setLang: (lang: Lang) => void;
}

export const useLangStore = create<LangStore>()((set) => ({
  lang: loadLang(),
  setLang: (lang) => {
    try {
      keychainBackend.set(ITEM, lang);
    } catch {}
    set({ lang });
  },
}));

export interface Localized {
  en: string;
  vi: string;
}

export interface Translate {
  (en: string, vi: string): string;
  (text: Localized): string;
}

function pick(lang: Lang): Translate {
  return ((en: string | Localized, vi?: string) => {
    const text = typeof en === 'string' ? { en, vi: vi ?? en } : en;
    return lang === 'vi' ? text.vi : text.en;
  }) as Translate;
}

export const t: Translate = ((en: string | Localized, vi?: string) =>
  pick(useLangStore.getState().lang)(en as string, vi as string)) as Translate;

export function useT(): Translate {
  const lang = useLangStore((s) => s.lang);
  return useMemo(() => pick(lang), [lang]);
}

export function useLang(): Lang {
  return useLangStore((s) => s.lang);
}
