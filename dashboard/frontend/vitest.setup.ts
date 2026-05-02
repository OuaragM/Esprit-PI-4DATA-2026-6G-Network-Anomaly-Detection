// Test environment shims. happy-dom already provides DOM + localStorage,
// but stub out the bits our code defensively touches.

import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  // Clean localStorage between tests so cross-test pollution can't bite.
  if (typeof window !== "undefined") {
    window.localStorage.clear();
  }
  // Stub fetch by default — individual tests override with vi.spyOn(globalThis, "fetch").
  if (!("fetch" in globalThis)) {
    // @ts-expect-error — happy-dom may already define this
    globalThis.fetch = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});
