# Landing Page Design Brief — Verado

You are designing the landing page for a final-year engineering project. This document gives you everything you need: what the product does, who it's for, what to show, and what tone to strike. Read it end-to-end before generating.

---

## 1. Product Snapshot

**Name:** Verado
**Tagline:** Défense intelligente contre les cyberattaques 6G
**Type:** Production-grade Intrusion Detection System (IDS) for 5G/6G IoT smart-city networks
**Origin:** ESPRIT School of Engineering · Class 4DATA · 2026 · Projet Intégrateur de Fin d'Études (final-year capstone)
**Repository:** `Esprit-PI-4DATA-2026-6G-Network-Anomaly-Detection`

**One-sentence pitch:**
Verado is an AI-powered platform that detects cyberattacks on 5G and 6G IoT networks in real time, combining a Mixture-of-Experts ensemble (XGBoost + Autoencoders) with a full MLOps pipeline — built as a complete microservices architecture with continuous monitoring, drift detection, and automated retraining.

---

## 2. Target Audience

The landing page is shown to:

1. **Academic jury** — professors evaluating the technical depth and engineering rigor
2. **Recruiters / industry partners** — looking for production-ready ML competence
3. **Fellow students & engineers** — exploring the architecture for inspiration or collaboration

This means the design must feel **professional and technical**, not playful or marketing-fluffy. Think "SaaS platform" not "startup gimmick." Calm authority. Inspired by: Linear, Vercel, Stripe, Anthropic's own docs aesthetic.

---

## 3. What Makes Verado Worth Showing

Pick the strongest of these to highlight in the hero and feature sections:

### Technical achievements
- **Mixture of Experts (MoE)** — 5 specialized models (3 XGBoost for 5G slices: eMBB/mMTC/URLLC + 2 Keras autoencoders for 6G protocols: TCP/UDP), unified by an MLP gating network with Platt-scaled calibration
- **Zero-day detection** — unsupervised autoencoders detect attacks never seen during training
- **99.6% accuracy** on the 5G benchmark, 97% ROC-AUC, <200ms P95 latency per batch of 100 flows
- **Real-time inference** — FastAPI service with hot-reload, Redis cache, Prometheus instrumentation

### MLOps maturity
- **21 microservices** orchestrated via Docker Compose (3 ML services + 6 dashboard services + 12 infra/observability services)
- **MLflow** for experiment tracking and model registry with auto-promotion (F1 ≥ 0.90, Recall ≥ 0.95, PR-AUC ≥ 0.92 → auto-promote to Production)
- **Drift detection** — PSI + KS statistical tests on 7-day rolling windows, with Slack alerts
- **CI/CD** — GitHub Actions with quality gates (ruff, black, bandit, pip-audit), smoke training, multi-image Docker push
- **Full observability** — Prometheus + Grafana with 4 dashboard rows (inference metrics, machine, containers, model quality)

### Engineering polish
- **JWT + RBAC** authentication with bcrypt-hashed passwords
- **Async batch processing** via Celery workers + Redis broker
- **S3-compatible storage** via MinIO for uploaded datasets
- **PDF report generation** via reportlab
- **Next.js 14 frontend** with role-gated pages and 26 unit-tested UI components

---

## 4. Visual Identity

**Logo concept:** Square gradient mark (indigo → blue) with a translucent inner highlight. Brand name "Verado" in Inter, weight 700. Small uppercase tag "6G IDS" in JetBrains Mono.

**Color system (dark theme, the only mode for the landing):**
- Background: `#0a0a0a` (near-black) with subtle radial gradients (blue top-left, emerald bottom-right)
- Foreground: `#fafafa` for headings, `#a1a1aa` for body, `#71717a` for muted captions
- Primary accent: `#6366f1` (indigo) → `#3b82f6` (blue) gradient on buttons and brand marks
- Status colors: `#10b981` (ok/benign), `#ef4444` (critical/attack), `#f59e0b` (warn)
- Lines/borders: `#222222`

**Typography:**
- **Sans:** Inter (400, 500, 600, 700) — all body, headings, UI
- **Mono:** JetBrains Mono (400, 500, 600) — code snippets, badges, metric values, terminal mock
- **Headings:** tight letter-spacing (-0.02em to -0.04em), heavy weights (700-800)
- **Body:** 14–16px, line-height 1.65–1.75

**Visual motifs to consider:**
- Animated gradient orbs in the hero background (slow, ambient)
- Subtle dotted grid pattern as background texture
- A "terminal" component showing a fake `curl` API call with syntax-highlighted JSON response
- Animated counters for stats (99.6%, <200ms, 21, 6G)
- Glassy cards with `backdrop-filter: blur` and 1px translucent borders

---

## 5. Page Structure (Sections in Order)

This is the recommended outline. You can collapse or rearrange but cover all the bullets.

### A. Sticky top navigation
- Brand on the left (logo mark + "Verado" + small "6G IDS" tag)
- Anchor links: Solution · Objectifs · Avantages · Fonctionnement · Visite guidée · Partenaires · Contact
- Right side: language toggle (FR/EN), "Se connecter →" button
- ⚠️ **Important:** No "Dashboard" button — all access must go through `/login`

### B. Hero
- Floating pill: "Projet Ingénierie · ESPRIT 2026 · 4DATA"
- Headline (2 lines, second line in gradient): "Défense intelligente contre / les cyberattaques 6G"
- Subhead: 1–2 lines on what Verado is
- Primary CTA: "Se connecter →" → `/login`
- Secondary CTA: "Découvrir la solution ↓" → scroll to `#solution`
- 4 hero stats: 99.6% accuracy, <200ms latency, 21 microservices, 6G ready
- Side: fake terminal showing API response

### C. Trust strip
- Horizontal row of micro-badges: "Architecture microservices · RBAC & JWT · MLOps CI/CD · Observabilité temps réel · Détection zero-day"

### D. Solution
- 2-column: paragraph explaining what Verado is and why behavioral ML beats static rules
- 4 definition cards: IDS, MoE, MLOps, PSI
- Right column: visualization of the architecture stack (raw flow → features → 5 experts → gate → score)

### E. Objectifs
- 4 cards: secure 6G networks, reduce response time, automate the ML cycle, simplify operations

### F. Avantages (Why choose Verado)
- 6 feature cards with emoji icons:
  - 🧠 Mixture of Experts
  - 🔭 Zero-day detection
  - ⚡ Real-time < 200ms
  - 🔬 Drift detection
  - 🔐 Enterprise security
  - ♻️ Automated MLOps
- Below: 4 animated metric counters with progress bars (99.6% precision, 97% ROC-AUC, 99% recall, 95% PR-AUC)

### G. Fonctionnement (How it works)
- Vertical numbered timeline, 5 steps:
  1. Collecte des flux (data ingestion)
  2. Pré-traitement (feature engineering)
  3. Ensemble MoE (5 experts + gate)
  4. Score d'attaque (probability + verdict)
  5. Alerte & Rapport (dashboard + Slack + PDF)

### H. Visite guidée (Dashboard walkthrough — interactive)
- **This is the centerpiece.** A 2-column interactive map of the dashboard journey.
- Left: clickable step list with number badges (color-coded), title, and 2-line description
- Right: large screenshot frame (16:10 aspect ratio) + meta panel (title, description, feature pills, prev/next nav)
- 8 steps to cover:
  1. Connexion sécurisée (Login) — `#6366f1`
  2. Tableau de bord (Dashboard overview) — `#3b82f6`
  3. Upload & Prédiction — `#06b6d4`
  4. Prédictions temps réel — `#10b981`
  5. Historique — `#f59e0b`
  6. Détection de dérive — `#ef4444`
  7. Registre des modèles (MLflow) — `#8b5cf6`
  8. Administration — `#64748b`
- Screenshots load from `/screenshots/<name>.png`; missing files fall back to a stylized browser-mockup placeholder

### I. Cas d'usage (Use cases)
- 3 cards: Smart City SOC, Campus & Industrie 4.0, Lab R&D 5G/6G

### J. Partenaires & Technologies
- 6 partner cards with emoji logos: ESPRIT, MLflow, Prometheus, Grafana, Docker, GitHub
- Below: horizontal "tech pills" row — Python 3.11, XGBoost, Keras, scikit-learn, FastAPI, Next.js 14, PostgreSQL, Redis, MinIO, Docker, GitHub Actions, Celery, Prometheus, Grafana, MLflow, Trivy

### K. Témoignages (Testimonials)
- 3 cards with short quotes from imaginary SOC analyst / mentor / DevOps engineer

### L. L'Équipe (Team)
- 6 student profiles, photo placeholder (with letter-initial fallback), name, role, email
- Members:
  - Nawres Bensethom — Team Lead · ML Engineering
  - Hadil Fatnassi — Data Science · AI
  - Maram Kaouach — Frontend · UX
  - Mohamed Seifeddine Ouarag — Backend · Microservices
  - Mohamed Khaled Benhmida — MLOps · DevOps
  - Amine Trabelsi — Security · Infrastructure

### M. FAQ
- 4 expandable items: What is an AI-based IDS? · Why does 6G need a different approach? · What is MoE? · How to deploy?
- ⚠️ Do **not** include demo credentials anywhere — for security.

### N. Contact
- Left: contact info (institution, email, GitHub, hours)
- Right: contact form (name, email, subject, message) with success state

### O. CTA banner
- Large headline: "Prêt à sécuriser votre réseau 6G ?"
- Subhead + single CTA button → `/login`
- ⚠️ No demo credentials shown — removed for security.

### P. Newsletter
- Email input + "S'abonner" button
- Confirmation/error messages

### Q. Footer
- 4 columns: brand+tagline · Navigation anchors · Application (Se connecter only) · Resources (MLflow UI, Grafana, API Docs, GitHub, Privacy, Terms)
- Bottom bar: copyright + project line

---

## 6. Interactivity Requirements

- **Smooth scroll** on anchor clicks
- **Scroll-aware nav** — adds backdrop blur + border when scrolled past 50px
- **Animated counters** on stat numbers (count up from 0 over ~1.5s when in viewport)
- **FAQ items** — click to expand/collapse
- **Walkthrough section** — click step on left, preview on right updates with smooth crossfade
- **Form submission** — show success toast for 4s after submit
- **Newsletter** — POSTs to `/api/newsletter`, shows ok/err message
- **Chatbot** — floating widget in the corner, opens to a small chat interface (only on the landing page)
- **Session clearing** — on landing-page mount, clear any auth tokens so users always re-authenticate

---

## 7. Tone of Voice

**Language:** Primary in **French**, with a French/English toggle. The French should be professional and slightly formal — not overly casual.

**Vocabulary cues:**
- Use technical terms (XGBoost, autoencoder, MLOps, PSI, RBAC) — your audience understands them
- Avoid empty marketing words: "révolutionnaire," "incroyable," "next-generation" (unless ironic in a tech context)
- Concrete claims over vague promises: "<200ms P95" beats "lightning fast"

**Voice examples:**
- ✅ "Une plateforme IDS de niveau production combinant un ensemble Mixture-of-Experts, une architecture microservices complète et un pipeline MLOps automatisé."
- ❌ "La solution révolutionnaire qui change tout dans la cybersécurité moderne."

---

## 8. Technical Constraints

- **Framework:** Next.js 14 App Router (React Server Components compatible) — but the landing must be `"use client"` because of state and animations
- **Styling:** CSS Modules (file pattern: `*.module.css`). No Tailwind, no styled-components.
- **Theme:** Force dark mode on the landing only via `data-theme="dark"` on the root container. The rest of the app respects user preference.
- **Fonts:** Load from Google Fonts in the root layout (already done): Inter (400/500/600/700) + JetBrains Mono (400/500/600)
- **No external UI library** — components are hand-rolled in `src/components/ui.tsx`
- **Accessibility:** all interactive elements keyboard-reachable, semantic HTML (`<nav>`, `<section>`, `<article>`, `<button>`), aria labels where icon-only

---

## 9. Things to Avoid

- ❌ Showing demo credentials anywhere (login info, admin passwords)
- ❌ Direct links to `/dashboard`, `/upload`, `/drift`, `/model` — all access must funnel through `/login`
- ❌ Emojis in section headings (they're fine as inline icons inside cards)
- ❌ Stock photos — use the team's actual headshots from `public/team/`
- ❌ Generic "AI" buzzwords without backing claims
- ❌ Light theme styles for the landing (will break the design)

---

## 10. Reference Files in the Existing Project

If you want to inspect the current implementation as a starting point:
- `dashboard/frontend/src/app/landing/page.tsx` — current landing page component
- `dashboard/frontend/src/app/landing/landing.module.css` — current styles
- `dashboard/frontend/src/app/globals.css` — theme variables and base reset
- `dashboard/frontend/src/components/Chatbot.tsx` — floating chatbot widget
- `dashboard/frontend/public/team/` — actual team photos
- `dashboard/frontend/public/screenshots/` — dashboard screenshots for the walkthrough

---

## What I want from you

Generate a **complete, production-ready landing page**:
1. A single `page.tsx` file (client component, all sections from §5 implemented)
2. A matching CSS Module file with the full design system (or styles tag if you prefer single-file)
3. Polished, technically credible, and visually striking
4. Optimized for the academic-jury + technical-recruiter audience
5. French copy, with comments noting where the EN translation goes for each label

Make it feel like a real product — not a school project.
