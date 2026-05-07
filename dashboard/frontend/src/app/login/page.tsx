"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Icon, Mark } from "@/components/ui";
import { login } from "@/lib/api";

// ── Network topology for the animated canvas ─────────────────────────────────

const NODES = [
  { id: 0,  x: 120, y: 80,  r: 6,  label: "IoT",      kind: "iot"      },
  { id: 1,  x: 280, y: 50,  r: 5,  label: "Sensor",   kind: "iot"      },
  { id: 2,  x: 420, y: 120, r: 8,  label: "Gateway",  kind: "gateway"  },
  { id: 3,  x: 560, y: 70,  r: 5,  label: "Edge",     kind: "edge"     },
  { id: 4,  x: 680, y: 160, r: 10, label: "MoE IDS",  kind: "ids"      },
  { id: 5,  x: 200, y: 200, r: 5,  label: "Sensor",   kind: "iot"      },
  { id: 6,  x: 360, y: 260, r: 6,  label: "mMTC",     kind: "slice"    },
  { id: 7,  x: 520, y: 220, r: 6,  label: "eMBB",     kind: "slice"    },
  { id: 8,  x: 650, y: 300, r: 5,  label: "URLLC",    kind: "slice"    },
  { id: 9,  x: 100, y: 320, r: 5,  label: "Device",   kind: "iot"      },
  { id: 10, x: 250, y: 360, r: 6,  label: "Router",   kind: "edge"     },
  { id: 11, x: 430, y: 380, r: 5,  label: "Node",     kind: "iot"      },
  { id: 12, x: 600, y: 420, r: 8,  label: "Analyzer", kind: "ids"      },
  { id: 13, x: 150, y: 450, r: 5,  label: "Sensor",   kind: "iot"      },
  { id: 14, x: 340, y: 470, r: 5,  label: "Device",   kind: "iot"      },
  { id: 15, x: 720, y: 380, r: 6,  label: "Cloud",    kind: "gateway"  },
];

const EDGES = [
  [0, 2], [1, 2], [2, 3], [3, 4], [4, 7], [4, 8],
  [5, 6], [6, 7], [7, 8], [8, 12], [9, 10], [10, 6],
  [10, 11], [11, 12], [12, 15], [13, 10], [14, 11],
  [2, 6], [3, 7], [0, 5], [1, 3], [15, 4],
];

// Animated SVG network — pure CSS keyframes, no JS loop
function NetworkCanvas() {
  return (
    <svg
      viewBox="0 0 780 520"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.55 }}
      aria-hidden
    >
      <defs>
        {/* Glow filters */}
        <filter id="glow-green" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* Animated gradient for data flow along edges */}
        <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6366f1" stopOpacity="0" />
          <stop offset="50%"  stopColor="#6366f1" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes pulse-ring {
          0%   { r: 0; opacity: 0.6; }
          100% { r: 18; opacity: 0; }
        }
        @keyframes flow {
          from { stroke-dashoffset: 120; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes threat-blink {
          0%, 100% { opacity: 0.15; }
          50%      { opacity: 0.9; }
        }
        @keyframes node-breathe {
          0%, 100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        @keyframes packet {
          0%   { offset-distance: 0%;   opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { offset-distance: 100%; opacity: 0; }
        }
        .edge-base { stroke: #334155; stroke-width: 1; fill: none; opacity: 0.5; }
        .edge-flow {
          stroke: #6366f1; stroke-width: 1.5; fill: none;
          stroke-dasharray: 6 10; opacity: 0.6;
          animation: flow 2.4s linear infinite;
        }
        .node-ids { animation: node-breathe 2.2s ease-in-out infinite; }
        .node-threat { animation: threat-blink 1.4s ease-in-out infinite; }
        .ring { fill: none; stroke-width: 1; animation: pulse-ring 2s ease-out infinite; }
      `}</style>

      {/* Edges — base lines */}
      {EDGES.map(([a, b], i) => {
        const na = NODES[a], nb = NODES[b];
        const len = Math.hypot(nb.x - na.x, nb.y - na.y);
        return (
          <line key={`e${i}`}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            className="edge-base"
          />
        );
      })}

      {/* Edges — animated data flow (staggered) */}
      {EDGES.map(([a, b], i) => {
        const na = NODES[a], nb = NODES[b];
        const len = Math.hypot(nb.x - na.x, nb.y - na.y);
        const delay = `${(i * 0.31) % 3}s`;
        const dur   = `${1.8 + (i % 5) * 0.4}s`;
        return (
          <line key={`ef${i}`}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            className="edge-flow"
            style={{ animationDelay: delay, animationDuration: dur }}
          />
        );
      })}

      {/* Nodes */}
      {NODES.map((n) => {
        const isThreat  = n.id === 1;               // one "attacker" node
        const isIDS     = n.kind === "ids";
        const isGateway = n.kind === "gateway";
        const color = isThreat  ? "#ef4444"
                    : isIDS     ? "#6366f1"
                    : isGateway ? "#06b6d4"
                    : n.kind === "slice" ? "#8b5cf6"
                    : "#475569";
        const cls = isThreat ? "node-threat" : isIDS ? "node-ids" : "";
        return (
          <g key={`n${n.id}`}>
            {/* Pulse ring on IDS and gateway nodes */}
            {(isIDS || isGateway) && (
              <circle
                cx={n.x} cy={n.y} r={n.r}
                className="ring"
                stroke={color}
                style={{ animationDelay: `${n.id * 0.3}s`, animationDuration: "2.4s" }}
              />
            )}
            {/* Core node */}
            <circle
              cx={n.x} cy={n.y} r={n.r}
              fill={color}
              className={cls}
              filter={isIDS ? "url(#glow-blue)" : isThreat ? "url(#glow-red)" : undefined}
              opacity={isThreat ? 0.85 : 0.75}
            />
            {/* Inner dot for larger nodes */}
            {n.r >= 8 && (
              <circle cx={n.x} cy={n.y} r={n.r * 0.38} fill="#fff" opacity={0.4} />
            )}
          </g>
        );
      })}

      {/* Labels for key nodes */}
      {NODES.filter(n => n.r >= 6).map((n) => (
        <text key={`l${n.id}`}
          x={n.x} y={n.y + n.r + 10}
          textAnchor="middle"
          fontSize="9"
          fill="#64748b"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.03em"
        >
          {n.label}
        </text>
      ))}

      {/* Threat alert label */}
      <text x={NODES[1].x} y={NODES[1].y - 12}
        textAnchor="middle" fontSize="8" fill="#ef4444"
        fontFamily="ui-monospace, monospace"
        className="node-threat"
      >
        THREAT
      </text>
    </svg>
  );
}

// ── Login page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      router.push("/upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      {/* ── Left side — branding + animated network ── */}
      <div className="login-side">
        <NetworkCanvas />

        <div className="row" style={{ gap: 10, color: "var(--fg)", position: "relative" }}>
          <Mark size={22} />
          <div className="brand-name" style={{ fontSize: 16 }}>Verado</div>
        </div>

        <div style={{ maxWidth: 460, position: "relative" }}>
          <div className="tag" style={{ marginBottom: 12 }}>6G · ANOMALY DETECTION</div>
          <h1 style={{ fontSize: 28, letterSpacing: "-0.02em", fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
            Sub-second attack classification for sliced&nbsp;6G networks.
          </h1>
          <p className="muted" style={{ fontSize: 14, marginTop: 14, maxWidth: 420 }}>
            Batch inference, drift monitoring, and per-slice fairness — in one analyst console.
          </p>

          {/* Stat pills */}
          <div className="row" style={{ gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {[
              { label: "Detection latency", value: "<40 ms" },
              { label: "MoE experts",        value: "5"      },
              { label: "Network slices",     value: "3"      },
            ].map((s) => (
              <div key={s.label} style={{
                background: "color-mix(in srgb, var(--bg-elev) 70%, transparent)",
                border: "1px solid var(--line)",
                borderRadius: 10, padding: "8px 14px",
              }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)", letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 10, color: "var(--fg-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="muted" style={{ fontSize: 11, fontFamily: "var(--mono)", position: "relative" }}>
          © 2026 Esprit · 4DATA · MoE IDS
        </div>
      </div>

      {/* ── Right side — sign-in form ── */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <h2 className="login-title">Sign in</h2>
          <p className="login-sub">Access the detection console.</p>

          <div className="form-field">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="alert alert-crit" style={{ marginBottom: 12 }}>
              <Icon name="warn" size={14} />
              <div>
                <div className="alert-title">Sign-in failed</div>
                <div className="alert-body">{error}</div>
              </div>
            </div>
          )}

          <Button type="submit" variant="primary" size="lg" className="btn-block" disabled={loading}>
            {loading ? "Authenticating…" : "Continue"} <Icon name="arrow" size={14} />
          </Button>
        </form>
      </div>
    </div>
  );
}
