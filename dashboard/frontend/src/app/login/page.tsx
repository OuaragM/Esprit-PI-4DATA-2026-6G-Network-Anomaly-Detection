"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";
import "./login.css";

function VeradoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 240" aria-hidden="true">
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
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="arr" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8 H13 M9 4 L13 8 L9 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M13 8 H3 M7 4 L3 8 L7 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    <div className="login-page">
      {/* ── Left — brand panel ─────────────────────────────────── */}
      <div className="login-brand">
        <div>
          <Link href="/" className="brand">
            <VeradoMark className="mark" />
            <span className="word">Verado</span>
            <span className="tag">6G IDS</span>
          </Link>
        </div>

        <div className="login-hero">
          <span className="login-eyebrow">6G · Anomaly Detection</span>
          <h1 className="login-headline">
            Classification d&apos;attaques en <span className="accent">sous-seconde</span> pour les réseaux 6G slicés.
          </h1>
          <p className="login-lede">
            Inférence par batch, surveillance de dérive, équité par slice — dans une seule console d&apos;analyste.
          </p>

          <div className="login-stats">
            <div className="login-stat">
              <div className="v">&lt;200<span className="unit">ms</span></div>
              <div className="lab">Latence P95</div>
            </div>
            <div className="login-stat">
              <div className="v">5</div>
              <div className="lab">MoE experts</div>
            </div>
            <div className="login-stat">
              <div className="v">3</div>
              <div className="lab">Network slices</div>
            </div>
          </div>
        </div>

        <div className="login-foot">© 2026 Verado · ESPRIT 4DATA · MoE IDS</div>

        <VeradoMark className="login-watermark" />
      </div>

      {/* ── Right — sign-in form ───────────────────────────────── */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={submit}>
          <Link href="/" className="login-back"><ArrowLeft /> Retour à l&apos;accueil</Link>
          <h2>Se connecter</h2>
          <p className="sub">Authentifiez-vous pour accéder à la console de détection.</p>

          <div className="login-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              placeholder="analyste@verado.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="login-error">
              <span className="dot" />
              <div>
                <strong>Échec de connexion</strong>
                {error}
              </div>
            </div>
          )}

          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? "Authentification…" : "Continuer"}
            <ArrowRight />
          </button>

          <div className="login-meta">JWT · RBAC · bcrypt</div>
        </form>
      </div>
    </div>
  );
}
