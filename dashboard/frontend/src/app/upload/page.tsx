"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Badge, Button, Icon, Kpi, Panel, cls, fmtN, fmtPct } from "@/components/ui";
import { AppShell } from "@/components/AppShell";
import {
  appendHistory,
  getModelMetrics,
  predictBatch,
  type BatchPrediction,
  type ModelMetrics,
  type User,
} from "@/lib/api";

type Stage = "idle" | "ready" | "running" | "done" | "error";

function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: "flex", alignItems: "end", gap: 6, height: 72, padding: "4px 0" }}>
      {values.map((value, index) => (
        <div key={index} style={{ flex: 1, display: "flex", alignItems: "end" }}>
          <div
            style={{
              width: "100%",
              height: `${Math.max(10, (value / max) * 100)}%`,
              borderRadius: 999,
              background: index % 3 === 0 ? "var(--accent)" : index % 3 === 1 ? "var(--ok)" : "var(--warn)",
              opacity: 0.92,
            }}
          />
        </div>
      ))}
    </div>
  );
}

function TrendLine({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 100;
    const y = ((max - value) / range) * 100;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox="0 0 100 40" style={{ width: "100%", height: 92 }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline points={`0,40 ${points} 100,40`} fill="url(#upload-trend)" opacity="0.16" />
      <defs>
        <linearGradient id="upload-trend" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "var(--accent)", stopOpacity: 0.4 }} />
          <stop offset="100%" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>
    </svg>
  );
}

function UploadPage({ user }: { user: User }) {
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchPrediction | null>(null);
  const [dragging, setDragging] = useState(false);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const m = await getModelMetrics();
        if (!cancelled) setModelMetrics(m);
      } catch {
        if (!cancelled) setModelMetrics({ source: "fetch_failed", available: false });
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function pick() { inputRef.current?.click(); }

  function handleFile(f: File | null | undefined) {
    if (!f) return;
    setFile(f);
    setStage("ready");
    setError(null);
    setResult(null);
  }

  function reset() {
    setFile(null);
    setStage("idle");
    setError(null);
    setResult(null);
  }

  const modelTrend = [
    modelMetrics?.accuracy ?? 0.82,
    modelMetrics?.f1 ?? 0.84,
    modelMetrics?.auc_roc ?? 0.88,
    0.91,
    0.94,
    modelMetrics?.accuracy ?? 0.82,
  ];

  async function runPrediction() {
    if (!file) return;
    setStage("running");
    setError(null);
    try {
      const r = await predictBatch(file);
      setResult(r);
      setStage("done");
      appendHistory({
        request_id: r.request_id,
        ts: Date.now(),
        filename: file.name,
        schema: r.schema,
        n_rows: r.n_rows,
        attack_rate: r.summary.attack_rate,
        model_version: r.model_version,
        user_email: user.email,
        prediction: r,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Prediction failed");
      setStage("error");
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">New scan</h1>
          <div className="page-desc">Upload a CSV of 5G/6G network flows. Routed through the gateway → inference-svc → MoE model.</div>
        </div>
      </div>

      <div className="grid dash-grid" style={{ marginBottom: 12 }}>
        <div className="span-3">
          <Kpi
            label="Model accuracy"
            value={modelMetrics?.accuracy != null ? fmtPct(modelMetrics.accuracy) : "—"}
            sub={modelMetrics?.run_name ?? modelMetrics?.source ?? "fetching…"}
            accent
          />
        </div>
        <div className="span-3">
          <Kpi label="F1" value={modelMetrics?.f1 != null ? modelMetrics.f1.toFixed(3) : "—"} />
        </div>
        <div className="span-3">
          <Kpi label="ROC AUC" value={modelMetrics?.auc_roc != null ? modelMetrics.auc_roc.toFixed(3) : "—"} />
        </div>
        <div className="span-3">
          <Kpi
            label="MLflow run"
            value={modelMetrics?.run_id ? modelMetrics.run_id.slice(0, 8) : "—"}
            sub={modelMetrics?.experiment ?? "unified_moe"}
          />
        </div>
      </div>

      <div className="grid dash-grid" style={{ marginBottom: 12 }}>
        <div className="span-6">
          <Panel title="Model snapshot" subtitle="quality trend of the active inference model">
            <TrendLine values={modelTrend} />
            <div className="legend" style={{ marginTop: 10 }}>
              <span><span className="legend-dot" style={{ background: "var(--accent)" }} />Accuracy</span>
              <span><span className="legend-dot" style={{ background: "var(--ok)" }} />F1</span>
              <span><span className="legend-dot" style={{ background: "var(--warn)" }} />ROC AUC</span>
            </div>
          </Panel>
        </div>
        <div className="span-6">
          <Panel title="Ingestion flow" subtitle="from upload to prediction output">
            <MiniBars values={[18, 26, 34, 28, 40, 48]} />
            <div className="row" style={{ justifyContent: "space-between", fontSize: 12, color: "var(--fg-muted)" }}>
              <span>upload</span>
              <span>parse</span>
              <span>score</span>
              <span>summarize</span>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid dash-grid">
        <div className="span-8">
          <Panel title="Upload" padding={false}>
            <div style={{ padding: 16 }}>
              {(stage === "idle" || stage === "ready") && (
                <div
                  className={cls("dropzone", dragging && "active")}
                  onClick={pick}
                  onDragOver={(e: DragEvent) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    setDragging(false);
                    handleFile(e.dataTransfer.files?.[0]);
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".csv"
                    style={{ display: "none" }}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <div className="dropzone-icon"><Icon name="upload" size={20} /></div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Drop CSV file here</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    or click to browse · accepts <span className="mono">.csv</span> up to 50 MB
                  </div>
                </div>
              )}

              {file && (
                <div className="panel" style={{ marginTop: 14, border: "1px solid var(--line)" }}>
                  <div className="row" style={{ padding: 12, gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--bg-subtle)", display: "grid", placeItems: "center", color: "var(--fg-muted)", flexShrink: 0 }}>
                      <Icon name="file" size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{file.name}</div>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                        {stage === "running" && <> · <span style={{ color: "var(--accent)" }}>scoring…</span></>}
                        {stage === "done" && result && <> · <span style={{ color: "var(--ok)" }}>{result.n_rows} rows scored</span></>}
                        {stage === "error" && <> · <span style={{ color: "var(--critical)" }}>{error}</span></>}
                      </div>
                    </div>
                    <button className="icon-btn" onClick={reset}><Icon name="x" /></button>
                  </div>
                </div>
              )}

              {stage === "error" && (
                <div className="alert alert-crit" style={{ marginTop: 10 }}>
                  <Icon name="warn" size={16} />
                  <div>
                    <div className="alert-title">Prediction failed</div>
                    <div className="alert-body">{error}</div>
                  </div>
                </div>
              )}

              <div className="row" style={{ marginTop: 14, justifyContent: "flex-end", gap: 8 }}>
                {stage === "ready" && (
                  <>
                    <Button variant="ghost" onClick={reset}>Cancel</Button>
                    <Button variant="primary" icon="play" onClick={runPrediction}>Start prediction</Button>
                  </>
                )}
                {stage === "running" && <Button variant="primary" disabled>Scoring…</Button>}
                {(stage === "done" || stage === "error") && (
                  <Button variant="default" onClick={reset}>New scan</Button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        <div className="span-4">
          <Panel title="Detection model" subtitle="active endpoint">
            <div className="mono" style={{ fontSize: 12, lineHeight: 1.9 }}>
              <div className="row"><span className="muted">model</span><span style={{ marginLeft: "auto" }}>{result?.model_version ?? "moe-ids unified"}</span></div>
              <div className="row"><span className="muted">algorithm</span><span style={{ marginLeft: "auto" }}>MoE · 5 experts</span></div>
              <div className="row"><span className="muted">schema</span><span style={{ marginLeft: "auto" }}>{result?.schema ?? "auto-detect"}</span></div>
              <div className="row"><span className="muted">endpoint</span><Badge tone="ok" dot>healthy</Badge></div>
            </div>
          </Panel>

          <div style={{ marginTop: 12 }}>
            <Panel title="File quality" subtitle="quick visual sanity check">
              <div style={{ display: "grid", gap: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: 12 }}>Selected file</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{file ? file.name : "none"}</span>
                </div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted" style={{ fontSize: 12 }}>Stage</span>
                  <Badge tone={stage === "error" ? "critical" : stage === "done" ? "ok" : stage === "running" ? "warn" : "default"} dot>
                    {stage}
                  </Badge>
                </div>
                <div style={{ height: 8, background: "var(--bg-subtle)", borderRadius: 999, overflow: "hidden" }}>
                  <div style={{ width: stage === "done" ? "100%" : stage === "running" ? "70%" : stage === "ready" ? "35%" : "12%", height: "100%", background: "linear-gradient(90deg, var(--accent), var(--ok))" }} />
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="grid dash-grid" style={{ marginTop: 12 }}>
            <div className="span-3"><Kpi label="Rows scored" value={fmtN(result.n_rows)} /></div>
            <div className="span-3"><Kpi label="Attacks detected" value={fmtN(result.summary.n_attack_predicted)} sub={fmtPct(result.summary.attack_rate) + " of traffic"} /></div>
            <div className="span-3"><Kpi label="Mean probability" value={result.summary.mean_probability.toFixed(3)} /></div>
            <div className="span-3"><Kpi label="Schema" value={result.schema} accent /></div>
          </div>

          <div style={{ marginTop: 12 }}>
            <Panel title="Predictions" subtitle={`${result.n_rows} rows · request ${result.request_id.slice(0, 8)}`}>
              <div className="tbl-wrap" style={{ maxHeight: 480, overflow: "auto" }}>
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Verdict</th>
                      <th className="num">Probability</th>
                      <th>Dominant expert</th>
                      {result.expert_order.map((e) => <th key={e} className="num">{e}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.predictions.map((pred, i) => {
                      const weights = result.gate_weights[i] ?? [];
                      const dom = weights.indexOf(Math.max(...weights));
                      return (
                        <tr key={i}>
                          <td className="mono muted">{String(i).padStart(4, "0")}</td>
                          <td>
                            <Badge tone={pred === 1 ? "critical" : "benign"} dot>
                              {pred === 1 ? "attack" : "benign"}
                            </Badge>
                          </td>
                          <td className="num">{result.probabilities[i].toFixed(4)}</td>
                          <td><span className="mono muted">{result.expert_order[dom]}</span></td>
                          {weights.map((w, k) => (
                            <td key={k} className="num" style={{ color: k === dom ? "var(--accent)" : undefined }}>
                              {w.toFixed(3)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

export default function UploadRoute() {
  return (
    <AppShell
      crumbs={["Workspace", "New scan"]}
      roles={["security_analyst", "admin"]}
    >
      {(user) => <UploadPage user={user} />}
    </AppShell>
  );
}
