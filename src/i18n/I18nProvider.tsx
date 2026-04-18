import * as React from "react";
import { translations, type Dict, type Lang } from "./translations";

const STORAGE_KEY = "talho-lang";

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const I18nContext = React.createContext<Ctx | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Lang>("pt");

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
      if (saved === "pt" || saved === "en") setLangState(saved);
    } catch {
      /* ignore */
    }
  }, []);

  const setLang = React.useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ lang, setLang, t: translations[lang] }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Locale-aware currency formatter (EUR for the butcher shop) */
export function useCurrency() {
  const { lang } = useI18n();
  return React.useCallback(
    (n: number) =>
      new Intl.NumberFormat(lang === "pt" ? "pt-PT" : "en-US", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0),
    [lang],
  );
}

export function useDateLocale() {
  const { lang } = useI18n();
  return lang === "pt" ? "pt-PT" : "en-US";
}
