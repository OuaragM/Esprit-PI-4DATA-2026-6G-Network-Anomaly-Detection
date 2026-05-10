"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <div className="brand-name">Verado</div>
          <div className="footer-tag">Système IDS 6G · ESPRIT 2026</div>
        </div>
        <div className="footer-links">
          <Link href="/">Accueil</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/upload">Prédiction</Link>
          <Link href="/drift">Dérive</Link>
        </div>
        <div className="footer-right">
          <span>© 2026 Verado · ESPRIT</span>
        </div>
      </div>
    </footer>
  );
}
