"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Icon, Kpi, Panel, fmtN, fmtPct } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import {
  FLOW_SCENARIOS,
  getRealtimeSample,
  type FlowScenario,
  type RealtimeFlow,
  type User,
} from "@/lib/api";

const MAX_FLOWS = 100;
const POLL_MS = 2000;

const SCENARIO_LABELS: Record<FlowScenario, string> = {
  mixed: "Mixed traffic",
  benign: "Benign only",
  syn_flood: "SYN flood",
  port_scan: "Port scan",
  ddos: "DDoS",
  exfiltration: "Data exfiltration",
};

const SCENARIO_TONES: Record<string, "benign" | "critical" | "warn" | "default"> = {
  benign: "benign",
  syn_flood: "critical",
  port_scan: "warn",
  ddos: "critical",
  exfiltration: "warn",
  mixed: "default",
};

function timeStamp(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

function RealtimePage(_: { user: User }) {
  const [flows, setFlows] = useState<RealtimeFlow[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollMs, setPollMs] = useState(POLL_MS);
  const [scenario, setScenario] = useState<FlowScenario>("mixed");
  const [attackRate, setAttackRate] = useState(0.15);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest values in refs so the interval callback always reads fresh
  const scenarioRef = useRef(scenario);
  const attackRateRef = useRef(attackRate);
  useEffect(() => { scenarioRef.current = scenario; }, [scenario]);
  useEffect(() => { attackRateRef.current = attackRate; }, [attackRate]);

  function tickOnce() {
    getRealtimeSample({ scenario: scenarioRef.current, attackRate: attackRateRef.current })
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

  function clearFeed() { setFlows([]); }

  // Re-arm interval if pollMs changes while running
  useEffect(() => {
    if (running && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(tickOnce, pollMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollMs]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const stats = useMemo(() => {
    const n = flows.length;
    const attacks = flows.filter((f) => f.verdict === 1).length;
    const correct = flows.filter((f) => f.correct).length;
    const meanProb = n ? flows.reduce((a, f) => a + f.probability, 0) / n : 0;
    return {
      n,
      attacks,
      attackRate: n ? attacks / n : 0,
      correct,
      accuracy: n ? correct / n : 0,
      meanProb,
    };
  }, [flows]);

  const expertCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flows) m.set(f.dominant_expert, (m.get(f.dominant_expert) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [flows]);

  const scenarioCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of flows) m.set(f.flow.scenario, (m.get(f.flow.scenario) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [flows]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Realtime feed</h1>
          <div className="page-desc">
            Synthetic flow generator. Each tick samples + perturbs a row according to the chosen scenario,
            scores it through the MoE model, and prepends to the live feed. Crank the scenario to a real
            attack and watch the bell ping <strong>drift detected</strong> within a minute.
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

      {/* Scenario controls */}
      <div style={{ marginBottom: 12 }}>
        <Panel title="Scenario controls" subtitle="changes apply to the next tick">
          <div className="grid dash-grid">
            <div className="span-5">
              <label className="form-row">
                <span className="muted" style={{ fontSize: 13, width: 110 }}>Scenario</span>
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value as FlowScenario)}
                  className="form-select"
                  style={{ flex: 1 }}
                >
                  {FLOW_SCENARIOS.map((s) => (
                    <option key={s} value={s}>{SCENARIO_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="span-5">
              <label className="form-row">
                <span className="muted" style={{ fontSize: 13, width: 110 }}>Attack rate</span>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={attackRate}
                  disabled={scenario !== "mixed"}
                  onChange={(e) => setAttackRate(Number(e.target.value))}
                  style={{ flex: 1 }}
                />
                <span className="mono" style={{ fontSize: 12, width: 56, textAlign: "right" }}>
                  {fmtPct(attackRate)}
                </span>
              </label>
            </div>
            <div className="span-2">
              <Panel title="Tick interval">
                <div className="row" style={{ gap: 4, alignItems: "center", padding: "4px 0" }}>
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
          {scenario !== "mixed" && (
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
              In <strong>{SCENARIO_LABELS[scenario]}</strong> mode every flow is generated as that attack type.
              Switch to <strong>Mixed</strong> to use the attack-rate slider.
            </div>
          )}
        </Panel>
      </div>

      {/* KPI strip */}
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
          <Kpi label="Attacks predicted" value={fmtN(stats.attacks)} sub={fmtPct(stats.attackRate) + " of feed"} />
        </div>
        <div className="span-3">
          <Kpi
            label="Detection accuracy"
            value={stats.n ? fmtPct(stats.accuracy) : "—"}
            sub={`${stats.correct}/${stats.n} matched ground truth`}
          />
        </div>
        <div className="span-3">
          <Kpi label="Mean probability" value={stats.meanProb.toFixed(3)} />
        </div>
      </div>

      {/* Live flows table + side panels */}
      <div className="grid dash-grid" style={{ marginTop: 12 }}>
        <div className="span-9">
          <Panel
            title="Live flows"
            subtitle={`last ${flows.length} (cap ${MAX_FLOWS})`}
            actions={
              running && error
                ? <Badge tone="critical" dot>polling errors</Badge>
                : running
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
                      <th>Source → Destination</th>
                      <th>Scenario</th>
                      <th>Verdict</th>
                      <th>Truth</th>
                      <th></th>
                      <th className="num">Prob.</th>
                      <th>Expert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flows.map((f) => (
                      <tr key={f.request_id}>
                        <td className="muted mono" style={{ fontSize: 11 }}>{timeStamp(f.ts_ms)}</td>
                        <td className="mono" style={{ fontSize: 11 }}>
                          {f.flow.src_ip}:{f.flow.src_port}
                          <span className="muted"> → </span>
                          {f.flow.dst_ip}:{f.flow.dst_port}
                        </td>
                        <td>
                          <Badge tone={SCENARIO_TONES[f.flow.scenario] ?? "default"}>
                            {f.flow.scenario}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={f.verdict === 1 ? "critical" : "benign"} dot>
                            {f.verdict === 1 ? "attack" : "benign"}
                          </Badge>
                        </td>
                        <td>
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {f.ground_truth === 1 ? "attack" : "benign"}
                          </span>
                        </td>
                        <td>
                          {f.correct
                            ? <span style={{ color: "var(--ok)", fontSize: 14 }} title="Prediction matches ground truth">✓</span>
                            : <span style={{ color: "var(--critical)", fontSize: 14 }} title="Mismatch — investigate">✗</span>}
                        </td>
                        <td className="num">{f.probability.toFixed(4)}</td>
                        <td><span className="mono muted" style={{ fontSize: 11 }}>{f.dominant_expert}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <div className="span-3">
          <Panel title="Scenario mix" subtitle="seen in feed">
            {scenarioCounts.length === 0 ? (
              <div className="muted" style={{ fontSize: 13, padding: "10px 0" }}>No flows yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {scenarioCounts.map(([name, count]) => {
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
                          background: SCENARIO_TONES[name] === "critical"
                            ? "var(--critical)"
                            : SCENARIO_TONES[name] === "warn"
                              ? "var(--warn)"
                              : "var(--accent)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <div style={{ marginTop: 12 }}>
            <Panel title="Expert distribution" subtitle="dominant per flow">
              {expertCounts.length === 0 ? (
                <div className="muted" style={{ fontSize: 13, padding: "10px 0" }}>—</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {expertCounts.map(([name, count]) => {
                    const pct = stats.n ? count / stats.n : 0;
                    return (
                      <div key={name}>
                        <div className="row" style={{ justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                          <span className="mono">{name}</span>
                          <span className="muted">{count}</span>
                        </div>
                        <div style={{
                          height: 4, borderRadius: 2,
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
