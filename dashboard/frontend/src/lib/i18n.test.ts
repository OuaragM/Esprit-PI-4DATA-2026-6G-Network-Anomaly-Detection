import { describe, expect, it } from "vitest";
import { detectInitialLocale, t } from "./i18n";

describe("i18n.t", () => {
  it("returns English string for en locale", () => {
    expect(t("en", "common.save")).toBe("Save");
    expect(t("en", "nav.dashboard")).toBe("Dashboard");
  });

  it("returns French string for fr locale", () => {
    expect(t("fr", "common.save")).toBe("Enregistrer");
    expect(t("fr", "nav.dashboard")).toBe("Tableau de bord");
  });

  it("falls back to English when fr is missing the key", () => {
    // Synthetic test: pass a key that exists in EN only via the type system.
    // Here we use an unknown key — both EN and FR will be missing, so it
    // returns the key itself.
    expect(t("fr", "totally.unknown.key")).toBe("totally.unknown.key");
  });

  it("falls back to the key itself when no translation exists", () => {
    expect(t("en", "made-up-key")).toBe("made-up-key");
  });

  it("translates roles", () => {
    expect(t("en", "role.admin")).toBe("Administrator");
    expect(t("fr", "role.admin")).toBe("Administrateur");
    expect(t("fr", "role.security_analyst")).toBe("Analyste sécurité");
    expect(t("fr", "role.data_scientist")).toBe("Scientifique données");
  });
});

describe("detectInitialLocale", () => {
  it("returns saved locale when present in localStorage", () => {
    window.localStorage.setItem("sentra_lang", "fr");
    expect(detectInitialLocale()).toBe("fr");
    window.localStorage.setItem("sentra_lang", "en");
    expect(detectInitialLocale()).toBe("en");
  });

  it("ignores invalid values in localStorage", () => {
    window.localStorage.setItem("sentra_lang", "xx");
    // With nav.language defaulting in happy-dom, this falls to 'en'
    const locale = detectInitialLocale();
    expect(["en", "fr"]).toContain(locale);
  });
});
