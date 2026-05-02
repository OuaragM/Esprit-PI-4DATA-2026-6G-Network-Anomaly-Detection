import { describe, expect, it } from "vitest";
import { ALLOWED_ROUTES, NAV_BY_ROLE, ROLE_LABELS, canAccess } from "./nav";

describe("nav.canAccess", () => {
  it("admin can reach every documented page", () => {
    for (const path of ALLOWED_ROUTES.admin) {
      expect(canAccess("admin", path)).toBe(true);
    }
  });

  it("security_analyst is blocked from admin pages", () => {
    expect(canAccess("security_analyst", "/users")).toBe(false);
    expect(canAccess("security_analyst", "/settings")).toBe(false);
    expect(canAccess("security_analyst", "/drift")).toBe(false);
    expect(canAccess("security_analyst", "/model")).toBe(false);
  });

  it("security_analyst can reach workspace pages", () => {
    expect(canAccess("security_analyst", "/dashboard")).toBe(true);
    expect(canAccess("security_analyst", "/upload")).toBe(true);
    expect(canAccess("security_analyst", "/history")).toBe(true);
    expect(canAccess("security_analyst", "/realtime")).toBe(true);
  });

  it("data_scientist can reach drift+model but not upload or users", () => {
    expect(canAccess("data_scientist", "/drift")).toBe(true);
    expect(canAccess("data_scientist", "/model")).toBe(true);
    expect(canAccess("data_scientist", "/upload")).toBe(false);
    expect(canAccess("data_scientist", "/users")).toBe(false);
  });

  it("treats /results/[id] subpaths as allowed when /results is allowed", () => {
    expect(canAccess("admin", "/results/abc-123")).toBe(true);
    expect(canAccess("security_analyst", "/results/abc-123")).toBe(true);
    expect(canAccess("data_scientist", "/results/abc-123")).toBe(true);
  });

  it("returns false for an unknown path", () => {
    expect(canAccess("admin", "/totally-fake-route")).toBe(false);
  });
});

describe("NAV_BY_ROLE", () => {
  it("admin nav contains the Administration section + admin pages", () => {
    const labels = NAV_BY_ROLE.admin
      .filter((it): it is { key: string; label: string; icon: string; href: string } => "key" in it)
      .map((it) => it.key);
    expect(labels).toContain("users");
    expect(labels).toContain("settings");
    expect(labels).toContain("drift");
    expect(labels).toContain("model");
  });

  it("security_analyst nav has no admin items", () => {
    const labels = NAV_BY_ROLE.security_analyst
      .filter((it): it is { key: string; label: string; icon: string; href: string } => "key" in it)
      .map((it) => it.key);
    expect(labels).not.toContain("users");
    expect(labels).not.toContain("model");
    expect(labels).not.toContain("drift");
  });

  it("data_scientist nav exposes Models section but not Administration", () => {
    const labels = NAV_BY_ROLE.data_scientist
      .filter((it): it is { key: string; label: string; icon: string; href: string } => "key" in it)
      .map((it) => it.key);
    expect(labels).toContain("drift");
    expect(labels).toContain("model");
    expect(labels).not.toContain("users");
    expect(labels).not.toContain("settings");
  });
});

describe("ROLE_LABELS", () => {
  it("provides a human label for every role", () => {
    expect(ROLE_LABELS.admin).toBeTruthy();
    expect(ROLE_LABELS.security_analyst).toBeTruthy();
    expect(ROLE_LABELS.data_scientist).toBeTruthy();
  });
});
