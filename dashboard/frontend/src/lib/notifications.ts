/**
 * Notification synthesis: turns the periodic polls on driftLast() / trainStatus() /
 * getModelMetrics() into a stream of "events" the bell dropdown can display.
 *
 * Frontend-only — no new service plumbing. Each event is keyed by a stable id
 * so re-rendering the same state doesn't duplicate it.
 */
import {
  driftLast,
  getModelMetrics,
  listHistory,
  trainStatus,
  type DriftReport,
  type ModelMetrics,
  type TrainStatusResponse,
} from "@/lib/api";

export type NotificationKind =
  | "drift"
  | "training_success"
  | "training_failure"
  | "model_promoted"
  | "scan";

export interface Notification {
  id: string;          // stable per event (deduped on re-poll)
  kind: NotificationKind;
  ts: number;          // unix ms
  title: string;
  body: string;
  href?: string;       // optional: route to navigate to on click
  tone: "ok" | "warn" | "critical" | "info";
}

const READ_KEY = "sentra_notifications_read";

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(READ_KEY, JSON.stringify(m));
}

export function isRead(id: string): boolean {
  return readMap()[id] === true;
}

export function markRead(id: string): void {
  const m = readMap();
  m[id] = true;
  writeMap(m);
}

export function markAllRead(ids: string[]): void {
  const m = readMap();
  for (const id of ids) m[id] = true;
  writeMap(m);
}

/**
 * Build the latest notification snapshot from current backend state.
 * Returns events sorted newest-first, capped at 20.
 */
export async function fetchNotifications(): Promise<Notification[]> {
  const out: Notification[] = [];

  // ── Drift ────────────────────────────────────────────────────────────
  let drift: DriftReport | null = null;
  try { drift = await driftLast(); } catch { /* ignore */ }
  if (drift && drift.status === "drift_detected") {
    const psi = drift.psi_attack_rate ?? 0;
    out.push({
      id: `drift:${psi.toFixed(4)}:${drift.window_days ?? 0}`,
      kind: "drift",
      ts: Date.now(),
      title: "Drift detected",
      body: `PSI ${psi.toFixed(3)} ≥ threshold ${drift.psi_threshold ?? "?"} on a ${drift.window_days ?? "?"}-day window`,
      href: "/drift",
      tone: "critical",
    });
  }

  // ── Training ─────────────────────────────────────────────────────────
  let train: TrainStatusResponse | null = null;
  try { train = await trainStatus(); } catch { /* ignore */ }
  if (train?.last_result) {
    const last = train.last_result;
    if (last.success) {
      out.push({
        id: `train_ok:${(last.output ?? "").length}`,
        kind: "training_success",
        ts: Date.now(),
        title: "Training run succeeded",
        body: last.reload_inference?.ok
          ? "Model artefacts saved and inference service hot-reloaded."
          : "Model artefacts saved.",
        href: "/model",
        tone: "ok",
      });
    } else {
      out.push({
        id: `train_fail:${(last.error ?? "").slice(0, 40)}`,
        kind: "training_failure",
        ts: Date.now(),
        title: "Training run failed",
        body: (last.error ?? "Unknown error").split("\n")[0].slice(0, 120),
        href: "/model",
        tone: "critical",
      });
    }
  }
  if (train?.running) {
    out.push({
      id: "train_running",
      kind: "training_success",
      ts: Date.now(),
      title: "Training in progress",
      body: "A training run is currently active.",
      href: "/model",
      tone: "info",
    });
  }

  // ── Model registry ───────────────────────────────────────────────────
  let model: ModelMetrics | null = null;
  try { model = await getModelMetrics(); } catch { /* ignore */ }
  if (model?.run_id && model.end_time_ms) {
    out.push({
      id: `model:${model.run_id}`,
      kind: "model_promoted",
      ts: model.end_time_ms,
      title: "Active model version",
      body: `${model.run_name ?? model.run_id.slice(0, 8)} · F1 ${model.f1?.toFixed(3) ?? "—"} · ROC AUC ${model.auc_roc?.toFixed(3) ?? "—"}`,
      href: "/model",
      tone: "info",
    });
  }

  // ── Recent scans (your own) ──────────────────────────────────────────
  for (const h of listHistory().slice(0, 3)) {
    out.push({
      id: `scan:${h.request_id}`,
      kind: "scan",
      ts: h.ts,
      title: `Scan: ${h.filename}`,
      body: `${h.n_rows} rows scored · attack rate ${(h.attack_rate * 100).toFixed(1)}%`,
      href: `/results/${h.request_id}`,
      tone: h.attack_rate > 0.3 ? "warn" : "ok",
    });
  }

  out.sort((a, b) => b.ts - a.ts);
  return out.slice(0, 20);
}
