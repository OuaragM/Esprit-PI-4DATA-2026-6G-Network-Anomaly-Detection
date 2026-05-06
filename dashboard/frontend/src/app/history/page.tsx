"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Icon, Kpi, Panel, fmtN, fmtPct } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import {
  clearHistory,
  listMergedHistory,
  type MergedHistoryEntry,
  type User,
} from "@/lib/api";

function timeAgo(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(ms: number | null): string {
  if (ms == null) return "—";
  return new Date(ms).toLocaleString();
}

function ActivityBars({ counts }: { counts: number[] }) {
  const max = Math.max(...counts, 1);
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 4, height: 74, padding: "4px 0" }}>
      {counts.map((count, index) => (
        <div key={index} style={{ flex: 1, display: "flex", alignItems: "end" }}>
          <div
            style={{
              width: "100%",
              height: `${Math.max(8, (count / max) * 100)}%`,
              borderRadius: 999,
              background: index % 5 === 0 ? "var(--accent)" : index % 2 === 0 ? "var(--ok)" : "var(--warn)",
              opacity: 0.9,
            }}
          />
        </div>
      ))}
    </div>
  );
}

type SchemaFilter = "all" | string;

function HistoryPage(_: { user: User }) {
  const [entries, setEntries] = useState<MergedHistoryEntry[]>([]);
  const [filter, setFilter] = useState<SchemaFilter>("all");
  const [search, setSearch] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listMergedHistory(100);
      setEntries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const schemas = useMemo(
    () => Array.from(new Set(entries.map((e) => e.schema).filter((s): s is string => !!s))).sort(),
    [entries],
  );

  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== "all" && e.schema !== filter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !(e.request_id.toLowerCase().includes(s))
          && !(e.model_version ?? "").toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [entries, filter, search]);

  const totals = useMemo(() => ({
    runs: visible.length,
    rows: visible.reduce((a, e) => a + (e.n_rows ?? 0), 0),
    attacks: visible.reduce((a, e) => a + (e.n_attack ?? 0), 0),
    avgRate: visible.length
      ? visible.reduce((a, e) => a + (e.attack_rate ?? 0), 0) / visible.length
      : 0,
  }), [visible]);

  const activityByDay = useMemo(() => {
    const buckets = Array(7).fill(0);
    const now = Date.now();
    visible.forEach((entry) => {
      const daysAgo = Math.floor((now - (entry.ts_ms ?? 0)) / (24 * 3600 * 1000));
      if (daysAgo >= 0 && daysAgo < 7) buckets[6 - daysAgo]++;
    });
    return buckets;
  }, [visible]);

  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return; }
    clearHistory();
    refresh();
    setConfirmClear(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">History</h1>
          <div className="page-desc">
            Past prediction runs from the <span className="mono">prediction_log</span> Postgres table,
            shared across all users. Full payload (per-row predictions) is still cached locally for the result page.
          </div>
        </div>
      </div>

      <div className="grid dash-grid">
        <div className="span-3"><Kpi label="Runs" value={fmtN(totals.runs)} sub={filter !== "all" ? `filtered: ${filter}` : "all schemas"} accent /></div>
        <div className="span-3"><Kpi label="Rows scored" value={fmtN(totals.rows)} /></div>
        <div className="span-3"><Kpi label="Attacks detected" value={fmtN(totals.attacks)} sub={totals.rows ? fmtPct(totals.attacks / totals.rows) + " of traffic" : "—"} /></div>
        <div className="span-3"><Kpi label="Avg attack rate" value={visible.length ? fmtPct(totals.avgRate) : "—"} /></div>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title="Activity pulse" subtitle="recent runs by day">
          <ActivityBars counts={activityByDay} />
          <div className="row" style={{ justifyContent: "space-between", fontSize: 11, color: "var(--fg-muted)" }}>
            <span>6d ago</span>
            <span>3d ago</span>
            <span>today</span>
          </div>
        </Panel>
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel
          title="Past scans"
          subtitle={loading ? "loading…" : `${visible.length} of ${entries.length} entries`}
          actions={
            <div className="row" style={{ gap: 8 }}>
              <Button variant="ghost" onClick={refresh}>Refresh</Button>
              <Button
                variant={confirmClear ? "danger" : "default"}
                onClick={handleClear}
                disabled={entries.length === 0}
                title="Clears local cache only — server history is preserved."
              >
                {confirmClear ? "Clear local cache?" : "Clear local cache"}
              </Button>
            </div>
          }
        >
          <div className="row" style={{ gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search request id, model version…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ flex: 1, minWidth: 260 }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="form-select"
              style={{ width: 160 }}
            >
              <option value="all">All schemas</option>
              {schemas.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {error && (
            <div className="alert alert-crit" style={{ marginBottom: 12 }}>
              <Icon name="warn" size={14} />
              <div className="alert-body" style={{ fontSize: 12 }}>{error}</div>
            </div>
          )}

          {loading ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>Loading…</div>
          ) : entries.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>
              No history yet. Run a scan from <Link href="/upload" style={{ color: "var(--accent)" }}>New scan</Link> to populate it.
            </div>
          ) : visible.length === 0 ? (
            <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>
              No entries match the current filters.
            </div>
          ) : (
            <div className="tbl-wrap" style={{ maxHeight: 540, overflow: "auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Schema</th>
                    <th className="num">Rows</th>
                    <th className="num">Attacks</th>
                    <th className="num">Attack rate</th>
                    <th>Model</th>
                    <th>Request ID</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.request_id}>
                      <td className="muted" title={fmtDate(e.ts_ms)}>{timeAgo(e.ts_ms)}</td>
                      <td>{e.schema ? <Badge tone="default">{e.schema}</Badge> : "—"}</td>
                      <td className="num">{fmtN(e.n_rows)}</td>
                      <td className="num">{fmtN(e.n_attack)}</td>
                      <td className="num">
                        {e.attack_rate != null ? (
                          <Badge tone={e.attack_rate > 0.3 ? "critical" : e.attack_rate > 0.1 ? "warn" : "benign"}>
                            {fmtPct(e.attack_rate)}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="mono muted" style={{ fontSize: 11 }}>{e.model_version ?? "—"}</td>
                      <td className="mono muted" style={{ fontSize: 11 }}>{e.request_id.slice(0, 8)}</td>
                      <td>
                        {e.has_full_payload ? (
                          <Link href={`/results/${e.request_id}`} style={{ color: "var(--accent)", fontSize: 12 }}>
                            Open →
                          </Link>
                        ) : (
                          <span
                            className="muted"
                            title="Full payload not in this browser's local cache. Re-run the scan or open from the same browser that ran it."
                            style={{ fontSize: 11 }}
                          >
                            (other device)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

export default function HistoryRoute() {
  return (
    <AppShell crumbs={["Workspace", "History"]}>
      {(user) => <HistoryPage user={user} />}
    </AppShell>
  );
}
