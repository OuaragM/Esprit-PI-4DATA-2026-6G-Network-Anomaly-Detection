const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";
const TOKEN_KEY = "sentra_token";
const REFRESH_TOKEN_KEY = "sentra_refresh_token";
const USER_KEY = "sentra_user";

export type Role = "security_analyst" | "admin" | "data_scientist";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface BatchPrediction {
  request_id: string;
  model_version: string;
  schema: string;
  n_rows: number;
  predictions: number[];
  probabilities: number[];
  gate_weights: number[][];
  expert_order: string[];
  summary: {
    n_attack_predicted: number;
    n_benign_predicted: number;
    mean_probability: number;
    attack_rate: number;
  };
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function setSession(token: string, user: User, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function setAccessToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

interface RefreshResponse {
  access_token: string;
  token_type?: string;
}

/**
 * Mints a fresh access token from the stored refresh token.
 * Returns the new token, or null if refresh failed (caller should clear session).
 * Uses bare fetch (not request()) to avoid re-entering the 401 handler.
 */
let _refreshInflight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (_refreshInflight) return _refreshInflight;       // de-dupe parallel callers
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  _refreshInflight = (async () => {
    try {
      const r = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!r.ok) return null;
      const data = (await r.json()) as RefreshResponse;
      if (!data.access_token) return null;
      setAccessToken(data.access_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      _refreshInflight = null;
    }
  })();

  return _refreshInflight;
}

function buildHeaders(init: RequestInit, token: string | null): Headers {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return headers;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isAuthPath = path.startsWith("/api/auth/");
  const token = getToken();

  let resp = await fetch(`${API_BASE}${path}`, { ...init, headers: buildHeaders(init, token) });

  // On 401, try to mint a fresh access token via the refresh endpoint and
  // retry the original request once. Only fall back to /login if refresh fails.
  if (resp.status === 401 && !isAuthPath && typeof window !== "undefined") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      resp = await fetch(`${API_BASE}${path}`, { ...init, headers: buildHeaders(init, newToken) });
    }
    if (resp.status === 401) {
      clearSession();
      window.location.href = "/login";
      throw new Error("Session expired — please sign in again");
    }
  }

  if (!resp.ok) {
    let body: unknown;
    try { body = await resp.json(); } catch { body = await resp.text(); }

    // Unwrap FastAPI-style {"detail": ...} where ... is a string OR a dict OR an array
    let detail: unknown = body;
    if (body && typeof body === "object" && "detail" in body) {
      detail = (body as { detail: unknown }).detail;
    }

    let message: string;
    if (typeof detail === "string") {
      message = detail;
    } else if (detail && typeof detail === "object") {
      // Pretty-print the structured error so the user sees the real cause
      try {
        message = JSON.stringify(detail, null, 2);
      } catch {
        message = `HTTP ${resp.status}`;
      }
    } else {
      message = `HTTP ${resp.status}`;
    }

    throw new Error(`HTTP ${resp.status} — ${message}`);
  }
  return resp.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setSession(data.access_token, data.user, data.refresh_token);
  return data;
}

export async function predictBatch(file: File): Promise<BatchPrediction> {
  const form = new FormData();
  form.append("file", file);
  return request<BatchPrediction>("/api/predict/batch", {
    method: "POST",
    body: form,
  });
}

// ── Live model metrics (from MLflow last run, or baseline_stats fallback) ──

export interface ModelMetrics {
  source: string;
  available: boolean;
  run_id?: string;
  run_name?: string;
  experiment?: string;
  end_time_ms?: number;
  status?: string;
  accuracy?: number | null;
  f1?: number | null;
  recall?: number | null;
  pr_auc?: number | null;
  auc_roc?: number | null;
  version?: string;
  error?: string;
}

export async function getModelMetrics(): Promise<ModelMetrics> {
  return request<ModelMetrics>("/api/predict/metrics");
}

// ── Local history persistence (no DB yet — Phase B) ──────────────────────

const HISTORY_KEY = "sentra_history";
const HISTORY_LIMIT = 50;

export interface HistoryEntry {
  request_id: string;
  ts: number;                 // unix ms
  filename: string;
  schema: string;
  n_rows: number;
  attack_rate: number;
  model_version: string;
  user_email: string;
  prediction: BatchPrediction;
}

export function listHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function getHistoryEntry(requestId: string): HistoryEntry | null {
  return listHistory().find((e) => e.request_id === requestId) ?? null;
}

export function appendHistory(entry: HistoryEntry): void {
  if (typeof window === "undefined") return;
  const all = listHistory();
  all.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(all.slice(0, HISTORY_LIMIT)));
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(HISTORY_KEY);
}

// ── Server-side history (DB-backed via /api/predict/history) ─────────────

export interface ServerHistoryItem {
  request_id: string;
  ts_ms: number | null;
  model_version: string | null;
  schema: string | null;
  n_rows: number | null;
  n_attack: number | null;
  n_benign: number | null;
  mean_probability: number | null;
  attack_rate: number | null;
}

export interface ServerHistoryResponse {
  count: number;
  items: ServerHistoryItem[];
}

export async function listServerHistory(limit = 50): Promise<ServerHistoryResponse> {
  return request<ServerHistoryResponse>(`/api/predict/history?limit=${limit}`);
}

/**
 * Merged view: every server-side row is the source of truth, but if the same
 * request_id is also in localStorage we attach the full prediction payload so
 * "View →" works without an extra round-trip.
 */
export interface MergedHistoryEntry extends ServerHistoryItem {
  has_full_payload: boolean;
}

// ── Realtime (one-shot synthetic flow scoring) ───────────────────────────

export interface RealtimeFlow {
  request_id: string;
  ts_ms: number;
  row_index: number;
  verdict: 0 | 1;
  probability: number;
  dominant_expert: string;
  gate_weights: number[];
  expert_order: string[];
  model_version: string;
  preview: Record<string, unknown>;
}

export async function getRealtimeSample(): Promise<RealtimeFlow> {
  return request<RealtimeFlow>("/api/predict/sample");
}

export async function listMergedHistory(limit = 50): Promise<MergedHistoryEntry[]> {
  let server: ServerHistoryItem[] = [];
  try {
    const r = await listServerHistory(limit);
    server = r.items ?? [];
  } catch {
    // fallback to local-only if server unreachable
  }
  const local = listHistory();
  const localIds = new Set(local.map((e) => e.request_id));

  if (server.length === 0) {
    return local.map((e) => ({
      request_id: e.request_id,
      ts_ms: e.ts,
      model_version: e.prediction.model_version,
      schema: e.schema,
      n_rows: e.n_rows,
      n_attack: e.prediction.summary.n_attack_predicted,
      n_benign: e.prediction.summary.n_benign_predicted,
      mean_probability: e.prediction.summary.mean_probability,
      attack_rate: e.attack_rate,
      has_full_payload: true,
    }));
  }

  return server.map((s) => ({
    ...s,
    has_full_payload: localIds.has(s.request_id),
  }));
}

// ── Admin: user management (auth-svc /users + /auth/register via gateway) ──

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  full_name: string;
  role: Role;
}

export interface UpdateUserPayload {
  full_name?: string;
  role?: Role;
  is_active?: boolean;
}

export async function listUsers(): Promise<AdminUser[]> {
  return request<AdminUser[]>("/api/users");
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  return request<AdminUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<AdminUser> {
  return request<AdminUser>(`/api/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteUser(id: string): Promise<void> {
  await request<void>(`/api/users/${id}`, { method: "DELETE" });
}

export async function adminResetPassword(id: string, newPassword: string): Promise<void> {
  await request<void>(`/api/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ new_password: newPassword }),
  });
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await request<void>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

// ── Report PDF generation (report-svc via gateway) ───────────────────────

export interface ReportRequestPayload {
  prediction: BatchPrediction;
  filename?: string;
  user_email?: string;
  generated_at_ms?: number;
}

/**
 * Calls the report-svc via the gateway, receives a PDF, and triggers a
 * browser download. Resolves once the file save dialog is shown (or the
 * download starts in the user's downloads folder).
 */
export async function downloadReportPdf(payload: ReportRequestPayload): Promise<void> {
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Content-Type", "application/json");

  let resp = await fetch(`${API_BASE}/api/report/pdf`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  // Mirror request()'s 401 → refresh → retry-once flow for the binary path.
  if (resp.status === 401 && typeof window !== "undefined") {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${newToken}`);
      resp = await fetch(`${API_BASE}/api/report/pdf`, {
        method: "POST",
        headers: retryHeaders,
        body: JSON.stringify(payload),
      });
    }
    if (resp.status === 401) {
      clearSession();
      window.location.href = "/login";
      throw new Error("Session expired — please sign in again");
    }
  }

  if (!resp.ok) {
    let msg: string;
    try {
      const body = (await resp.json()) as { detail?: unknown };
      msg = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      msg = `HTTP ${resp.status}`;
    }
    throw new Error(`Report failed: ${msg}`);
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);

  // Try to honour Content-Disposition filename; fall back to request_id.
  let filename = `scan-${payload.prediction.request_id.slice(0, 8)}.pdf`;
  const cd = resp.headers.get("content-disposition") || "";
  const m = cd.match(/filename="?([^"]+)"?/i);
  if (m && m[1]) filename = m[1];

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Training ─────────────────────────────────────────────────────────────

export interface TrainOptions {
  data_5g?: string;
  data_6g?: string;
  artefacts_dir?: string;
  seed?: number;
  ae_epochs?: number;
  gate_epochs?: number;
  xgb_n_estimators?: number;
  mlflow_tracking_uri?: string;
  experiment?: string;
  no_mlflow?: boolean;
  reload_inference?: boolean;
}

export interface TrainStartResponse {
  status: "accepted" | string;
  message: string;
}

export interface TrainStatusResponse {
  running: boolean;
  last_result: null | {
    success: boolean;
    output?: string;
    error?: string;
    reload_inference?: { status_code: number | null; ok: boolean; error?: string };
  };
}

export async function trainStart(options: TrainOptions = {}): Promise<TrainStartResponse> {
  return request<TrainStartResponse>("/api/train/start", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function trainStatus(): Promise<TrainStatusResponse> {
  return request<TrainStatusResponse>("/api/train/status");
}

export async function trainReload(): Promise<void> {
  await request<void>("/api/train/reload", { method: "POST" });
}

// ── Drift / monitoring ───────────────────────────────────────────────────

export interface DriftOptions {
  window_days?: number;
  psi_threshold?: number;
  ks_p_threshold?: number;
}

export interface DriftReport {
  status: "ok" | "drift_detected" | "no_data" | "no_run_yet" | string;
  window_days?: number;
  n_requests?: number;
  baseline_attack_rate?: number;
  recent_mean_attack_rate?: number;
  psi_attack_rate?: number;
  psi_threshold?: number;
  ks_statistic?: number;
  ks_p_value?: number;
  ks_p_threshold?: number;
  alerts?: string[];
}

export async function driftRun(options: DriftOptions = {}): Promise<DriftReport> {
  return request<DriftReport>("/api/drift/run", {
    method: "POST",
    body: JSON.stringify(options),
  });
}

export async function driftLast(): Promise<DriftReport> {
  return request<DriftReport>("/api/drift/last");
}