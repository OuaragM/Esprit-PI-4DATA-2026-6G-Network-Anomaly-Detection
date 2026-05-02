"use client";

import { useTranslation } from "@/components/I18nProvider";
import { LOCALES, type Locale } from "@/lib/i18n";

export function LangToggle() {
  const { locale, setLocale } = useTranslation();
  return (
    <div
      role="group"
      aria-label="Language"
      style={{
        display: "inline-flex",
        border: "1px solid var(--line)",
        borderRadius: 6,
        overflow: "hidden",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.4,
      }}
    >
      {LOCALES.map((l: Locale) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          style={{
            padding: "4px 8px",
            background: locale === l ? "var(--accent)" : "transparent",
            color: locale === l ? "var(--accent-fg, #fff)" : "var(--fg-muted)",
            border: 0,
            cursor: "pointer",
          }}
          title={l === "en" ? "English" : "Français"}
          aria-pressed={locale === l}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
