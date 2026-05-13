"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { clearSession } from "@/lib/api";
import "./landing.css";

type Lang = "fr" | "en";

type TourStep = {
  title: { fr: string; en: string };
  desc: { fr: string; en: string };
  url: string;
  pills: string[];
};

const TOUR: TourStep[] = [
  {
    title: { fr: "Connexion sécurisée", en: "Secure sign-in" },
    desc: {
      fr: "JWT signé, RBAC à trois rôles (admin · analyst · viewer), audit log immuable de chaque tentative. Aucune session persistée côté navigateur.",
      en: "Signed JWT, 3-role RBAC (admin · analyst · viewer), immutable audit log of every attempt. No browser session is persisted.",
    },
    url: "/login",
    pills: ["JWT", "RBAC · 3 roles", "bcrypt", "audit log"],
  },
  {
    title: { fr: "Tableau de bord", en: "Dashboard overview" },
    desc: {
      fr: "Vue d'ensemble en direct : débit, taux d'attaque, latence P95, détections ouvertes. Tout est lié à un widget Grafana.",
      en: "Live overview: throughput, attack rate, P95 latency, open detections. Everything is wired to a Grafana widget.",
    },
    url: "/console/overview",
    pills: ["Grafana", "Prometheus", "WebSocket", "live"],
  },
  {
    title: { fr: "Upload & Prédiction", en: "Upload & Predict" },
    desc: {
      fr: "Glissez un fichier .pcap (jusqu'à 500 Mo), sélectionnez la slice cible, lancez. Les résultats arrivent en streaming dans l'onglet suivant.",
      en: "Drop a .pcap file (up to 500 MB), pick the target slice, run. Results stream into the next tab.",
    },
    url: "/console/predict",
    pills: [".pcap", "NetFlow v9", "MinIO S3", "async · Celery"],
  },
  {
    title: { fr: "Prédictions temps réel", en: "Real-time predictions" },
    desc: {
      fr: "Flux WebSocket. Chaque ligne montre le verdict, l'expert qui l'a produit, le score calibré et la latence individuelle.",
      en: "WebSocket stream. Each row shows the verdict, the producing expert, the calibrated score and per-flow latency.",
    },
    url: "/console/stream",
    pills: ["WebSocket", "expert routing", "Platt-calibrated"],
  },
  {
    title: { fr: "Historique", en: "History" },
    desc: {
      fr: "Recherche, filtres par slice, par verdict, par fenêtre temporelle. Export CSV pour analyse, PDF signé pour le SOC.",
      en: "Search, filters by slice, verdict and time window. CSV export for analysis, signed PDF for the SOC.",
    },
    url: "/console/history",
    pills: ["CSV", "PDF · reportlab", "filters", "signed"],
  },
  {
    title: { fr: "Détection de dérive", en: "Drift detection" },
    desc: {
      fr: "PSI et KS sur fenêtre glissante de 7 jours, par feature. Au-delà du seuil, le pipeline de réentraînement se déclenche automatiquement.",
      en: "PSI and KS on a 7-day rolling window, per feature. Past the threshold, the retraining pipeline auto-triggers.",
    },
    url: "/console/drift",
    pills: ["PSI", "KS", "auto-retrain", "Slack alert"],
  },
  {
    title: { fr: "Registre des modèles", en: "Model registry" },
    desc: {
      fr: "MLflow embarqué : compare les runs, promeut un challenger en staging, rollback en un clic. F1, recall et PR-AUC pour chaque version.",
      en: "Embedded MLflow: compare runs, promote a challenger to staging, rollback in one click. F1, recall and PR-AUC per version.",
    },
    url: "/console/models",
    pills: ["MLflow", "auto-promote", "rollback", "A/B"],
  },
  {
    title: { fr: "Administration", en: "Administration" },
    desc: {
      fr: "Gestion des utilisateurs et rôles, clés d'API, webhooks Slack et SIEM. Toute mutation laisse une trace dans le journal d'audit.",
      en: "Users and roles, API keys, Slack and SIEM webhooks. Every mutation leaves a trace in the audit log.",
    },
    url: "/console/admin",
    pills: ["RBAC", "webhooks", "audit log", "SIEM"],
  },
];

const STEP_ACCENTS = ["#D08243", "#3b82f6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];

const BOT_REPLIES: Record<Lang, string[]> = {
  fr: [
    "Verado est un IDS comportemental, pas une liste de signatures. On apprend la forme du trafic, et on signale ce qui en sort.",
    "L'architecture MoE combine 3 XGBoost (slices 5G) et 2 autoencodeurs (protocoles 6G), unifiés par un MLP de gating.",
    "P95 mesuré à 147 ms par batch de 100 flux. Pour la latence individuelle, comptez ~5 ms.",
    "Le déploiement tient en un docker compose up. 21 services, Grafana et Prometheus déjà câblés.",
    "Bonne question — la réponse complète est dans la doc. Voulez-vous que je vous y envoie ?",
  ],
  en: [
    "Verado is a behavioural IDS, not a signature list. We learn the shape of traffic and flag what drifts.",
    "The MoE architecture combines 3 XGBoost (5G slices) and 2 autoencoders (6G protocols), unified by a gating MLP.",
    "P95 measured at 147 ms per 100-flow batch. Per-flow you can expect ~5 ms.",
    "Deployment is one docker compose up. 21 services, Grafana and Prometheus pre-wired.",
    "Good question — the full answer is in the docs. Want me to send you over?",
  ],
};

/* ── helpers ─────────────────────────────────────────────────────── */

function T({ fr, en, lang }: { fr: ReactNode; en: ReactNode; lang: Lang }) {
  return <>{lang === "fr" ? fr : en}</>;
}

function Counter({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting && !started.current) {
            started.current = true;
            const dur = 1400;
            const start = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - start) / dur);
              const eased = 1 - Math.pow(1 - p, 3);
              setVal(to * eased);
              if (p < 1) requestAnimationFrame(tick);
              else setVal(to);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [to]);
  return (
    <span ref={ref} className="count">
      {decimals ? val.toFixed(decimals) : Math.round(val)}
    </span>
  );
}

function Bar({ fill }: { fill: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            setWidth(fill);
            io.disconnect();
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [fill]);
  return (
    <div ref={ref} className="bar">
      <i style={{ width: `${width}%` }} />
    </div>
  );
}

/* ── SVG sprite ──────────────────────────────────────────────────── */

function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <symbol id="mark" viewBox="0 0 240 240">
          <g stroke="currentColor" fill="none" opacity="0.5" strokeWidth="2.4" strokeLinecap="round">
            <line x1="44" y1="48" x2="84" y2="124" />
            <line x1="44" y1="48" x2="156" y2="124" />
            <line x1="120" y1="48" x2="84" y2="124" />
            <line x1="120" y1="48" x2="156" y2="124" />
            <line x1="196" y1="48" x2="84" y2="124" />
            <line x1="196" y1="48" x2="156" y2="124" />
          </g>
          <g stroke="currentColor" fill="none" strokeWidth="3.8" strokeLinecap="round">
            <line x1="84" y1="124" x2="120" y2="200" />
            <line x1="156" y1="124" x2="120" y2="200" />
          </g>
          <g fill="currentColor">
            <circle cx="44" cy="48" r="8" />
            <circle cx="120" cy="48" r="8" />
            <circle cx="196" cy="48" r="8" />
            <circle cx="84" cy="124" r="10" />
            <circle cx="156" cy="124" r="10" />
            <circle cx="120" cy="200" r="14" fill="var(--node-out, currentColor)" />
          </g>
        </symbol>
        <symbol id="arrow-r" viewBox="0 0 16 16"><path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="arrow-d" viewBox="0 0 16 16"><path d="M8 3 V13 M4 9 L8 13 L12 9" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="arrow-l" viewBox="0 0 16 16"><path d="M13 8 H3 M7 4 L3 8 L7 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="plus" viewBox="0 0 16 16"><path d="M8 3 V13 M3 8 H13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></symbol>
        <symbol id="check" viewBox="0 0 16 16"><path d="M3 8.5 L7 12 L13 4.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="ico-shield" viewBox="0 0 32 32"><path d="M16 4 L26 8 V16 C26 22 21 26 16 28 C11 26 6 22 6 16 V8 Z" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="16" cy="16" r="3" fill="currentColor" /></symbol>
        <symbol id="ico-clock" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M16 9 V16 L20 19" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></symbol>
        <symbol id="ico-loop" viewBox="0 0 32 32"><path d="M8 12 A8 8 0 0 1 22 9 M24 20 A8 8 0 0 1 10 23" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" /><path d="M22 5 V11 H16 M10 27 V21 H16" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" /></symbol>
        <symbol id="ico-ops" viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="20" stroke="currentColor" strokeWidth="1.4" fill="none" rx="1" /><path d="M4 11 H28 M10 16 H22 M10 20 H18" stroke="currentColor" strokeWidth="1.2" /></symbol>
        <symbol id="ic-moe" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="6" cy="8" r="2" /><circle cx="16" cy="8" r="2" /><circle cx="26" cy="8" r="2" /><circle cx="11" cy="18" r="2.5" /><circle cx="21" cy="18" r="2.5" /><circle cx="16" cy="26" r="3" /><line x1="6" y1="10" x2="11" y2="16" /><line x1="16" y1="10" x2="11" y2="16" /><line x1="16" y1="10" x2="21" y2="16" /><line x1="26" y1="10" x2="21" y2="16" /><line x1="11" y1="20" x2="16" y2="24" /><line x1="21" y1="20" x2="16" y2="24" /></g></symbol>
        <symbol id="ic-zero" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="16" cy="16" r="1.2" fill="currentColor" /><path d="M16 2 V6 M16 26 V30 M2 16 H6 M26 16 H30" stroke="currentColor" strokeWidth="1.4" /></symbol>
        <symbol id="ic-bolt" viewBox="0 0 32 32"><path d="M18 3 L7 18 H15 L13 29 L25 13 H17 Z" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinejoin="round" /></symbol>
        <symbol id="ic-drift" viewBox="0 0 32 32"><path d="M4 22 L10 14 L14 18 L20 8 L28 16" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /><circle cx="20" cy="8" r="2" fill="currentColor" /><path d="M3 26 H29" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" /></symbol>
        <symbol id="ic-lock" viewBox="0 0 32 32"><rect x="7" y="14" width="18" height="14" stroke="currentColor" strokeWidth="1.4" fill="none" rx="1" /><path d="M11 14 V10 A5 5 0 0 1 21 10 V14" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="16" cy="21" r="2" fill="currentColor" /></symbol>
        <symbol id="ic-mlops" viewBox="0 0 32 32"><circle cx="16" cy="16" r="11" stroke="currentColor" strokeWidth="1.4" fill="none" strokeDasharray="3 2" /><path d="M16 9 V16 L22 19" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /><circle cx="16" cy="16" r="2" fill="currentColor" /></symbol>
        <symbol id="up-city" viewBox="0 0 60 40"><g fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 36 H56" /><rect x="6" y="20" width="8" height="16" /><rect x="16" y="14" width="10" height="22" /><rect x="28" y="22" width="8" height="14" /><rect x="38" y="10" width="12" height="26" /><circle cx="18" cy="6" r="2" /><path d="M18 6 V2 M14 9 L18 6 L22 9" strokeLinecap="round" /></g></symbol>
        <symbol id="up-fact" viewBox="0 0 60 40"><g fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M4 36 H56 M8 36 V18 L18 24 V18 L28 24 V18 L38 24 V12 H50 V36" /><rect x="42" y="20" width="4" height="6" fill="currentColor" /></g></symbol>
        <symbol id="up-lab" viewBox="0 0 60 40"><g fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="14" cy="14" r="3" /><circle cx="30" cy="22" r="3" /><circle cx="46" cy="12" r="3" /><circle cx="44" cy="28" r="2" /><path d="M16 16 L28 21 M32 22 L44 14 M32 24 L43 27" /></g></symbol>
        <symbol id="pg-esprit" viewBox="0 0 32 32"><path d="M6 8 L16 4 L26 8 L26 18 L16 26 L6 18 Z" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M11 13 H21 M11 17 H18" stroke="currentColor" strokeWidth="1.4" /></symbol>
        <symbol id="pg-mlflow" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M11 16 L16 11 L21 16 L16 21 Z" stroke="currentColor" strokeWidth="1.4" fill="none" /></symbol>
        <symbol id="pg-prom" viewBox="0 0 32 32"><circle cx="16" cy="16" r="10" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M16 6 V16 L22 22" stroke="currentColor" strokeWidth="1.4" fill="none" /><circle cx="16" cy="16" r="2" fill="currentColor" /></symbol>
        <symbol id="pg-grafana" viewBox="0 0 32 32"><path d="M4 24 L10 16 L14 20 L20 10 L28 18" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="pg-docker" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="6" y="16" width="4" height="4" /><rect x="11" y="16" width="4" height="4" /><rect x="16" y="16" width="4" height="4" /><rect x="11" y="11" width="4" height="4" /><path d="M4 20 H22 C24 20 25 18 23 17" strokeLinecap="round" /></g></symbol>
        <symbol id="pg-gh" viewBox="0 0 32 32"><path d="M16 4 C9 4 4 9 4 16 C4 21.5 7.5 26 12.5 27.5 V24 C9 24.5 8 22 8 22 C7.5 20.5 6.5 20 6.5 20 C5 19 7 19 7 19 C8.5 19 9.5 20.5 9.5 20.5 C11 22.5 13.5 22 14.5 21.5 C14.5 20.5 15 19.5 15.5 19 C12 18.5 9 17 9 12.5 C9 11 9.5 9.5 10.5 8.5 C10 8 9.5 6 10.5 4 C10.5 4 12 4 14 5.5 C15 5 16 5 17 5 C18 5 19 5 20 5.5 C22 4 23.5 4 23.5 4 C24.5 6 24 8 23.5 8.5 C24.5 9.5 25 11 25 12.5 C25 17 22 18.5 18.5 19 C19 19.5 19.5 20.5 19.5 22 V27.5 C24.5 26 28 21.5 28 16 C28 9 23 4 16 4 Z" stroke="currentColor" strokeWidth="1.2" fill="none" /></symbol>
        <symbol id="send" viewBox="0 0 16 16"><path d="M2 8 L14 8 M9 3 L14 8 L9 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></symbol>
      </defs>
    </svg>
  );
}

/* ── dashboard mocks (1:1 with the design's preview-mock blocks) ──── */

function MockLogin() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav">verado.io/login</div>
      </div>
      <div className="mk-body" style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 260, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 600, fontSize: 18, letterSpacing: "-0.02em" }}>Se connecter</div>
          <div style={{ fontSize: 11, color: "var(--mute)" }}>Veuillez vous authentifier pour accéder à la console.</div>
          <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", padding: "9px 11px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)" }}>analyste@verado.io</div>
          <div style={{ background: "var(--paper-2)", border: "1px solid var(--line)", padding: "9px 11px", borderRadius: 3, fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)" }}>••••••••••</div>
          <div style={{ background: "var(--ink)", color: "var(--paper)", padding: "9px 11px", borderRadius: 3, fontSize: 11, fontWeight: 600, textAlign: "center" }}>Continuer →</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", color: "var(--mute)", textAlign: "center", marginTop: 4, textTransform: "uppercase" }}>JWT · RBAC · bcrypt</div>
        </div>
      </div>
    </>
  );
}

function MockDashboard() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span className="on">Overview</span><span>Predict</span><span>History</span><span>Drift</span><span>Models</span></div>
      </div>
      <div className="mk-body">
        <div className="mk-row">
          <div className="mk-card"><div className="lab">flows / s</div><div className="val">142k</div></div>
          <div className="mk-card"><div className="lab">attack rate</div><div className="val sig">3.8%</div></div>
          <div className="mk-card"><div className="lab">P95 latency</div><div className="val">147ms</div></div>
          <div className="mk-card"><div className="lab">open</div><div className="val sig">3</div></div>
        </div>
        <div className="mk-card" style={{ flex: 1 }}>
          <div className="lab">flow telemetry · last 60s</div>
          <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <path d="M0 60 L40 58 L80 55 L120 52 L160 48 L200 50 L240 14 L260 45 L300 50 L340 52 L400 50" stroke="var(--ink)" strokeWidth="1.5" fill="none" />
            <path d="M0 60 L40 58 L80 55 L120 52 L160 48 L200 50 L240 14 L260 45 L300 50 L340 52 L400 50 L400 80 L0 80 Z" fill="var(--signal)" opacity="0.12" />
            <circle cx="240" cy="14" r="3.5" fill="var(--signal)" />
          </svg>
        </div>
      </div>
    </>
  );
}

function MockUpload() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>Overview</span><span className="on">Predict</span><span>History</span></div>
      </div>
      <div className="mk-body">
        <div style={{ border: "1.5px dashed var(--line-2)", borderRadius: 4, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--paper-2)" }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" stroke="var(--ink-2)" strokeWidth="1.3"><path d="M16 6 V22 M9 13 L16 6 L23 13" strokeLinecap="round" /><path d="M5 26 H27" /></svg>
          <div style={{ fontFamily: "'Inter Tight',sans-serif", fontWeight: 600, fontSize: 14 }}>Glissez un fichier .pcap</div>
          <div style={{ fontSize: 11, color: "var(--mute)" }}>ou cliquez pour parcourir · max 500 MB</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            <span style={{ padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--paper)" }}>eMBB</span>
            <span style={{ padding: "3px 8px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--paper)" }}>mMTC</span>
            <span style={{ padding: "3px 8px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--paper)", borderRadius: 999 }}>URLLC ✓</span>
          </div>
        </div>
      </div>
    </>
  );
}

const streamRow = (bg: string, border: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "70px 60px 1fr 70px 60px",
  gap: 8,
  padding: "6px 10px",
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: 3,
  alignItems: "center",
});

function MockRealtime() {
  const base = streamRow("var(--paper-2)", "var(--line)");
  const alert = { ...streamRow("oklch(0.96 0.05 28)", "oklch(0.78 0.12 28)"), padding: "8px 10px" } as React.CSSProperties;
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>Overview</span><span className="on">Stream</span><span>History</span></div>
      </div>
      <div className="mk-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontFamily: "var(--mono)", fontSize: 10.5 }}>
          <div style={base}><span style={{ color: "var(--mute)" }}>14:02:42</span><span>URLLC</span><span style={{ color: "var(--ink)" }}>192.168.4.21 → core-7</span><span style={{ color: "var(--ok)", fontWeight: 600 }}>benign</span><span style={{ color: "var(--mute)" }}>0.03</span></div>
          <div style={base}><span style={{ color: "var(--mute)" }}>14:02:43</span><span>eMBB</span><span style={{ color: "var(--ink)" }}>10.0.7.99 → cdn-2</span><span style={{ color: "var(--ok)", fontWeight: 600 }}>benign</span><span style={{ color: "var(--mute)" }}>0.08</span></div>
          <div style={alert}><span style={{ color: "var(--mute)" }}>14:02:44</span><span>URLLC</span><span style={{ color: "var(--ink)", fontWeight: 600 }}>14B-uplink · ddos-syn</span><span style={{ color: "var(--crit)", fontWeight: 700 }}>attack</span><span>0.94</span></div>
          <div style={base}><span style={{ color: "var(--mute)" }}>14:02:45</span><span>mMTC</span><span style={{ color: "var(--ink)" }}>sensor-bus-04</span><span style={{ color: "var(--ok)", fontWeight: 600 }}>benign</span><span style={{ color: "var(--mute)" }}>0.11</span></div>
          <div style={base}><span style={{ color: "var(--mute)" }}>14:02:46</span><span>TCP-6G</span><span style={{ color: "var(--ink)" }}>edge-cluster-2</span><span style={{ color: "var(--warn)", fontWeight: 600 }}>suspect</span><span style={{ color: "var(--mute)" }}>0.62</span></div>
        </div>
      </div>
    </>
  );
}

function MockHistory() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>Stream</span><span className="on">History</span><span>Drift</span></div>
      </div>
      <div className="mk-body">
        <div className="mk-row">
          <div className="mk-card"><div className="lab">7d total</div><div className="val">2.4M</div></div>
          <div className="mk-card"><div className="lab">attacks</div><div className="val sig">91k</div></div>
          <div className="mk-card"><div className="lab">false +</div><div className="val">0.4%</div></div>
        </div>
        <div className="mk-card" style={{ flex: 1 }}>
          <div className="lab">attack rate · 7 days</div>
          <svg viewBox="0 0 400 70" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <g fill="var(--ink-2)">
              <rect x="10" y="40" width="40" height="22" />
              <rect x="60" y="32" width="40" height="30" />
              <rect x="110" y="38" width="40" height="24" />
              <rect x="160" y="20" width="40" height="42" fill="var(--signal)" />
              <rect x="210" y="36" width="40" height="26" />
              <rect x="260" y="44" width="40" height="18" />
              <rect x="310" y="42" width="40" height="20" />
            </g>
          </svg>
        </div>
      </div>
    </>
  );
}

function MockDrift() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>History</span><span className="on">Drift</span><span>Models</span></div>
      </div>
      <div className="mk-body">
        <div className="mk-row">
          <div className="mk-card"><div className="lab">PSI overall</div><div className="val sig">0.34</div></div>
          <div className="mk-card"><div className="lab">KS · pkt_rate</div><div className="val">0.18</div></div>
          <div className="mk-card"><div className="lab">retrain in</div><div className="val">04h 12m</div></div>
        </div>
        <div className="mk-card" style={{ flex: 1 }}>
          <div className="lab">PSI · 7d rolling</div>
          <svg viewBox="0 0 400 80" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
            <line x1="0" y1="50" x2="400" y2="50" stroke="var(--line-2)" strokeDasharray="2 3" />
            <line x1="0" y1="30" x2="400" y2="30" stroke="var(--signal)" strokeDasharray="2 3" opacity="0.5" />
            <path d="M0 56 L50 54 L100 50 L150 48 L200 44 L250 38 L300 32 L350 28 L400 22" stroke="var(--ink)" strokeWidth="1.5" fill="none" />
            <circle cx="400" cy="22" r="3.5" fill="var(--signal)" />
            <text x="6" y="28" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="var(--signal)">threshold 0.2</text>
          </svg>
        </div>
      </div>
    </>
  );
}

const modelRow = (bg: string, border: string): React.CSSProperties => ({
  display: "grid",
  gridTemplateColumns: "60px 1fr 70px 60px 70px",
  gap: 8,
  padding: "7px 10px",
  background: bg,
  border: `1px solid ${border}`,
  borderRadius: 3,
  alignItems: "center",
});

function MockModels() {
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>Drift</span><span className="on">Models</span><span>Admin</span></div>
      </div>
      <div className="mk-body" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 70px 60px 70px", gap: 8, padding: "6px 10px", color: "var(--mute)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase" }}><span>ver</span><span>name</span><span>stage</span><span>F1</span><span>ts</span></div>
        <div style={modelRow("var(--paper-2)", "var(--line)")}><span>v 14</span><span>urllc-xgb</span><span style={{ color: "var(--ok)", fontWeight: 600 }}>prod</span><span>0.946</span><span style={{ color: "var(--mute)" }}>12 mai</span></div>
        <div style={modelRow("var(--paper-2)", "var(--line)")}><span>v 13</span><span>urllc-xgb</span><span style={{ color: "var(--mute)" }}>archive</span><span>0.921</span><span style={{ color: "var(--mute)" }}>28 avr</span></div>
        <div style={modelRow("var(--paper-2)", "var(--line)")}><span>v 09</span><span>ae-tcp-6g</span><span style={{ color: "var(--ok)", fontWeight: 600 }}>prod</span><span>0.918</span><span style={{ color: "var(--mute)" }}>02 mai</span></div>
        <div style={modelRow("oklch(0.96 0.04 70)", "oklch(0.85 0.10 70)")}><span>v 15</span><span>urllc-xgb</span><span style={{ color: "var(--warn)", fontWeight: 600 }}>staging</span><span>0.952</span><span style={{ color: "var(--mute)" }}>~ promote</span></div>
      </div>
    </>
  );
}

function MockAdmin() {
  const auditRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "60px 60px 1fr", gap: 10 };
  return (
    <>
      <div className="mk-topbar">
        <div className="brand-mini"><svg viewBox="0 0 240 240"><use href="#mark" /></svg> Verado</div>
        <div className="nav"><span>Models</span><span className="on">Admin</span></div>
      </div>
      <div className="mk-body">
        <div className="mk-row">
          <div className="mk-card"><div className="lab">users</div><div className="val">14</div></div>
          <div className="mk-card"><div className="lab">roles</div><div className="val">3</div></div>
          <div className="mk-card"><div className="lab">api keys</div><div className="val">8</div></div>
          <div className="mk-card"><div className="lab">webhooks</div><div className="val">5</div></div>
        </div>
        <div className="mk-card" style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 10.5 }}>
          <div className="lab">audit · last hour</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
            <div style={auditRow}><span style={{ color: "var(--mute)" }}>14:01</span><span style={{ color: "var(--ok)" }}>+create</span><span>api-key · ingest-prod-2</span></div>
            <div style={auditRow}><span style={{ color: "var(--mute)" }}>13:54</span><span style={{ color: "var(--signal)" }}>~promote</span><span>urllc-xgb · v15 → staging</span></div>
            <div style={auditRow}><span style={{ color: "var(--mute)" }}>13:38</span><span style={{ color: "var(--mute)" }}>·role</span><span>amine.t · analyst → admin</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

const MOCKS = [MockLogin, MockDashboard, MockUpload, MockRealtime, MockHistory, MockDrift, MockModels, MockAdmin];

/* ── main page ───────────────────────────────────────────────────── */

export default function LandingPage() {
  const [lang, setLang] = useState<Lang>("fr");
  const [navScrolled, setNavScrolled] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [toast, setToast] = useState(false);
  const [newsState, setNewsState] = useState<"" | "ok" | "err">("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<Array<{ role: "bot" | "user"; text: string }>>([
    {
      role: "bot",
      text: "Bonjour. Je peux répondre aux questions techniques sur l'architecture, le modèle MoE, le déploiement ou la console.",
    },
  ]);
  const replyIdx = useRef(0);
  const cbBodyRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const newsTimer = useRef<number | undefined>(undefined);

  // Security: clear any auth on landing mount so /dashboard always requires re-login
  useEffect(() => {
    clearSession();
  }, []);

  // Scroll-aware nav
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Smooth-scroll for anchor clicks
  const onAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const href = e.currentTarget.getAttribute("href") || "";
    if (!href.startsWith("#")) return;
    const el = document.getElementById(href.slice(1));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Auto-scroll chat body on new messages
  useEffect(() => {
    const node = cbBodyRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chatLog]);

  function showToast() {
    setToast(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(false), 4000);
  }

  function onContactSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    (e.currentTarget as HTMLFormElement).reset();
    showToast();
  }

  function onNewsSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setNewsState(valid ? "ok" : "err");
    if (valid) form.reset();
    if (newsTimer.current) window.clearTimeout(newsTimer.current);
    newsTimer.current = window.setTimeout(() => setNewsState(""), 4500);
  }

  function sendChat() {
    const v = chatInput.trim();
    if (!v) return;
    const bank = BOT_REPLIES[lang];
    const reply = bank[replyIdx.current % bank.length];
    replyIdx.current += 1;
    setChatLog((log) => [...log, { role: "user", text: v }]);
    setChatInput("");
    window.setTimeout(() => {
      setChatLog((log) => [...log, { role: "bot", text: reply }]);
    }, 600);
  }

  const accent = STEP_ACCENTS[currentStep];
  const tourStep = TOUR[currentStep];

  return (
    <div className="verado-landing">
      <SvgDefs />

      {/* ══ NAV ══════════════════════════════════════════════════════ */}
      <nav className={`nav${navScrolled ? " scrolled" : ""}`}>
        <div className="container">
          <a href="#top" className="brand" aria-label="Verado" onClick={onAnchorClick}>
            <svg className="mark" viewBox="0 0 240 240"><use href="#mark" /></svg>
            <span className="word">Verado</span>
            <span className="tag">6G IDS</span>
          </a>
          <div className="nav-links">
            <a href="#solution" onClick={onAnchorClick}>Solution</a>
            <a href="#objectifs" onClick={onAnchorClick}><T fr="Objectifs" en="Goals" lang={lang} /></a>
            <a href="#avantages" onClick={onAnchorClick}><T fr="Avantages" en="Why" lang={lang} /></a>
            <a href="#fonctionnement" onClick={onAnchorClick}><T fr="Fonctionnement" en="How it works" lang={lang} /></a>
            <a href="#tour" onClick={onAnchorClick}><T fr="Visite guidée" en="Walkthrough" lang={lang} /></a>
            <a href="#partenaires" onClick={onAnchorClick}><T fr="Partenaires" en="Partners" lang={lang} /></a>
            <a href="#contact" onClick={onAnchorClick}>Contact</a>
          </div>
          <div className="nav-right">
            <div className="lang-toggle" role="tablist" aria-label="Language">
              <button className={lang === "fr" ? "on" : ""} onClick={() => setLang("fr")}>FR</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
            <Link href="/login" className="btn btn-primary">
              <span><T fr="Se connecter" en="Sign in" lang={lang} /></span>
              <svg className="arr" width="14" height="14" viewBox="0 0 16 16"><use href="#arrow-r" /></svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ═════════════════════════════════════════════════════ */}
      <section className="hero" id="top">
        <div className="container">
          <div className="grid">
            <div>
              <span className="pill">
                <span className="dot" />
                <span><T fr="Projet Ingénierie" en="Engineering capstone" lang={lang} /></span>
                <span className="sep">/</span>
                <span>ESPRIT 2026</span>
                <span className="sep">/</span>
                <span>4DATA</span>
              </span>
              <h1>
                <T fr="Défense intelligente contre" en="Intelligent defence against" lang={lang} /><br />
                <span className="accent"><T fr="les cyberattaques 6G" en="6G cyberattacks" lang={lang} /></span>
              </h1>
              <p className="lede">
                <T
                  fr="Une plateforme IDS de niveau production combinant un ensemble Mixture-of-Experts, une architecture microservices complète et un pipeline MLOps automatisé — pour les réseaux IoT 5G/6G de smart cities."
                  en="A production-grade IDS combining a Mixture-of-Experts ensemble, a complete microservices architecture and an automated MLOps pipeline — for 5G/6G smart-city IoT networks."
                  lang={lang}
                />
              </p>
              <div className="ctas">
                <Link href="/login" className="btn btn-primary">
                  <span><T fr="Se connecter" en="Sign in" lang={lang} /></span>
                  <svg className="arr" width="14" height="14" viewBox="0 0 16 16"><use href="#arrow-r" /></svg>
                </Link>
                <a href="#solution" className="btn btn-ghost" onClick={onAnchorClick}>
                  <span><T fr="Découvrir la solution" en="Explore the solution" lang={lang} /></span>
                  <svg width="14" height="14" viewBox="0 0 16 16"><use href="#arrow-d" /></svg>
                </a>
              </div>
              <div className="hero-stats">
                <div className="hero-stat">
                  <div className="v"><Counter to={99.6} decimals={1} /><span className="unit">%</span></div>
                  <div className="lab"><T fr="Précision 5G" en="5G accuracy" lang={lang} /></div>
                </div>
                <div className="hero-stat">
                  <div className="v">&lt;<Counter to={200} /><span className="unit">ms</span></div>
                  <div className="lab"><T fr="Latence P95" en="P95 latency" lang={lang} /></div>
                </div>
                <div className="hero-stat">
                  <div className="v"><Counter to={21} /></div>
                  <div className="lab">Microservices</div>
                </div>
                <div className="hero-stat">
                  <div className="v">6<span className="unit">G</span></div>
                  <div className="lab"><T fr="Architecture prête" en="Architecture ready" lang={lang} /></div>
                </div>
              </div>
            </div>

            <div className="hero-mark" aria-hidden="true">
              <svg viewBox="0 0 240 240"><use href="#mark" /></svg>
            </div>
          </div>
        </div>
      </section>

      {/* ══ TRUST STRIP ══════════════════════════════════════════════ */}
      <div className="trust">
        <div className="container">
          <div className="row">
            <div className="badge"><span className="b-dot" /><span><T fr="Architecture microservices" en="Microservices architecture" lang={lang} /></span></div>
            <div className="badge"><span className="b-dot" /><span>RBAC &amp; JWT</span></div>
            <div className="badge"><span className="b-dot" /><span>MLOps CI/CD</span></div>
            <div className="badge"><span className="b-dot" /><span><T fr="Observabilité temps réel" en="Real-time observability" lang={lang} /></span></div>
            <div className="badge"><span className="b-dot" /><span><T fr="Détection zero-day" en="Zero-day detection" lang={lang} /></span></div>
          </div>
        </div>
      </div>

      {/* ══ SOLUTION ═════════════════════════════════════════════════ */}
      <section id="solution">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">01 · <T fr="La solution" en="The solution" lang={lang} /></span>
              <h2><T fr="Un IDS comportemental, pas une liste de signatures." en="A behavioural IDS — not yet another signature list." lang={lang} /></h2>
            </div>
            <p className="lede">
              <T
                fr="Les attaques 6G se cachent dans le bruit. Verado apprend la forme du trafic normal et signale ce qui s'en écarte — y compris ce qui n'existait pas hier."
                en="6G attacks hide in the noise. Verado learns the shape of normal traffic and flags whatever drifts away — including things that didn't exist yesterday."
                lang={lang}
              />
            </p>
          </div>

          <div className="solution-grid">
            <div>
              <div className="prose">
                <p>
                  <T
                    fr="Les firewalls classiques s'appuient sur des règles statiques et des bases de signatures. Sur un réseau 6G — slicé, élastique, asynchrone — la moitié des attaques utiles n'ont pas encore de signature publiée."
                    en="Classic firewalls lean on static rules and signature lists. On a 6G network — sliced, elastic, asynchronous — half the relevant attacks have no published signature yet."
                    lang={lang}
                  />
                </p>
                <p>
                  {lang === "fr" ? (
                    <><strong>Verado</strong> apprend la <strong>forme</strong> du trafic. Un ensemble Mixture-of-Experts — trois XGBoost spécialisés sur les slices 5G (eMBB, mMTC, URLLC) et deux autoencodeurs Keras sur les protocoles 6G (TCP, UDP) — est unifié par un MLP de gating à calibration Platt. Chaque flux est routé vers l'expert qui le comprend le mieux.</>
                  ) : (
                    <><strong>Verado</strong> learns the <strong>shape</strong> of traffic. A Mixture-of-Experts ensemble — three XGBoost models specialised on 5G slices (eMBB, mMTC, URLLC) and two Keras autoencoders on 6G protocols (TCP, UDP) — is unified by a Platt-calibrated MLP gating network. Each flow is routed to the expert that understands it best.</>
                  )}
                </p>
              </div>

              <div className="defs">
                <div className="def">
                  <span className="abbr">IDS</span>
                  <div className="name">Intrusion Detection System</div>
                  <div className="body"><T fr="Surveillance comportementale du trafic réseau. Verado lit, classe, alerte — sans bloquer (par défaut)." en="Behavioural monitoring of network traffic. Verado reads, classifies, alerts — never blocks (by default)." lang={lang} /></div>
                </div>
                <div className="def">
                  <span className="abbr">MoE</span>
                  <div className="name">Mixture of Experts</div>
                  <div className="body"><T fr="5 experts spécialisés + un MLP de gating. Chaque flux est routé là où la précision est maximale." en="5 specialised experts + a gating MLP. Each flow goes where accuracy is highest." lang={lang} /></div>
                </div>
                <div className="def">
                  <span className="abbr">MLOps</span>
                  <div className="name"><T fr="Boucle modèle continue" en="Continuous model loop" lang={lang} /></div>
                  <div className="body"><T fr="MLflow + GitHub Actions + Slack. Réentraînement déclenché par dérive, auto-promotion sur seuil." en="MLflow + GitHub Actions + Slack. Retraining triggered by drift, auto-promotion on threshold pass." lang={lang} /></div>
                </div>
                <div className="def">
                  <span className="abbr">PSI</span>
                  <div className="name">Population Stability Index</div>
                  <div className="body"><T fr="PSI + KS sur fenêtre glissante 7 jours. Verado sait quand son monde a changé — avant de se tromper." en="PSI + KS on a 7-day rolling window. Verado knows when the world shifted — before it gets wrong." lang={lang} /></div>
                </div>
              </div>
            </div>

            <div className="arch">
              <div className="h">
                <h4><T fr="Pile d'inférence" en="Inference stack" lang={lang} /></h4>
                <span className="mono">batch · 100 flows</span>
              </div>
              <div className="arch-flow">
                <div className="arch-row">
                  <span className="stage"><T fr="entrée" en="ingest" lang={lang} /></span>
                  <div className="blocks"><span className="blk"><T fr="flux bruts pcap / netflow" en="raw flows pcap / netflow" lang={lang} /></span></div>
                </div>
                <div className="arch-row"><div className="arrow-down"><svg viewBox="0 0 16 16"><use href="#arrow-d" /></svg></div></div>
                <div className="arch-row">
                  <span className="stage">features</span>
                  <div className="blocks"><span className="blk">IAT · pkt rate · flow dur · proto · …</span></div>
                </div>
                <div className="arch-row"><div className="arrow-down"><svg viewBox="0 0 16 16"><use href="#arrow-d" /></svg></div></div>
                <div className="arch-row">
                  <span className="stage">5 experts</span>
                  <div className="blocks">
                    <span className="blk exp-5g">XGB · eMBB</span>
                    <span className="blk exp-5g">XGB · mMTC</span>
                    <span className="blk exp-5g">XGB · URLLC</span>
                    <span className="blk exp-6g">AE · TCP</span>
                    <span className="blk exp-6g">AE · UDP</span>
                  </div>
                </div>
                <div className="arch-row"><div className="arrow-down"><svg viewBox="0 0 16 16"><use href="#arrow-d" /></svg></div></div>
                <div className="arch-row">
                  <span className="stage">gate · MLP</span>
                  <div className="blocks"><span className="blk gate"><T fr="pondération Platt-calibrée" en="Platt-calibrated weights" lang={lang} /></span></div>
                </div>
                <div className="arch-row"><div className="arrow-down"><svg viewBox="0 0 16 16"><use href="#arrow-d" /></svg></div></div>
                <div className="arch-row">
                  <span className="stage"><T fr="sortie" en="output" lang={lang} /></span>
                  <div className="blocks"><span className="blk out">score · verdict · label · confidence</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ OBJECTIFS ════════════════════════════════════════════════ */}
      <section id="objectifs">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">02 · <T fr="Objectifs" en="Goals" lang={lang} /></span>
              <h2><T fr="Quatre promesses, mesurables." en="Four promises, all measurable." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Pas de slogans. Chaque objectif est lié à un indicateur dans le tableau de bord." en="No slogans. Each goal maps to a KPI in the dashboard." lang={lang} /></p>
          </div>
          <div className="obj-grid">
            {[
              { icon: "ico-shield", num: "01", title: { fr: "Sécuriser les réseaux 6G", en: "Secure 6G networks" }, desc: { fr: "Détecter en continu DDoS, MITM, scan, exfiltration et signatures inconnues sur slices 5G et protocoles 6G.", en: "Continuously detect DDoS, MITM, scans, exfiltration and unseen signatures across 5G slices and 6G protocols." } },
              { icon: "ico-clock", num: "02", title: { fr: "Réduire le temps de réponse", en: "Cut response time" }, desc: { fr: "P95 sous 200 ms pour un batch de 100 flux. Alertes Slack et tickets ouverts sans intervention humaine.", en: "P95 below 200 ms for a 100-flow batch. Slack alerts and tickets opened without human input." } },
              { icon: "ico-loop", num: "03", title: { fr: "Automatiser le cycle ML", en: "Automate the ML loop" }, desc: { fr: "MLflow tracking, registry, auto-promotion (F1 ≥ 0.90 · Recall ≥ 0.95 · PR-AUC ≥ 0.92). Drift PSI/KS toutes les 24 h.", en: "MLflow tracking, registry, auto-promotion (F1 ≥ 0.90 · Recall ≥ 0.95 · PR-AUC ≥ 0.92). PSI/KS drift every 24 h." } },
              { icon: "ico-ops", num: "04", title: { fr: "Simplifier l'exploitation", en: "Simplify operations" }, desc: { fr: "Une seule commande Docker Compose, 21 services. Grafana et Prometheus livrés, configurés, dashboardés.", en: "One Docker Compose, 21 services. Grafana and Prometheus shipped, configured, dashboarded." } },
            ].map((o) => (
              <div className="obj" key={o.num}>
                <span className="pic"><svg width="32" height="32"><use href={`#${o.icon}`} /></svg></span>
                <span className="ix">{o.num}</span>
                <div className="ttl">{o.title[lang]}</div>
                <div className="desc">{o.desc[lang]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ AVANTAGES ════════════════════════════════════════════════ */}
      <section id="avantages">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">03 · <T fr="Pourquoi Verado" en="Why Verado" lang={lang} /></span>
              <h2><T fr="Six choix techniques qui font la différence." en="Six technical choices that make the difference." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Aucun de ces points n'est cosmétique. Chacun est testé, instrumenté, versionné." en="Nothing here is cosmetic. Each item is tested, instrumented, versioned." lang={lang} /></p>
          </div>

          <div className="feat-grid">
            {[
              { ic: "ic-moe", t: { fr: "Mixture of Experts", en: "Mixture of Experts" }, d: { fr: "5 modèles spécialisés battent un modèle unique généraliste : +3,2 pts F1, +6 pts recall sur les attaques rares.", en: "5 specialised models beat a single generalist: +3.2 pts F1, +6 pts recall on rare attacks." }, m: { fr: "3 × XGBoost · 2 × Autoencoder · 1 × MLP gate", en: "3 × XGBoost · 2 × Autoencoder · 1 × MLP gate" } },
              { ic: "ic-zero", t: { fr: "Détection zero-day", en: "Zero-day detection" }, d: { fr: "Les autoencodeurs apprennent la distribution du trafic normal. Tout ce qui s'écarte est signalé — sans avoir été vu pendant l'entraînement.", en: "Autoencoders learn the distribution of normal traffic. Anything that drifts is flagged — never seen during training." }, m: { fr: "Reconstruction loss · seuil adaptatif", en: "Reconstruction loss · adaptive threshold" } },
              { ic: "ic-bolt", t: { fr: "Temps réel · < 200 ms", en: "Real-time · < 200 ms" }, d: { fr: "FastAPI · cache Redis · hot-reload des modèles. P95 mesuré à 147 ms sur batch de 100 flux en charge nominale.", en: "FastAPI · Redis cache · model hot-reload. P95 measured at 147 ms on 100-flow batches at nominal load." }, m: { fr: "FastAPI · Redis · Prometheus", en: "FastAPI · Redis · Prometheus" } },
              { ic: "ic-drift", t: { fr: "Détection de dérive", en: "Drift detection" }, d: { fr: "PSI et Kolmogorov-Smirnov sur une fenêtre glissante de 7 jours. Une dérive significative déclenche le réentraînement.", en: "PSI and Kolmogorov-Smirnov over a 7-day rolling window. A significant drift triggers retraining." }, m: { fr: "PSI · KS · Slack alert", en: "PSI · KS · Slack alert" } },
              { ic: "ic-lock", t: { fr: "Sécurité enterprise", en: "Enterprise security" }, d: { fr: "JWT, RBAC à 3 rôles (admin / analyst / viewer), mots de passe bcrypt, audit log pour chaque mutation, scan Trivy sur images.", en: "JWT, 3-role RBAC (admin / analyst / viewer), bcrypt-hashed passwords, audit log on every mutation, Trivy scan on images." }, m: { fr: "JWT · RBAC · bcrypt · Trivy", en: "JWT · RBAC · bcrypt · Trivy" } },
              { ic: "ic-mlops", t: { fr: "MLOps automatisé", en: "Automated MLOps" }, d: { fr: "GitHub Actions avec quality gates (ruff, black, bandit, pip-audit), smoke training, multi-image Docker push, auto-promotion via MLflow.", en: "GitHub Actions with quality gates (ruff, black, bandit, pip-audit), smoke training, multi-image Docker push, auto-promotion via MLflow." }, m: { fr: "MLflow · GitHub Actions · Celery", en: "MLflow · GitHub Actions · Celery" } },
            ].map((f) => (
              <div className="feat" key={f.ic}>
                <span className="ico"><svg viewBox="0 0 32 32"><use href={`#${f.ic}`} /></svg></span>
                <div className="ttl">{f.t[lang]}</div>
                <div className="desc">{f.d[lang]}</div>
                <div className="meta">{f.m[lang]}</div>
              </div>
            ))}
          </div>

          <div className="metrics">
            <div className="metric">
              <div className="lab"><T fr="Précision" en="Precision" lang={lang} /></div>
              <div className="v"><Counter to={99.6} decimals={1} /><span className="unit">%</span></div>
              <Bar fill={99.6} />
              <div className="note"><T fr="Benchmark interne 5G · 24k flux" en="Internal 5G benchmark · 24k flows" lang={lang} /></div>
            </div>
            <div className="metric">
              <div className="lab">ROC-AUC</div>
              <div className="v"><Counter to={97} /><span className="unit">%</span></div>
              <Bar fill={97} />
              <div className="note"><T fr="Sur 5 attaques cibles" en="Across 5 target attacks" lang={lang} /></div>
            </div>
            <div className="metric">
              <div className="lab">Recall</div>
              <div className="v"><Counter to={99} /><span className="unit">%</span></div>
              <Bar fill={99} />
              <div className="note"><T fr="Critique pour un IDS — ne rien rater" en="Critical for an IDS — miss nothing" lang={lang} /></div>
            </div>
            <div className="metric">
              <div className="lab">PR-AUC</div>
              <div className="v"><Counter to={95} /><span className="unit">%</span></div>
              <Bar fill={95} />
              <div className="note"><T fr="Classes déséquilibrées · 4% attaques" en="Imbalanced classes · 4% attacks" lang={lang} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FONCTIONNEMENT ═══════════════════════════════════════════ */}
      <section id="fonctionnement">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">04 · <T fr="Fonctionnement" en="How it works" lang={lang} /></span>
              <h2><T fr="Du paquet brut à l'alerte signée." en="From raw packet to signed alert." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Cinq étapes, instrumentées de bout en bout. Chaque transition pose un span Prometheus." en="Five stages, instrumented end to end. Every transition writes a Prometheus span." lang={lang} /></p>
          </div>

          <div className="steps">
            <div className="timeline">
              {[
                { t: { fr: "Collecte des flux", en: "Flow ingestion" }, d: { fr: "Captures pcap, NetFlow v9, et IPFIX agrégés via Kafka. Tamponnage Redis en cas de pic.", en: "pcap captures, NetFlow v9 and IPFIX aggregated via Kafka. Redis buffer absorbs spikes." }, m: "Kafka → Redis → ingestion-svc" },
                { t: { fr: "Pré-traitement", en: "Pre-processing" }, d: { fr: "Calcul des features réseau (IAT, packet rate, flow duration, ratio fwd/bwd, …) et normalisation contre la baseline.", en: "Compute network features (IAT, packet rate, flow duration, fwd/bwd ratio, …) and normalise against the baseline." }, m: "feature-eng · scaler v3" },
                { t: { fr: "Ensemble MoE", en: "MoE ensemble" }, d: { fr: "Le MLP de gating regarde le flux, choisit l'expert, et combine les sorties si la confiance est partagée.", en: "The gating MLP looks at the flow, picks the expert, and blends outputs when confidence is split." }, m: "gate-mlp + 5 experts hot-loaded" },
                { t: { fr: "Score d'attaque", en: "Attack score" }, d: { fr: "Probabilité calibrée par Platt scaling, label le plus probable, niveau de confiance et seuil dynamique.", en: "Platt-calibrated probability, most-likely label, confidence level and dynamic threshold." }, m: "verdict · {benign | suspicious | attack}" },
                { t: { fr: "Alerte & Rapport", en: "Alert & Report" }, d: { fr: "Push dashboard temps réel, alerte Slack typée, ticket auto-ouvert et rapport PDF signé pour le SOC.", en: "Real-time dashboard push, typed Slack alert, auto-opened ticket and signed PDF report for the SOC." }, m: "Grafana · Slack · PDF reportlab" },
              ].map((s, i) => (
                <div key={i} className={`step${i === 0 ? " active" : ""}`}>
                  <div className="ttl">{s.t[lang]}</div>
                  <div className="desc">{s.d[lang]}</div>
                  <div className="meta">{s.m}</div>
                </div>
              ))}
            </div>

            <div className="flow-viz">
              <div className="h">
                <h4><T fr="Vue d'ensemble du flux" en="Flow overview" lang={lang} /></h4>
                <span className="mono">end-to-end</span>
              </div>
              <svg className="flow-svg" viewBox="0 0 460 360" aria-hidden="true">
                <line x1="60" y1="40" x2="60" y2="320" stroke="oklch(0.88 0.008 80)" strokeWidth="1" strokeDasharray="3 3" />
                <g fontFamily="JetBrains Mono, monospace" fontSize="10" fill="oklch(0.55 0.008 80)">
                  <text x="20" y="44">01</text>
                  <text x="20" y="114">02</text>
                  <text x="20" y="184">03</text>
                  <text x="20" y="254">04</text>
                  <text x="20" y="324">05</text>
                </g>
                <g fontFamily="Inter Tight, sans-serif" fontWeight="600" fontSize="13" fill="oklch(0.18 0.018 255)">
                  <text x="80" y="46">Ingestion · Kafka</text>
                  <text x="80" y="116">Features · scaling</text>
                  <text x="80" y="186">MoE · gate + 5 experts</text>
                  <text x="80" y="256">Score · Platt-calibrated</text>
                  <text x="80" y="326">Alert · dashboard + PDF</text>
                </g>
                <g transform="translate(280 220)">
                  <rect x="0" y="0" width="160" height="48" rx="3" fill="oklch(0.985 0.005 85)" stroke="oklch(0.88 0.008 80)" />
                  <path d="M6 38 L20 36 L40 34 L60 32 L80 30 L100 12 L120 16 L140 14 L154 12" stroke="oklch(0.18 0.018 255)" strokeWidth="1.4" fill="none" />
                  <circle cx="100" cy="12" r="3" fill="oklch(0.65 0.155 48)" />
                  <text x="6" y="14" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="oklch(0.55 0.008 80)">score · 60s</text>
                </g>
                <g transform="translate(280 150)" fontFamily="JetBrains Mono, monospace" fontSize="8" fill="oklch(0.55 0.008 80)">
                  <text x="0" y="0">gate(x)</text>
                  <rect x="0" y="6" width="32" height="6" fill="oklch(0.78 0.10 230)" />
                  <rect x="34" y="6" width="6" height="6" fill="oklch(0.78 0.10 230)" />
                  <rect x="42" y="6" width="92" height="6" fill="oklch(0.65 0.155 48)" />
                  <rect x="136" y="6" width="12" height="6" fill="oklch(0.78 0.10 155)" />
                  <rect x="150" y="6" width="8" height="6" fill="oklch(0.78 0.10 155)" />
                  <text x="42" y="22" fontFamily="Inter Tight, sans-serif" fontWeight="500" fontSize="9" fill="oklch(0.18 0.018 255)">expert: urllc · 0.62</text>
                </g>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ══ VISITE GUIDÉE ════════════════════════════════════════════ */}
      <section id="tour">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">05 · <T fr="Visite guidée" en="Walkthrough" lang={lang} /></span>
              <h2><T fr="Huit étapes dans la console." en="Eight stops inside the console." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Aucun lien direct vers le dashboard — tout passe par /login. Voici à quoi cela ressemble." en="No direct dashboard links — everything goes through /login. Here's what it looks like." lang={lang} /></p>
          </div>

          <div className="tour">
            <div className="tour-steps">
              {TOUR.map((s, i) => (
                <button
                  key={i}
                  className={`t-step${i === currentStep ? " active" : ""}`}
                  data-step={i}
                  style={{ ["--accent" as string]: STEP_ACCENTS[i] }}
                  onClick={() => setCurrentStep(i)}
                >
                  <div className="num">{String(i + 1).padStart(2, "0")}</div>
                  <div>
                    <div className="ttl">{s.title[lang]}</div>
                    <div className="desc">{s.desc[lang].slice(0, 80)}{s.desc[lang].length > 80 ? "…" : ""}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="tour-preview">
              <div className="preview-frame">
                <div className="preview-window">
                  <div className="dots"><span /><span /><span /></div>
                  <div className="url"><strong>verado.io</strong>{tourStep.url}</div>
                </div>
                <div className="preview-screen">
                  {MOCKS.map((Mock, i) => (
                    <div key={i} className={`preview-mock${i === currentStep ? " on" : ""}`} data-mock={i}>
                      <Mock />
                    </div>
                  ))}
                </div>
              </div>

              <div className="preview-meta" style={{ ["--accent" as string]: accent }}>
                <div>
                  <div className="stp-eyebrow" style={{ color: accent }}>
                    <span><T fr="Étape" en="Step" lang={lang} /></span> {String(currentStep + 1).padStart(2, "0")} / 08
                  </div>
                  <h4>{tourStep.title[lang]}</h4>
                  <p>{tourStep.desc[lang]}</p>
                  <div className="feature-pills">
                    {tourStep.pills.map((p) => <span key={p} className="fp">{p}</span>)}
                  </div>
                </div>
                <div className="tour-nav">
                  <button onClick={() => setCurrentStep((i) => (i - 1 + TOUR.length) % TOUR.length)} aria-label="Précédent">
                    <svg viewBox="0 0 16 16"><use href="#arrow-l" /></svg>
                  </button>
                  <button onClick={() => setCurrentStep((i) => (i + 1) % TOUR.length)} aria-label="Suivant">
                    <svg viewBox="0 0 16 16"><use href="#arrow-r" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ USE CASES ════════════════════════════════════════════════ */}
      <section id="cas-usage">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">06 · <T fr="Cas d'usage" en="Use cases" lang={lang} /></span>
              <h2><T fr="Là où Verado a déjà été déployé en test." en="Where Verado has already been tested." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Trois contextes, trois calibrations différentes du modèle de gating." en="Three contexts, three different gating-model calibrations." lang={lang} /></p>
          </div>
          <div className="uses">
            {[
              { ic: "up-city", t: { fr: "Smart City · SOC", en: "Smart City · SOC" }, d: { fr: "Surveillance des passerelles 5G urbaines : feux connectés, capteurs, vidéosurveillance. Verado agrège, classe, escalade.", en: "Watching urban 5G gateways: connected lights, sensors, CCTV. Verado aggregates, classifies, escalates." }, m: { fr: "Volume · 50k flows/s", en: "Volume · 50k flows/s" } },
              { ic: "up-fact", t: { fr: "Campus & Industrie 4.0", en: "Campus & Industry 4.0" }, d: { fr: "Slice URLLC dédié à la robotique. Verado regarde la dérive temporelle : un retard, c'est déjà une anomalie.", en: "URLLC slice dedicated to robotics. Verado watches temporal drift: a delay is already an anomaly." }, m: { fr: "Latence cible · < 5 ms", en: "Latency target · < 5 ms" } },
              { ic: "up-lab", t: { fr: "Lab R&D · 5G/6G", en: "R&D lab · 5G/6G" }, d: { fr: "Sandbox pour chercheurs : rejouez un .pcap, comparez deux versions du modèle, exportez le rapport.", en: "Sandbox for researchers: replay a .pcap, compare two model versions, export the report." }, m: { fr: "Replay · A/B · export", en: "Replay · A/B · export" } },
            ].map((u) => (
              <div className="use" key={u.ic}>
                <span className="pic"><svg width="60" height="40"><use href={`#${u.ic}`} /></svg></span>
                <div className="ttl">{u.t[lang]}</div>
                <div className="desc">{u.d[lang]}</div>
                <div className="meta">{u.m[lang]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PARTENAIRES ══════════════════════════════════════════════ */}
      <section id="partenaires">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">07 · <T fr="Partenaires & Technologies" en="Partners & Tech" lang={lang} /></span>
              <h2><T fr="L'épine dorsale, sans laquelle rien ne tient." en="The backbone — without which nothing holds." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Aucune dépendance propriétaire, tout est open-source et auto-hébergeable." en="No proprietary dependencies — everything is open-source and self-hostable." lang={lang} /></p>
          </div>

          <div className="partners">
            {[
              { ic: "pg-esprit", nm: "ESPRIT", role: { fr: "école", en: "school" } },
              { ic: "pg-mlflow", nm: "MLflow", role: { fr: "registre", en: "registry" } },
              { ic: "pg-prom", nm: "Prometheus", role: { fr: "métriques", en: "metrics" } },
              { ic: "pg-grafana", nm: "Grafana", role: { fr: "dashboards", en: "dashboards" } },
              { ic: "pg-docker", nm: "Docker", role: { fr: "conteneurs", en: "containers" } },
              { ic: "pg-gh", nm: "GitHub", role: { fr: "ci/cd", en: "ci/cd" } },
            ].map((p) => (
              <div className="partner" key={p.nm}>
                <span className="logo"><svg width="36" height="36"><use href={`#${p.ic}`} /></svg></span>
                <span className="nm">{p.nm}</span>
                <span className="role">{p.role[lang]}</span>
              </div>
            ))}
          </div>

          <div className="tech-pills">
            {["Python 3.11", "XGBoost", "Keras", "scikit-learn", "FastAPI", "Next.js 14", "PostgreSQL", "Redis", "MinIO", "Docker", "GitHub Actions", "Celery", "Prometheus", "Grafana", "MLflow", "Trivy"].map((p) => (
              <span className="tech-pill" key={p}>{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TÉMOIGNAGES ══════════════════════════════════════════════ */}
      <section id="temoignages">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">08 · <T fr="Témoignages" en="Testimonials" lang={lang} /></span>
              <h2><T fr="Ceux qui l'ont essayé en disent." en="From those who've used it." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Retours collectés en interne pendant la phase de validation." en="Feedback gathered internally during validation phase." lang={lang} /></p>
          </div>
          <div className="quotes">
            {[
              { q: { fr: "Le passage du MoE a réduit nos faux positifs de 40 %. On a finalement arrêté de couper le café à 3 h du matin pour rien.", en: "Switching to MoE cut our false positives by 40%. We finally stopped getting woken at 3am for nothing." }, av: "LB", nm: "L. Ben Salem", rl: { fr: "Analyste SOC · ville pilote", en: "SOC Analyst · pilot city" } },
              { q: { fr: "La rigueur MLOps est rare à voir dans un projet étudiant. Auto-promotion sur seuils, drift PSI, Trivy — c'est du niveau industrie.", en: "MLOps rigour like this is rare in a student project. Auto-promotion on thresholds, PSI drift, Trivy — this is industry-grade." }, av: "YT", nm: "Y. Trabelsi", rl: { fr: "Mentor · ESPRIT", en: "Mentor · ESPRIT" } },
              { q: { fr: "Une seule commande, 21 conteneurs, Grafana déjà branché. Je n'ai jamais déployé un IDS aussi vite.", en: "One command, 21 containers, Grafana already wired in. I have never stood up an IDS this fast." }, av: "SR", nm: "S. Rejeb", rl: { fr: "DevOps · partenaire industriel", en: "DevOps · industrial partner" } },
            ].map((qq) => (
              <div className="quote" key={qq.nm}>
                <div className="mk-q">&ldquo;</div>
                <blockquote>{qq.q[lang]}</blockquote>
                <div className="who">
                  <div className="av">{qq.av}</div>
                  <div>
                    <div className="nm">{qq.nm}</div>
                    <div className="rl">{qq.rl[lang]}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ÉQUIPE ═══════════════════════════════════════════════════ */}
      <section id="equipe">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">09 · <T fr="L'équipe" en="The team" lang={lang} /></span>
              <h2><T fr="Six étudiants de 4DATA. Un seul objectif." en="Six 4DATA students. One single goal." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Projet Intégrateur de Fin d'Études · ESPRIT School of Engineering · 2026." en="Final-year integrating project · ESPRIT School of Engineering · 2026." lang={lang} /></p>
          </div>
          <div className="team">
            {[
              { ph: "N", img: "/team/nawres.png",     nm: "Nawres Bensethom", rl: { fr: "Team lead · ML eng.", en: "Team lead · ML eng." }, em: "nawres.bensethom@esprit.tn" },
              { ph: "H", img: "/team/hadil.png",      nm: "Hadil Fatnassi",   rl: { fr: "data science · ai",   en: "data science · ai"    }, em: "hadil.fatnassi@esprit.tn" },
              { ph: "M", img: "/team/maram.png",      nm: "Maram Kaouach",    rl: { fr: "frontend · ux",       en: "frontend · ux"        }, em: "maram.kaouach@esprit.tn" },
              { ph: "O", img: "/team/seifeddine.png", nm: "M. S. Ouarag",     rl: { fr: "backend · services",  en: "backend · services"   }, em: "seifeddine.ouarag@esprit.tn" },
              { ph: "K", img: "/team/khaled.png",     nm: "M. K. Benhmida",   rl: { fr: "mlops · devops",      en: "mlops · devops"       }, em: "khaled.benhmida@esprit.tn" },
              { ph: "A", img: "/team/amine.png",      nm: "Amine Trabelsi",   rl: { fr: "security · infra",    en: "security · infra"     }, em: "amine.trabelsi@esprit.tn" },
            ].map((m) => (
              <div className="member" key={m.em}>
                <div className="photo">
                  <img
                    src={m.img}
                    alt={m.nm}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="photo-fallback">{m.ph}</span>
                </div>
                <div>
                  <div className="nm">{m.nm}</div>
                  <div className="rl">{m.rl[lang]}</div>
                  <div className="em">{m.em}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══════════════════════════════════════════════════════ */}
      <section id="faq">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">10 · FAQ</span>
              <h2><T fr="Les questions qui reviennent." en="Questions we keep getting." lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Quatre réponses techniques, sans détour." en="Four technical answers, no fluff." lang={lang} /></p>
          </div>

          <div className="faq">
            {[
              {
                q: { fr: "Qu'est-ce qu'un IDS basé sur l'IA ?", en: "What is an AI-based IDS?" },
                a: {
                  fr: <p>Un IDS comportemental apprend la <strong>forme</strong> du trafic réseau plutôt que d&apos;utiliser des règles statiques. Sur Verado, deux familles de modèles cohabitent : XGBoost supervisé pour les attaques connues, et autoencodeurs non-supervisés pour les anomalies inconnues — y compris des attaques jamais vues à l&apos;entraînement.</p>,
                  en: <p>A behavioural IDS learns the <strong>shape</strong> of network traffic rather than relying on static rules. Verado runs two model families side-by-side: supervised XGBoost for known attacks, unsupervised autoencoders for unknown anomalies — including attacks never seen during training.</p>,
                },
              },
              {
                q: { fr: "Pourquoi la 6G demande une approche différente ?", en: "Why does 6G need a different approach?" },
                a: {
                  fr: <p>Les réseaux 6G introduisent du slicing dynamique, une densité massive d&apos;IoT et des SLA de latence inférieure à 5 ms. Les outils signatures ne savent pas raisonner sur ces régimes. Verado modélise chaque slice avec un expert dédié, et utilise le gating pour décider à la volée lequel consulter.</p>,
                  en: <p>6G networks introduce dynamic slicing, massive IoT density, and sub-5 ms latency SLAs. Signature-based tools cannot reason about these regimes. Verado models each slice with a dedicated expert and uses gating to pick which one to consult on the fly.</p>,
                },
              },
              {
                q: { fr: "Qu'est-ce que MoE ?", en: "What is MoE?" },
                a: {
                  fr: <p>Mixture of Experts. Un modèle ensemble où chaque expert se spécialise sur un sous-domaine — slice ou protocole — et un MLP de gating apprend lequel consulter selon le flux. Le gain : pas de compromis entre précision et généralisation. Verado utilise 5 experts (3 XGBoost + 2 Autoencoders) et un gate Platt-calibré.</p>,
                  en: <p>Mixture of Experts. An ensemble where each expert specialises on a sub-domain — slice or protocol — and a gating MLP learns which one to consult per flow. The win: no trade-off between accuracy and generalisation. Verado uses 5 experts (3 XGBoost + 2 Autoencoders) and a Platt-calibrated gate.</p>,
                },
              },
              {
                q: { fr: "Comment déployer Verado ?", en: "How to deploy Verado?" },
                a: {
                  fr: <p>Une seule commande Docker Compose monte les 21 services : 3 services ML, 6 services dashboard, 12 services infra et observabilité. Pour la production : Helm chart Kubernetes disponible, scan Trivy sur chaque image, mise à jour bleu/vert via le registry MLflow.</p>,
                  en: <p>A single Docker Compose brings up all 21 services: 3 ML services, 6 dashboard services, 12 infra + observability services. For production: Helm chart available, Trivy scan on every image, blue/green roll-out via the MLflow registry.</p>,
                },
              },
            ].map((item, i) => {
              const open = openFaq === i;
              return (
                <div className={`faq-item${open ? " open" : ""}`} key={i}>
                  <button className="faq-q" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                    <span>{item.q[lang]}</span>
                    <span className="pm"><svg viewBox="0 0 16 16"><use href="#plus" /></svg></span>
                  </button>
                  <div className="faq-a">
                    <div>{item.a[lang]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══════════════════════════════════════════════════ */}
      <section id="contact">
        <div className="container">
          <div className="section-head">
            <div>
              <span className="eyebrow">11 · Contact</span>
              <h2><T fr="Une question, une démo, un mémoire ?" en="A question, a demo, a thesis?" lang={lang} /></h2>
            </div>
            <p className="lede"><T fr="Nous répondons sous 48 h ouvrées. Pas de bot, pas de robot." en="We answer within 48 working hours. No bot, no robot." lang={lang} /></p>
          </div>

          <div className="contact">
            <div className="contact-info">
              <div className="ci-block">
                <span className="lab"><T fr="Institution" en="Institution" lang={lang} /></span>
                <span className="v">ESPRIT School of Engineering<br /><span style={{ color: "var(--mute)", fontWeight: 400, fontSize: 13.5, fontFamily: "var(--sans)" }}>Z.I Ch. Saidane, Ariana 2083, Tunisie</span></span>
              </div>
              <div className="ci-block">
                <span className="lab">Email</span>
                <span className="v"><a href="mailto:verado@esprit.tn">verado@esprit.tn</a></span>
              </div>
              <div className="ci-block">
                <span className="lab">GitHub</span>
                <span className="v"><a href="#">github.com/esprit-pi-4data/verado</a></span>
              </div>
              <div className="ci-block">
                <span className="lab"><T fr="Horaires" en="Hours" lang={lang} /></span>
                <span className="v"><T fr="Lun–Ven · 09 h–18 h (UTC+1)" en="Mon–Fri · 09 h–18 h (UTC+1)" lang={lang} /></span>
              </div>
            </div>

            <form className="form" onSubmit={onContactSubmit}>
              <div className="field">
                <label htmlFor="cn"><T fr="Nom" en="Name" lang={lang} /></label>
                <input type="text" id="cn" name="name" required />
              </div>
              <div className="field">
                <label htmlFor="ce">Email</label>
                <input type="email" id="ce" name="email" required />
              </div>
              <div className="field span2">
                <label htmlFor="cs"><T fr="Sujet" en="Subject" lang={lang} /></label>
                <input type="text" id="cs" name="subject" required />
              </div>
              <div className="field span2">
                <label htmlFor="cm">Message</label>
                <textarea id="cm" name="message" required />
              </div>
              <div className="form-actions">
                <span className="nb"><T fr="En soumettant, vous acceptez notre politique de confidentialité." en="By submitting you accept our privacy policy." lang={lang} /></span>
                <button type="submit" className="btn btn-primary">
                  <span><T fr="Envoyer" en="Send" lang={lang} /></span>
                  <svg className="arr" width="14" height="14" viewBox="0 0 16 16"><use href="#send" /></svg>
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* ══ CTA ══════════════════════════════════════════════════════ */}
      <section id="cta">
        <div className="container">
          <div className="cta">
            <svg className="mark-bg" viewBox="0 0 240 240"><use href="#mark" /></svg>
            <div>
              <h3>
                {lang === "fr" ? <>Prêt à sécuriser votre réseau <span className="sig">6G</span> ?</> : <>Ready to secure your <span className="sig">6G</span> network?</>}
              </h3>
              <p>
                <T
                  fr="Verado est en accès restreint pendant la phase d'évaluation. La console exige un compte — nous le créons sur demande, sous 24 h."
                  en="Verado is in restricted access during the evaluation phase. The console requires an account — we provision one on request, within 24h."
                  lang={lang}
                />
              </p>
            </div>
            <div className="side">
              <Link href="/login" className="btn btn-signal">
                <span><T fr="Accéder à la console" en="Open the console" lang={lang} /></span>
                <svg className="arr" width="14" height="14" viewBox="0 0 16 16"><use href="#arrow-r" /></svg>
              </Link>
              <span className="hint"><T fr="authentification requise" en="authentication required" lang={lang} /></span>
            </div>
          </div>
        </div>
      </section>

      {/* ══ NEWSLETTER ═══════════════════════════════════════════════ */}
      <div className="news">
        <div className="container">
          <div className="row">
            <div>
              <h3><T fr="Recevez les notes de release." en="Get the release notes." lang={lang} /></h3>
              <p><T fr="Une lettre par mois, signée par l'équipe. Désabonnement en un clic." en="One letter a month, signed by the team. One-click unsubscribe." lang={lang} /></p>
            </div>
            <form onSubmit={onNewsSubmit}>
              <input type="email" name="email" placeholder="vous@labo.fr" required />
              <button type="submit" className="btn btn-primary">
                <span><T fr="S'abonner" en="Subscribe" lang={lang} /></span>
                <svg className="arr" width="14" height="14" viewBox="0 0 16 16"><use href="#arrow-r" /></svg>
              </button>
            </form>
          </div>
          <div className={`ok-msg${newsState === "ok" ? " on" : ""}`}>
            <svg width="14" height="14" viewBox="0 0 16 16" style={{ marginRight: 8 }}><use href="#check" /></svg>
            <span><T fr="Inscription confirmée. À très vite." en="Subscription confirmed. See you soon." lang={lang} /></span>
          </div>
          <div className={`err-msg${newsState === "err" ? " on" : ""}`}>
            <T fr="Adresse invalide ou déjà inscrite." en="Invalid or already subscribed." lang={lang} />
          </div>
        </div>
      </div>

      {/* ══ FOOTER ═══════════════════════════════════════════════════ */}
      <footer className="foot">
        <div className="container">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="brand">
                <svg className="mark" viewBox="0 0 240 240"><use href="#mark" /></svg>
                <span className="word">Verado</span>
                <span className="tag">6G IDS</span>
              </div>
              <div className="tagline">
                <T fr="Défense intelligente contre les cyberattaques 6G. Un projet 4DATA · ESPRIT 2026." en="Intelligent defence against 6G cyberattacks. A 4DATA project · ESPRIT 2026." lang={lang} />
              </div>
            </div>
            <div className="foot-col">
              <h5>Navigation</h5>
              <ul>
                <li><a href="#solution" onClick={onAnchorClick}>Solution</a></li>
                <li><a href="#objectifs" onClick={onAnchorClick}><T fr="Objectifs" en="Goals" lang={lang} /></a></li>
                <li><a href="#avantages" onClick={onAnchorClick}><T fr="Avantages" en="Why" lang={lang} /></a></li>
                <li><a href="#fonctionnement" onClick={onAnchorClick}><T fr="Fonctionnement" en="How it works" lang={lang} /></a></li>
                <li><a href="#tour" onClick={onAnchorClick}><T fr="Visite guidée" en="Walkthrough" lang={lang} /></a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5><T fr="Application" en="Application" lang={lang} /></h5>
              <ul>
                <li><Link href="/login"><T fr="Se connecter" en="Sign in" lang={lang} /></Link></li>
              </ul>
            </div>
            <div className="foot-col">
              <h5><T fr="Ressources" en="Resources" lang={lang} /></h5>
              <ul>
                <li><a href="#">MLflow UI</a></li>
                <li><a href="#">Grafana</a></li>
                <li><a href="#">API Docs</a></li>
                <li><a href="#">GitHub</a></li>
                <li><Link href="/privacy"><T fr="Confidentialité" en="Privacy" lang={lang} /></Link></li>
                <li><Link href="/terms"><T fr="Conditions" en="Terms" lang={lang} /></Link></li>
              </ul>
            </div>
          </div>
          <div className="foot-bar">
            <span>© 2026 Verado · ESPRIT 4DATA</span>
            <span><T fr="Projet Intégrateur de Fin d'Études · Janvier–Mai 2026" en="Final-year integrating project · Jan–May 2026" lang={lang} /></span>
          </div>
        </div>
      </footer>

      {/* ══ CHATBOT ══════════════════════════════════════════════════ */}
      <div className="chatbot">
        <button className="cb-fab" onClick={() => setChatOpen((v) => !v)} aria-label="Open Verado assistant">
          <svg className="mark" viewBox="0 0 240 240"><use href="#mark" /></svg>
          <span className="pulse" />
        </button>
        <div className={`cb-panel${chatOpen ? " on" : ""}`}>
          <div className="cb-head">
            <svg className="mark" viewBox="0 0 240 240"><use href="#mark" /></svg>
            <div>
              <div className="nm">Verado · assistant</div>
              <div className="st"><T fr="en ligne" en="online" lang={lang} /></div>
            </div>
            <button className="cb-close" onClick={() => setChatOpen(false)} aria-label="Close">×</button>
          </div>
          <div className="cb-body" ref={cbBodyRef}>
            {chatLog.map((m, i) => (
              <div key={i} className={`cb-msg ${m.role}`}>{m.text}</div>
            ))}
          </div>
          <div className="cb-input">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
              placeholder={lang === "fr" ? "Posez une question…" : "Ask a question…"}
              autoComplete="off"
            />
            <button onClick={sendChat}>→</button>
          </div>
        </div>
      </div>

      {/* ══ TOAST ════════════════════════════════════════════════════ */}
      <div className={`toast${toast ? " on" : ""}`}>
        <svg className="ico" viewBox="0 0 16 16"><use href="#check" /></svg>
        <span><T fr="Message envoyé. Réponse sous 48 h." en="Message sent. Reply within 48 h." lang={lang} /></span>
      </div>
    </div>
  );
}
