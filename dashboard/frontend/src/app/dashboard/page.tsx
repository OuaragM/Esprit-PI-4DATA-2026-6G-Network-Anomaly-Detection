"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Panel, fmtN, fmtPct } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import {
  driftLast,
  driftRun,
  getModelMetrics,
  listHistory,
  type DriftReport,
  type HistoryEntry,
  type ModelMetrics,
  type User,
} from "@/lib/api";

type HealthState = "ok" | "down" | "loading";

function timeAgo(ms: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function hourLabel(offset: number): string {
  const hour = new Date(Date.now() - offset * 3600 * 1000).getHours();
  return `${String(hour).padStart(2, "0")}h`;
}

function TrendChart({ data }: { data: number[] }) {
  if (data.length === 0) {
    return <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>No data</div>;
  }

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((value, index) => {
      const x = (index / Math.max(data.length - 1, 1)) * 100;
      const y = ((max - value) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const area = `0,40 ${points} 100,40`;

  return (
    <svg viewBox="0 0 100 40" style={{ width: "100%", height: 150 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trend-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
          <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
      <polyline points={area} fill="url(#trend-fill)" stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="0.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function HistogramChart({ data }: { data: number[] }) {
  if (data.length === 0) {
    return <div className="muted" style={{ padding: "40px 0", textAlign: "center" }}>No data</div>;
  }

  const max = Math.max(...data, 1);

  return (
    <svg viewBox="0 0 100 40" style={{ width: "100%", height: 150 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="bar-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.95 }} />
          <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0.35 }} />
        </linearGradient>
      </defs>
      {data.map((value, index) => {
        const width = 100 / data.length - 0.7;
        const x = (index / data.length) * 100 + 0.35;
        const h = (value / max) * 34;
        const y = 38 - h;
        return <rect key={index} x={x} y={y} width={width} height={h} rx="0.8" fill="url(#bar-fill)" />;
      })}
    </svg>
  );
}

function MetricCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, var(--bg-accent), var(--bg))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        minHeight: 118,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--fg-muted)", letterSpacing: 0.4, textTransform: "uppercase" }}>
            {label}
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.1, fontWeight: 700, marginTop: 8, color: tone || "var(--fg)" }}>
            {value}
          </div>
        </div>
      </div>
      {hint ? <div style={{ fontSize: 12, color: "var(--fg-hint)", marginTop: 8 }}>{hint}</div> : null}
    </div>
  );
}

function StatRow({ label, value, percent }: { label: string; value: string; percent?: number }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span style={{ color: "var(--fg-muted)" }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
      </div>
      {percent != null ? (
        <div style={{ height: 8, background: "var(--bg-elevated)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, percent))}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--accent), var(--ok))",
              borderRadius: 999,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function driftTone(report: DriftReport | null): "ok" | "warn" | "critical" | "default" {
  if (!report) return "default";
  if (report.status === "drift_detected") return "critical";
  if (report.status === "ok") return "ok";
  if (report.status === "no_data" || report.status === "no_run_yet") return "default";
  return "warn";
}

function HealthBadge({ state }: { state: HealthState }) {
  if (state === "loading") return <Badge tone="default" dot>checking…</Badge>;
  if (state === "ok") return <Badge tone="ok" dot>healthy</Badge>;
  return <Badge tone="critical" dot>unreachable</Badge>;
}

function todayCounts(history: HistoryEntry[]): { runs: number; rows: number; attacks: number } {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const cutoff = startOfDay.getTime();
  const today = history.filter((entry) => entry.ts >= cutoff);
  return {
    runs: today.length,
    rows: today.reduce((sum, entry) => sum + entry.n_rows, 0),
    attacks: today.reduce((sum, entry) => sum + Math.round(entry.n_rows * entry.attack_rate), 0),
  };
}

function DashboardPage({ user }: { user: User }) {
  const canRunDrift = user.role === "admin" || user.role === "data_scientist";

  const [model, setModel] = useState<ModelMetrics | null>(null);
  const [drift, setDrift] = useState<DriftReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [gwHealth, setGwHealth] = useState<HealthState>("loading");
  const [infHealth, setInfHealth] = useState<HealthState>("loading");
  const [runningDrift, setRunningDrift] = useState(false);
  const [driftError, setDriftError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(listHistory());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const currentModel = await getModelMetrics();
        if (!cancelled) setModel(currentModel);
      } catch {
        if (!cancelled) setModel({ source: "fetch_failed", available: false });
      }

      try {
        const currentDrift = await driftLast();
        if (!cancelled) setDrift(currentDrift);
      } catch {
        if (!cancelled) setDrift(null);
      }
    };

    load();
    const timer = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8090";
    const token = typeof window !== "undefined" ? localStorage.getItem("sentra_token") || "" : "";

    const probe = async (path: string, withAuth: boolean) => {
      try {
        const headers: Record<string, string> = {};
        if (withAuth && token) headers.Authorization = `Bearer ${token}`;
        const response = await fetch(`${apiBase}${path}`, { headers });
        return response.ok ? "ok" : "down";
      } catch {
        return "down";
      }
    };

    (async () => {
      setGwHealth((await probe("/health", false)) as HealthState);
      setInfHealth((await probe("/api/predict/health", true)) as HealthState);
    })();
  }, []);

  async function handleRunDrift() {
    setRunningDrift(true);
    setDriftError(null);
    try {
      const report = await driftRun({});
      setDrift(report);
    } catch (error) {
      setDriftError(error instanceof Error ? error.message : "Drift check failed");
    } finally {
      setRunningDrift(false);
    }
  }

  const today = todayCounts(history);
  const attackRateHistory = useMemo(() => history.slice(-24).map((entry) => entry.attack_rate * 100), [history]);
  const scanCountByHour = useMemo(() => {
    const now = Date.now();
    const buckets = Array(24).fill(0);
    history.forEach((entry) => {
      const hourIdx = Math.floor((now - entry.ts) / (3600 * 1000));
      if (hourIdx >= 0 && hourIdx < 24) buckets[23 - hourIdx]++;
    });
    return buckets;
  }, [history]);

  const attackRateNow = today.rows > 0 ? today.attacks / today.rows : 0;
  const attackRateAvg = attackRateHistory.length
    ? attackRateHistory.reduce((sum, value) => sum + value, 0) / attackRateHistory.length / 100
    : 0;
  const attackRatePeak = attackRateHistory.length ? Math.max(...attackRateHistory) / 100 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Network IDS Dashboard</h1>
          <div className="page-desc">Real-time threat detection, model performance, and live operational statistics</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <Badge tone="ok" dot>live</Badge>
          {user.role === "security_analyst" || user.role === "admin" ? (
            <Link href="/upload">
              <Button variant="primary" icon="upload">Upload Scan</Button>
            </Link>
          ) : null}
        </div>
      </div>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          <div style={{ gridColumn: "span 3" }}>
            <MetricCard
              label="Model Accuracy"
              value={model?.accuracy != null ? fmtPct(model.accuracy) : "—"}
              hint={model?.run_name || "Latest training run"}
              tone="var(--accent)"
            />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <MetricCard
              label="F1 Score"
              value={model?.f1 != null ? model.f1.toFixed(3) : "—"}
              hint={model?.available === false ? "model metrics unavailable" : "balanced detection quality"}
              tone={model?.f1 != null && model.f1 > 0.9 ? "var(--ok)" : "var(--accent)"}
            />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <MetricCard
              label="ROC AUC"
              value={model?.auc_roc != null ? model.auc_roc.toFixed(3) : "—"}
              hint="ranking quality across attack classes"
              tone={model?.auc_roc != null && model.auc_roc > 0.95 ? "var(--ok)" : "var(--accent)"}
            />
          </div>
          <div style={{ gridColumn: "span 3" }}>
            <MetricCard
              label="Scans Today"
              value={fmtN(today.runs)}
              hint={`${fmtN(today.rows)} rows processed`}
              tone="var(--accent)"
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          <div style={{ gridColumn: "span 6" }}>
            <Panel title="⚠️ Attack Detection Rate" subtitle="Last 24 hours, live trend and pressure overview">
              <TrendChart data={attackRateHistory} />
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 12 }}>
                <StatRow label="Current" value={fmtPct(attackRateNow)} percent={attackRateNow * 100} />
                <StatRow label="Average" value={fmtPct(attackRateAvg)} percent={attackRateAvg * 100} />
                <StatRow label="Peak" value={fmtPct(attackRatePeak)} percent={attackRatePeak * 100} />
              </div>
            </Panel>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <Panel title="📊 Scan Volume Trend" subtitle="Hourly throughput and activity histogram">
              <HistogramChart data={scanCountByHour} />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 12, color: "var(--fg-muted)" }}>
                <span>{hourLabel(23)}</span>
                <span style={{ fontWeight: 600 }}>{fmtN(history.length)} total scans</span>
                <span>{hourLabel(0)}</span>
              </div>
            </Panel>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
          <div style={{ gridColumn: "span 6" }}>
            <Panel title="🔍 System Health" subtitle="API and inference availability">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>API Gateway</span>
                  <HealthBadge state={gwHealth} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 13 }}>Inference</span>
                  <HealthBadge state={infHealth} />
                </div>
              </div>
            </Panel>

            <div style={{ marginTop: 16 }}>
              <Panel
                title="📈 Drift Detection"
                subtitle={drift?.window_days ? `${drift.window_days}d window` : "drift monitoring status"}
                actions={
                  canRunDrift ? (
                    <Button variant="default" size="sm" onClick={handleRunDrift} disabled={runningDrift}>
                      {runningDrift ? "⏳" : "▶"} Check
                    </Button>
                  ) : null
                }
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>Status</span>
                    <Badge tone={driftTone(drift)} dot>
                      {drift?.status === "drift_detected" ? "⚠️ Detected" : drift?.status === "ok" ? "✓ OK" : "—"}
                    </Badge>
                  </div>
                  {drift?.psi_attack_rate != null ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>PSI</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{drift.psi_attack_rate.toFixed(4)}</span>
                    </div>
                  ) : null}
                  {driftError ? <div style={{ fontSize: 12, color: "var(--critical)" }}>{driftError}</div> : null}
                </div>
              </Panel>
            </div>
          </div>

          <div style={{ gridColumn: "span 6" }}>
            <Panel title="📋 Data Summary" subtitle="Current period statistics and model snapshot">
              <div style={{ display: "grid", gap: 14 }}>
                <StatRow label="Total Attacks" value={fmtN(today.attacks)} percent={Math.min(100, attackRateNow * 100)} />
                <StatRow label="Rows Analyzed" value={fmtN(today.rows)} percent={Math.min(100, (today.rows % 1000) / 10)} />
                <StatRow label="Runs Today" value={fmtN(today.runs)} percent={Math.min(100, today.runs * 10)} />
              </div>
            </Panel>

            <div style={{ marginTop: 16 }}>
              <Panel title="🧭 Operational Insights" subtitle="Readable summary for quick decisions">
                <div style={{ display: "grid", gap: 12 }}>
                  <StatRow label="Detection confidence" value={model?.f1 != null ? model.f1.toFixed(3) : "—"} percent={model?.f1 != null ? model.f1 * 100 : 0} />
                  <StatRow label="Ranking quality" value={model?.auc_roc != null ? model.auc_roc.toFixed(3) : "—"} percent={model?.auc_roc != null ? model.auc_roc * 100 : 0} />
                  <StatRow label="Traffic pressure" value={attackRateNow > 0 ? fmtPct(attackRateNow) : "0.0%"} percent={attackRateNow * 100} />
                </div>
              </Panel>
            </div>
          </div>
        </div>

        <div>
          <Panel
            title="📝 Recent Scans"
            subtitle={history.length ? `${history.length} in cache` : "No activity yet"}
            actions={
              history.length > 0 ? (
                <Link href="/history">
                  <Button variant="default" size="sm">View All →</Button>
                </Link>
              ) : null
            }
          >
            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--fg-muted)" }}>
                <div style={{ fontSize: 14, marginBottom: 8 }}>No scans yet</div>
                <Link href="/upload" style={{ color: "var(--accent)", fontSize: 13 }}>
                  Upload your first network traffic file
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="tbl" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>Time</th>
                      <th style={{ textAlign: "left" }}>File</th>
                      <th style={{ textAlign: "center" }}>Schema</th>
                      <th style={{ textAlign: "right" }}>Rows</th>
                      <th style={{ textAlign: "right" }}>Attack %</th>
                      <th style={{ textAlign: "left" }}>User</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 8).map((entry) => (
                      <tr key={entry.request_id}>
                        <td style={{ fontSize: 12, color: "var(--fg-muted)" }}>{timeAgo(entry.ts)}</td>
                        <td style={{ fontSize: 12, fontFamily: "monospace" }}>{entry.filename}</td>
                        <td style={{ textAlign: "center" }}>
                          <Badge tone="default" dot>{entry.schema}</Badge>
                        </td>
                        <td style={{ textAlign: "right", fontSize: 12, fontWeight: 500 }}>{fmtN(entry.n_rows)}</td>
                        <td
                          style={{
                            textAlign: "right",
                            fontSize: 12,
                            fontWeight: 600,
                            color: entry.attack_rate > 0.05 ? "var(--critical)" : "var(--ok)",
                          }}
                        >
                          {fmtPct(entry.attack_rate)}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--fg-muted)" }}>{entry.user_email}</td>
                        <td style={{ textAlign: "center" }}>
                          <Link href={`/results/${entry.request_id}`} style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>
                            Details →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function DashboardRoute() {
  return (
    <AppShell crumbs={["Workspace", "Dashboard"]}>
      {(user) => <DashboardPage user={user} />}
    </AppShell>
  );
}
