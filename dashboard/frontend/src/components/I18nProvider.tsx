"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANG_KEY, detectInitialLocale, t as tFn, type Locale, type StringKey } from "@/lib/i18n";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: StringKey | string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(detectInitialLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem(LANG_KEY, l);
    if (typeof document !== "undefined") document.documentElement.setAttribute("lang", l);
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", locale);
    }
  }, [locale, mounted]);

  const value = useMemo<I18nCtx>(
    () => ({
      locale,
      setLocale,
      t: (key) => tFn(locale, key),
    }),
    [locale, setLocale],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTranslation(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Provider not mounted yet (SSR / first render before useEffect) — fall back to EN.
    return {
      locale: "en",
      setLocale: () => undefined,
      t: (key) => tFn("en", key),
    };
  }
  return ctx;
}
