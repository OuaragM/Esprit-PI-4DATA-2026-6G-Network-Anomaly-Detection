"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Icon, Kpi, Panel, fmtN, fmtPct } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import { getRealtimeSample, type RealtimeFlow, type User } from "@/lib/api";

const MAX_FLOWS = 100;
const POLL_MS = 2000;

function timeStamp(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

function RealtimePage(_: { user: User }) {
  const [flows, setFlows] = useState<RealtimeFlow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(POLL_MS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function tickOnce() {
    getRealtimeSample()
      .then((f) => {
        setFlows((prev) => [f, ...prev].slice(0, MAX_FLOWS));
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Polling failed");
      });
  }

  function start() {
    if (intervalRef.current) return;
    setRunning(true);
    tickOnce();
    intervalRef.current = setInterval(tickOnce, pollMs);
  }

  function stop() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setRunning(false);
  }

  function clearFeed() {
    setFlows([]);
  }

  // Re-arm interval if pollMs changes while running
  useEffect(() => {
    if (running && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tickOnce, pollMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const stats = useMemo(() => {
    const n = flows.length;
    const attacks = flows.filter((f) => f.verdict === 1).length;
    const meanProb = n ? flows.reduce((a, f) => a + f.probability, 0) / n : 0;
    return { n, attacks, attackRate: n ? attacks / n : 0, meanProb };
  }, [flows]);

  const expertCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flows) m.set(f.dominant_expert, (m.get(f.dominant_expert) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [flows]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Realtime feed</h1>
          <div className="page-desc">
            Simulated live stream of 6G flows. Each tick samples a random row from the cleaned dataset,
            scores it through the MoE model, and prepends it to the feed. Attack predictions in red.
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          {!running ? (
            <Button variant="primary" icon="play" onClick={start}>Start feed</Button>
          ) : (
            <Button variant="default" onClick={stop}>Stop</Button>
          )}
          <Button variant="ghost" onClick={clearFeed} disabled={flows.length === 0}>Clear</Button>
        </div>
      </div>

      <div className="grid dash-grid">
        <div className="span-3">
          <Kpi
            label="Flows scored"
            value={fmtN(stats.n)}
            sub={running ? `polling every ${pollMs / 1000}s` : "stopped"}
            accent
          />
        </div>
        <div className="span-3">
          <Kpi label="Attacks" value={fmtN(stats.attacks)} sub={fmtPct(stats.attackRate) + " of feed"} />
        </div>
        <div className="span-3">
          <Kpi label="Mean probability" value={stats.meanProb.toFixed(3)} />
        </div>
        <div className="span-3">
          <Panel title="Polling interval">
            <div className="row" style={{ gap: 6, alignItems: "center", padding: "6px 0" }}>
              {[1000, 2000, 5000].map((ms) => (
                <Button
                  key={ms}
                  size="sm"
                  variant={pollMs === ms ? "primary" : "ghost"}
                  onClick={() => setPollMs(ms)}
                >
                  {ms / 1000}s
                </Button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid dash-grid" style={{ marginTop: 12 }}>
        <div className="span-8">
          <Panel
            title="Live flows"
            subtitle={`last ${flows.length} (cap ${MAX_FLOWS})`}
            actions={
              running
                ? <Badge tone="ok" dot>streaming</Badge>
                : flows.length > 0
                  ? <Badge tone="warn" dot>paused</Badge>
                  : <Badge tone="default">idle</Badge>
            }
          >
            {error && (
              <div className="alert alert-crit" style={{ marginBottom: 12 }}>
                <Icon name="warn" size={14} />
                <div className="alert-body" style={{ fontSize: 12 }}>{error}</div>
              </div>
            )}
            {flows.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "20px 0" }}>
                Click <strong>Start feed</strong> above to begin streaming flows.
              </div>
            ) : (
              <div className="tbl-wrap" style={{ maxHeight: 540, overflow: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Verdict</th>
                      <th className="num">Prob.</th>
                      <th>Expert</th>
                      <th>Row #</th>
                      <th>Request</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flows.map((f) => (
                      <tr key={f.request_id}>
                        <td className="muted mono" style={{ fontSize: 11 }}>{timeStamp(f.ts_ms)}</td>
                        <td>
                          <Badge tone={f.verdict === 1 ? "critical" : "benign"} dot>
                            {f.verdict === 1 ? "attack" : "benign"}
                          </Badge>
                        </td>
                        <td className="num">{f.probability.toFixed(4)}</td>
                        <td><span className="mono muted">{f.dominant_expert}</span></td>
                        <td className="mono muted" style={{ fontSize: 11 }}>{f.row_index}</td>
                        <td className="mono muted" style={{ fontSize: 11 }}>{f.request_id.slice(0, 8)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="span-4">
          <Panel title="Expert distribution" subtitle="dominant expert per flow">
            {expertCounts.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "10px 0" }}>No flows yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {expertCounts.map(([name, count]) => {
                  const pct = stats.n ? count / stats.n : 0;
                  return (
                    <div key={name}>
                      <div className="row" style={{ justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                        <span className="mono">{name}</span>
                        <span className="muted">{count} · {fmtPct(pct)}</span>
                      </div>
                      <div style={{
                        height: 6, borderRadius: 3,
                        background: "var(--bg-subtle)", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", width: `${pct * 100}%`,
                          background: "var(--accent)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

export default function RealtimeRoute() {
  return (
    <AppShell crumbs={["Workspace", "Realtime feed"]}>
      {(user) => <RealtimePage user={user} />}
    </AppShell>
  );
}
