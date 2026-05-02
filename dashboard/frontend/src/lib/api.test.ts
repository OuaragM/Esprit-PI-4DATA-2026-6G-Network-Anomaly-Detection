import { describe, expect, it } from "vitest";
import {
  appendHistory,
  clearHistory,
  clearSession,
  getHistoryEntry,
  getRefreshToken,
  getToken,
  getUser,
  listHistory,
  setSession,
  type BatchPrediction,
  type HistoryEntry,
  type User,
} from "./api";

const sampleUser: User = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "test@example.com",
  full_name: "Test User",
  role: "admin",
  is_active: true,
};

function makePrediction(rid: string, attackRate: number): BatchPrediction {
  return {
    request_id: rid,
    model_version: "v1",
    schema: "argus",
    n_rows: 10,
    predictions: Array(10).fill(0).map((_, i) => (i < Math.round(10 * attackRate) ? 1 : 0)),
    probabilities: Array(10).fill(0.5),
    gate_weights: Array(10).fill([0.2, 0.2, 0.2, 0.2, 0.2]),
    expert_order: ["eMBB", "mMTC", "URLLC", "TCP", "UDP"],
    summary: {
      n_attack_predicted: Math.round(10 * attackRate),
      n_benign_predicted: 10 - Math.round(10 * attackRate),
      mean_probability: 0.5,
      attack_rate: attackRate,
    },
  };
}

function makeEntry(rid: string, attackRate = 0.1): HistoryEntry {
  return {
    request_id: rid,
    ts: Date.now(),
    filename: "sample.csv",
    schema: "argus",
    n_rows: 10,
    attack_rate: attackRate,
    model_version: "v1",
    user_email: "test@example.com",
    prediction: makePrediction(rid, attackRate),
  };
}

describe("session", () => {
  it("setSession stores token + user", () => {
    setSession("abc123", sampleUser);
    expect(getToken()).toBe("abc123");
    expect(getUser()?.email).toBe("test@example.com");
  });

  it("setSession persists refresh token when provided", () => {
    setSession("abc123", sampleUser, "refresh-xyz");
    expect(getRefreshToken()).toBe("refresh-xyz");
  });

  it("clearSession wipes all three keys", () => {
    setSession("abc123", sampleUser, "refresh-xyz");
    clearSession();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getUser()).toBeNull();
  });

  it("getUser returns null for absent user", () => {
    expect(getUser()).toBeNull();
  });
});

describe("history (localStorage)", () => {
  it("listHistory starts empty", () => {
    expect(listHistory()).toEqual([]);
  });

  it("appendHistory inserts newest-first", () => {
    appendHistory(makeEntry("req-1"));
    appendHistory(makeEntry("req-2"));
    appendHistory(makeEntry("req-3"));
    const list = listHistory();
    expect(list.map((e) => e.request_id)).toEqual(["req-3", "req-2", "req-1"]);
  });

  it("getHistoryEntry finds by request_id", () => {
    appendHistory(makeEntry("alpha"));
    appendHistory(makeEntry("beta"));
    expect(getHistoryEntry("alpha")?.request_id).toBe("alpha");
    expect(getHistoryEntry("beta")?.request_id).toBe("beta");
    expect(getHistoryEntry("never")).toBeNull();
  });

  it("clearHistory empties the list", () => {
    appendHistory(makeEntry("x"));
    appendHistory(makeEntry("y"));
    clearHistory();
    expect(listHistory()).toEqual([]);
  });

  it("respects the 50-entry cap", () => {
    for (let i = 0; i < 60; i++) appendHistory(makeEntry(`r-${i}`));
    const list = listHistory();
    expect(list.length).toBe(50);
    // Newest are kept (i=59 was last inserted)
    expect(list[0].request_id).toBe("r-59");
    // Oldest survivors are at index 49
    expect(list[49].request_id).toBe("r-10");
  });
});
