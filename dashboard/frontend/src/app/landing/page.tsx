"use client";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { LangToggle } from "@/components/LangToggle";
import { useTranslation } from "@/components/I18nProvider";
import s from "./landing.module.css";

/* ── data ── */
const NAV_LINK_KEYS = ["solution", "objectives", "advantages", "how", "partners", "contact"] as const;

const OBJECTIVES = [
  {
    title: "Sécuriser les réseaux 6G",
    desc: "Détecter rapidement les comportements malveillants dans les flux eMBB, mMTC et URLLC.",
  },
  {
    title: "Réduire le temps de réponse",
    desc: "Fournir des verdicts exploitables en quasi temps réel pour accélérer les décisions SOC.",
  },
  {
    title: "Automatiser le cycle ML",
    desc: "Assurer entraînement, versioning, déploiement et surveillance continue des modèles.",
  },
  {
    title: "Faciliter l'exploitation",
    desc: "Offrir un dashboard clair, des alertes actionnables et une traçabilité complète.",
  },
];

const STATS = [
  { v: "99.6%", l: "Précision XGBoost" },
  { v: "<200ms", l: "Latence P95" },
  { v: "21", l: "Microservices" },
  { v: "6G", l: "Réseau cible" },
];

const ADVANTAGES = [
  { icon: "🧠", title: "IA Mixte d'Experts", desc: "Cinq modèles spécialisés (XGBoost eMBB/mMTC/URLLC + Autoencoders TCP/UDP) fusionnés par un réseau de porte MLP — précision supérieure à tout modèle unique." },
  { icon: "🔭", title: "Détection Zero-Day", desc: "Isolation Forest & Autoencoders détectent des attaques inédites sur trafic 6G non étiqueté sans aucun exemple d'entraînement préalable." },
  { icon: "⚡", title: "Temps Réel < 200ms", desc: "Service FastAPI avec hot-reload, cache Redis et Prometheus — moins de 200ms de latence P95 par lot de 100 flux réseau." },
  { icon: "🔬", title: "Détection de Dérive", desc: "Fenêtres PSI sur 7 jours déclenchent automatiquement alertes Slack et réentraînement dès qu'une dérive conceptuelle est détectée." },
  { icon: "🔐", title: "Sécurité Entreprise", desc: "JWT + RBAC, bcrypt, X-Api-Key interne, scanning Trivy/Bandit/pip-audit — conforme aux exigences de sécurité de production." },
  { icon: "♻️", title: "MLOps Automatisé", desc: "CI/CD GitHub Actions, MLflow, promotion automatique (F1≥0.90), 9 images Docker, surveillance Grafana en temps réel." },
];

const HOW = [
  { step: "01", title: "Collecte des flux", desc: "Ingestion de trafic réseau 5G/6G en temps réel (eMBB, mMTC, URLLC) via upload CSV ou API streaming." },
  { step: "02", title: "Pré-traitement", desc: "16 features unifiées, log-transformations, filtrage de corrélation, normalisation StandardScaler globale." },
  { step: "03", title: "Ensemble MoE", desc: "5 experts spécialisés analysent le flux. Le réseau de porte MLP pondère leurs sorties via calibration de Platt." },
  { step: "04", title: "Score d'attaque", desc: "Score de probabilité [0,1]. Seuil configurable (défaut 0.60). Verdict : ATTACK / BENIGN avec poids des experts." },
  { step: "05", title: "Alerte & Rapport", desc: "Dashboard temps réel, export PDF, alertes Slack, métriques Prometheus — observabilité totale." },
];

const PARTNERS = [
  { name: "ESPRIT", full: "École Supérieure Privée d'Ingénierie et de Technologies", logo: "🏛️", type: "Institution académique" },
  { name: "MLflow", full: "Experiment tracking & model registry", logo: "🔬", type: "Open Source" },
  { name: "Prometheus", full: "Monitoring & alerting toolkit", logo: "📡", type: "CNCF Project" },
  { name: "Grafana", full: "Observability platform", logo: "📊", type: "Open Source" },
  { name: "Docker", full: "Container platform", logo: "🐳", type: "Infrastructure" },
  { name: "GitHub", full: "CI/CD & source control via Actions", logo: "⚙️", type: "DevOps" },
];

const TRUST_ITEMS = [
  "Architecture microservices",
  "RBAC & JWT",
  "MLOps CI/CD",
  "Observabilite temps reel",
  "Detection zero-day",
];

const USE_CASES = [
  {
    title: "Smart City SOC",
    desc: "Surveille en continu les flux urbains IoT et priorise les alertes critiques en temps reel.",
  },
  {
    title: "Campus & Industrie 4.0",
    desc: "Protege des environnements multi-sites avec segmentation des flux et rapports d'incidents.",
  },
  {
    title: "Lab R&D 5G/6G",
    desc: "Permet des experimentations rapides sur de nouveaux jeux de donnees et modeles IDS.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "Verado nous donne enfin une vision exploitable des anomalies 6G, avec une interface claire et des alertes actionnables.",
    name: "Responsable SOC",
    org: "Projet pilote Smart Infrastructure",
  },
  {
    quote:
      "La combinaison MoE + monitoring continu rend la solution pertinente pour des environnements reseau en evolution rapide.",
    name: "Encadrant Technique",
    org: "Programme 4DATA",
  },
  {
    quote:
      "L'approche MLOps automatisee facilite le passage du prototype a une plateforme utilisable en conditions reelles.",
    name: "Ingenieur DevOps",
    org: "Equipe Integratrice",
  },
];

const TEAM = [
  { name: "Nawres Bensethom", role: "Team Lead · ML Engineering", email: "nawres@esprit.tn", photo: "/team/nawres.jpg" },
  { name: "Hadil Fatnassi", role: "Data Science · AI", email: "team@esprit.tn", photo: "/team/hadil.jpg" },
  { name: "Maram Kaouach", role: "Frontend · UX", email: "team@esprit.tn", photo: "/team/maram.jpg" },
  { name: "Mohamed Seifeddine Ouarag", role: "Backend · Microservices", email: "team@esprit.tn", photo: "/team/seifeddine.jpg" },
  { name: "Mohamed Khaled Benhmida", role: "MLOps · DevOps", email: "team@esprit.tn", photo: "/team/khaled.jpg" },
  { name: "Amine Trabelsi", role: "Security · Infrastructure", email: "team@esprit.tn", photo: "/team/amine.jpg" },
];

function TeamAvatar({
  name,
  photo,
  gradient,
}: {
  name: string;
  photo?: string;
  gradient: string;
}) {
  const [failed, setFailed] = useState(false);
  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className={s.teamPhoto}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div className={s.teamAvatar} style={{ background: gradient }}>
      {name.charAt(0)}
    </div>
  );
}

const FAQ = [
  { q: "Qu'est-ce qu'un système IDS basé sur l'IA ?", a: "Un IDS (Intrusion Detection System) basé sur l'IA analyse automatiquement le trafic réseau avec des algorithmes de machine learning pour détecter des comportements anormaux ou malveillants, sans se baser sur des règles fixes." },
  { q: "Pourquoi la 6G nécessite-t-elle une approche différente ?", a: "La 6G introduit des densités de connexion IoT extrêmes, des latences ultra-faibles et de nouveaux vecteurs d'attaque. Les règles statiques deviennent obsolètes rapidement — seule une approche ML adaptative peut suivre cette évolution." },
  { q: "Qu'est-ce que le Mixture-of-Experts (MoE) ?", a: "Le MoE est une architecture d'ensemble qui combine plusieurs modèles spécialisés. Un réseau de porte apprend à pondérer chaque expert selon le type de trafic, offrant une précision supérieure à tout modèle unique." },
  { q: "Comment déployer la solution ?", a: "Un seul commande : docker compose up --build -d démarre les 21 services. Accès au dashboard sur http://localhost:3000 avec les credentials admin@esprit.tn / Admin123!" },
];

/* ── animated counter ── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let cur = 0;
    const inc = to / 50;
    const t = setInterval(() => { cur = Math.min(cur + inc, to); setVal(Math.floor(cur)); if (cur >= to) clearInterval(t); }, 30);
    return () => clearInterval(t);
  }, [to]);
  return <>{val}{suffix}</>;
}

/* ── FAQ item ── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`${s.faqItem} ${open ? s.faqOpen : ""}`} onClick={() => setOpen(!open)}>
      <div className={s.faqQ}>
        <span>{q}</span>
        <span className={s.faqChev}>{open ? "−" : "+"}</span>
      </div>
      {open && <div className={s.faqA}>{a}</div>}
    </div>
  );
}

/* ── main component ── */
export default function LandingPage() {
  const { locale } = useTranslation();
  const isFr = locale === "fr";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"" | "ok" | "err">("");

  const labels = {
    nav: {
      solution: isFr ? "Solution" : "Solution",
      objectives: isFr ? "Objectifs" : "Objectives",
      advantages: isFr ? "Avantages" : "Benefits",
      how: isFr ? "Fonctionnement" : "How it works",
      partners: isFr ? "Partenaires" : "Partners",
      contact: isFr ? "Contact" : "Contact",
    },
    login: isFr ? "Se connecter" : "Sign in",
    dashboard: isFr ? "Dashboard" : "Dashboard",
    heroPill: isFr ? "Projet Ingenierie · ESPRIT 2026 · 4DATA" : "Engineering Project · ESPRIT 2026 · 4DATA",
    heroTitleLine1: isFr ? "Defense intelligente contre" : "Intelligent defense against",
    heroTitleLine2: isFr ? "les cyberattaques 6G" : "6G cyber attacks",
    heroSub: isFr
      ? "Une plateforme IDS de niveau production combinant un ensemble Mixture-of-Experts, une architecture microservices complete et un pipeline MLOps automatise."
      : "A production-grade IDS platform combining a Mixture-of-Experts ensemble, complete microservices architecture, and automated MLOps pipeline.",
    heroCta: isFr ? "Acceder au Dashboard" : "Open Dashboard",
    heroDiscover: isFr ? "Decouvrir la solution" : "Discover the solution",
    newsletterTitle: isFr ? "Recevoir les mises a jour du projet" : "Get project updates",
    newsletterText: isFr
      ? "Nouveautes techniques, evolutions du modele et retours d'experimentation."
      : "Technical updates, model evolution, and experimentation feedback.",
    newsletterButton: isFr ? "S'abonner" : "Subscribe",
    newsletterOk: isFr ? "Inscription enregistree." : "Subscription saved.",
    newsletterErr: isFr ? "Impossible de vous inscrire." : "Unable to subscribe.",
  };
  const navLinks = NAV_LINK_KEYS.map((key) => ({ href: `#${key}`, label: labels.nav[key] }));

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  }

  async function handleNewsletterSubmit(e: FormEvent) {
    e.preventDefault();
    setNewsletterStatus("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      if (!res.ok) {
        setNewsletterStatus("err");
        return;
      }
      setNewsletterStatus("ok");
      setNewsletterEmail("");
    } catch {
      setNewsletterStatus("err");
    }
  }

  return (
    <div className={s.root}>

      {/* ══ NAV ══ */}
      <nav className={`${s.nav} ${scrolled ? s.navScrolled : ""}`}>
        <div className={s.navInner}>
          <a href="#" className={s.brand}>
            <div className={s.brandMark} />
            <span className={s.brandName}>Verado</span>
            <span className={s.brandTag}>6G IDS</span>
          </a>
          <button className={s.mobileMenuBtn} onClick={() => setMobileOpen((v) => !v)} type="button">
            {mobileOpen ? "Close" : "Menu"}
          </button>
          <div className={`${s.navLinks} ${mobileOpen ? s.navLinksOpen : ""}`}>
            {navLinks.map((l) => <a key={l.href} href={l.href} className={s.navLink}>{l.label}</a>)}
          </div>
          <div className={s.navActions}>
            <LangToggle />
            <Link href="/login" className={s.btnGhost}>{labels.login}</Link>
            <Link href="/dashboard" className={s.btnPrimary}>{labels.dashboard} →</Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══ */}
      <section className={s.hero}>
        <div className={s.heroBg}>
          <div className={s.orb1} /><div className={s.orb2} /><div className={s.orb3} />
          <div className={s.gridBg} />
        </div>
        <div className={s.heroContent}>
          <div className={s.heroPill}>
            <span className={s.pillDot} />
            {labels.heroPill}
          </div>
          <h1 className={s.heroTitle}>
            {labels.heroTitleLine1}<br />
            <span className={s.heroGrad}>{labels.heroTitleLine2}</span>
          </h1>
          <p className={s.heroSub}>{labels.heroSub}</p>
          <div className={s.heroCtas}>
            <Link href="/dashboard" className={s.ctaBig}>{labels.heroCta} →</Link>
            <a href="#solution" className={s.ctaOutline}>{labels.heroDiscover} ↓</a>
          </div>
          <div className={s.heroStats}>
            {STATS.map(st => (
              <div key={st.l} className={s.heroStat}>
                <span className={s.heroStatV}>{st.v}</span>
                <span className={s.heroStatL}>{st.l}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Terminal */}
        <div className={s.term}>
          <div className={s.termBar}>
            <span className={s.dot} style={{background:"#ff5f56"}} />
            <span className={s.dot} style={{background:"#ffbd2e"}} />
            <span className={s.dot} style={{background:"#27c93f"}} />
            <span className={s.termTitle}>moe-inference-svc · live</span>
          </div>
          <div className={s.termBody}>
            <div><span className={s.tGreen}>$</span> curl /api/predict/batch</div>
            <div>&nbsp;</div>
            <div><span className={s.tBlue}>"model"</span>: <span className={s.tGreen}>"MoE-v2.3.1"</span>,</div>
            <div><span className={s.tBlue}>"latency_ms"</span>: <span className={s.tRed}>142</span>,</div>
            <div><span className={s.tBlue}>"verdict"</span>: <span className={s.tCrit}>"ATTACK"</span>,</div>
            <div><span className={s.tBlue}>"score"</span>: <span className={s.tRed}>0.983</span>,</div>
            <div><span className={s.tBlue}>"expert"</span>: <span className={s.tGreen}>"xgb_embb"</span></div>
            <div className={s.termCursor} />
          </div>
        </div>
      </section>

      <section className={s.trustStrip}>
        <div className={s.inner}>
          <div className={s.trustRow}>
            {TRUST_ITEMS.map((item) => (
              <span key={item} className={s.trustItem}>
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ SOLUTION ══ */}
      <section id="solution" className={s.section}>
        <div className={s.inner}>
          <div className={s.twoCol}>
            <div className={s.solutionText}>
              <span className={s.label}>La Solution</span>
              <h2 className={s.h2}>Qu'est-ce que Verado ?</h2>
              <p className={s.para}>
                <strong>Verado</strong> est un système de détection d'intrusions (IDS) nouvelle génération,
                conçu pour protéger les infrastructures IoT des villes intelligentes opérant sur les
                réseaux <strong>5G/6G</strong>. Il combine l'apprentissage supervisé et non-supervisé
                dans une architecture <em>Mixture-of-Experts</em> pour identifier en temps réel
                des attaques connues et inédites (zero-day).
              </p>
              <p className={s.para}>
                Face à l'explosion des objets connectés et à la montée en puissance de la 6G,
                les systèmes de sécurité basés sur des règles statiques ne suffisent plus.
                Verado adopte une approche comportementale et adaptative : les modèles apprennent
                la structure normale du trafic et signalent toute déviation statistiquement significative.
              </p>
              <div className={s.defGrid}>
                {[
                  { t: "IDS", d: "Intrusion Detection System — détecte les comportements anormaux sans bloquer le trafic." },
                  { t: "MoE", d: "Mixture-of-Experts — ensemble de modèles spécialisés fusionnés par un réseau de porte." },
                  { t: "MLOps", d: "Machine Learning Operations — automatisation du cycle de vie des modèles en production." },
                  { t: "PSI", d: "Population Stability Index — mesure de la dérive de distribution des données d'entrée." },
                ].map(d => (
                  <div key={d.t} className={s.defCard}>
                    <div className={s.defTerm}>{d.t}</div>
                    <div className={s.defDef}>{d.d}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className={s.solutionViz}>
              <div className={s.vizCard}>
                <div className={s.vizLabel}>Architecture MoE</div>
                {["Flux 5G/6G brut", "Feature Engineering (16 features)", "StandardScaler global", "XGBoost eMBB  ·  XGBoost mMTC  ·  XGBoost URLLC", "Autoencoder TCP  ·  Autoencoder UDP", "Gate MLP + Calibration de Platt", "Score d'attaque [0 → 1]"].map((l, i) => (
                  <div key={i} className={s.vizRow} style={{ opacity: 1 - i * 0.04 }}>
                    <div className={s.vizRowBar} style={{ background: ["#6366f1","#3b82f6","#06b6d4","#10b981","#10b981","#f59e0b","#ef4444"][i] }} />
                    <span>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ OBJECTIVES ══ */}
      <section id="objectives" className={s.section}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Objectifs du projet</span>
            <h2 className={s.h2}>Ce que nous voulons accomplir</h2>
            <p className={s.secSub}>
              Une plateforme IDS fiable, explicable et exploitable en contexte académique et industriel.
            </p>
          </div>
          <div className={s.objectivesGrid}>
            {OBJECTIVES.map((item) => (
              <article key={item.title} className={s.objectiveCard}>
                <h3 className={s.objectiveTitle}>{item.title}</h3>
                <p className={s.objectiveDesc}>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ADVANTAGES ══ */}
      <section id="advantages" className={s.altSection}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Avantages</span>
            <h2 className={s.h2}>Pourquoi choisir Verado ?</h2>
            <p className={s.secSub}>Une solution complète, automatisée et prête pour la production dès le premier jour.</p>
          </div>
          <div className={s.advGrid}>
            {ADVANTAGES.map(a => (
              <div key={a.title} className={s.advCard}>
                <div className={s.advIcon}>{a.icon}</div>
                <h3 className={s.advTitle}>{a.title}</h3>
                <p className={s.advDesc}>{a.desc}</p>
              </div>
            ))}
          </div>
          {/* Metrics strip */}
          <div className={s.metricsStrip}>
            {[
              { label: "Précision XGBoost", val: 99.6, color: "#10b981" },
              { label: "ROC-AUC", val: 97, color: "#6366f1" },
              { label: "Recall (attaques)", val: 99, color: "#f59e0b" },
              { label: "PR-AUC", val: 95, color: "#3b82f6" },
            ].map(m => (
              <div key={m.label} className={s.metricItem}>
                <div className={s.metricVal} style={{ color: m.color }}>
                  <Counter to={m.val} suffix="%" />
                </div>
                <div className={s.metricLabel}>{m.label}</div>
                <div className={s.metricTrack}><div className={s.metricFill} style={{ width: `${m.val}%`, background: m.color }} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section id="how" className={s.section}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Fonctionnement</span>
            <h2 className={s.h2}>Comment ça marche ?</h2>
            <p className={s.secSub}>Du flux réseau brut au verdict d'attaque en 5 étapes automatisées.</p>
          </div>
          <div className={s.howList}>
            {HOW.map((h, i) => (
              <div key={i} className={s.howStep}>
                <div className={s.howNum}>{h.step}</div>
                <div className={s.howLine} />
                <div className={s.howCard}>
                  <div className={s.howTitle}>{h.title}</div>
                  <div className={s.howDesc}>{h.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ USE CASES ══ */}
      <section className={s.altSection}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Cas d'usage</span>
            <h2 className={s.h2}>Ou Verado apporte le plus de valeur</h2>
            <p className={s.secSub}>Concu pour des contextes operationnels, academiques et industriels.</p>
          </div>
          <div className={s.useCasesGrid}>
            {USE_CASES.map((item) => (
              <article key={item.title} className={s.useCaseCard}>
                <h3 className={s.useCaseTitle}>{item.title}</h3>
                <p className={s.useCaseDesc}>{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ PARTNERS ══ */}
      <section id="partners" className={s.altSection}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Partenaires & Technologies</span>
            <h2 className={s.h2}>Construit avec les meilleurs outils</h2>
            <p className={s.secSub}>Verado s'appuie sur un écosystème open-source reconnu dans l'industrie.</p>
          </div>
          <div className={s.partnersGrid}>
            {PARTNERS.map(p => (
              <div key={p.name} className={s.partnerCard}>
                <div className={s.partnerLogo}>{p.logo}</div>
                <div className={s.partnerName}>{p.name}</div>
                <div className={s.partnerFull}>{p.full}</div>
                <span className={s.partnerType}>{p.type}</span>
              </div>
            ))}
          </div>
          {/* Tech pills */}
          <div className={s.techPills}>
            {["Python 3.11","XGBoost","Keras / TensorFlow","scikit-learn","FastAPI","Next.js 14","PostgreSQL","Redis","MinIO","Docker","GitHub Actions","Celery","Prometheus","Grafana","MLflow","Trivy"].map(t => (
              <span key={t} className={s.techPill}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ══ */}
      <section className={s.section}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Retours</span>
            <h2 className={s.h2}>Ce qu'on dit de Verado</h2>
          </div>
          <div className={s.testimonialsGrid}>
            {TESTIMONIALS.map((item) => (
              <article key={item.name} className={s.testimonialCard}>
                <p className={s.testimonialQuote}>"{item.quote}"</p>
                <div className={s.testimonialMeta}>
                  <strong>{item.name}</strong>
                  <span>{item.org}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TEAM ══ */}
      <section className={s.section}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>L'Équipe</span>
            <h2 className={s.h2}>Étudiants ingénieurs — ESPRIT 2026</h2>
            <p className={s.secSub}>Classe 4DATA · Groupe 6G · Projet Intégrateur de Fin d'Études</p>
          </div>
          <div className={s.teamGrid}>
            {TEAM.map((m, i) => (
              <div key={i} className={s.teamCard}>
                <TeamAvatar
                  name={m.name}
                  photo={m.photo}
                  gradient={
                    [
                      "linear-gradient(135deg,#6366f1,#3b82f6)",
                      "linear-gradient(135deg,#3b82f6,#06b6d4)",
                      "linear-gradient(135deg,#10b981,#3b82f6)",
                      "linear-gradient(135deg,#f59e0b,#ef4444)",
                    ][i % 4]
                  }
                />
                <div className={s.teamName}>{m.name}</div>
                <div className={s.teamRole}>{m.role}</div>
                <a href={`mailto:${m.email}`} className={s.teamEmail}>{m.email}</a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className={s.altSection}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>FAQ</span>
            <h2 className={s.h2}>Questions fréquentes</h2>
          </div>
          <div className={s.faqList}>
            {FAQ.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
          </div>
        </div>
      </section>

      {/* ══ CONTACT ══ */}
      <section id="contact" className={s.section}>
        <div className={s.inner}>
          <div className={s.secHead}>
            <span className={s.label}>Contact</span>
            <h2 className={s.h2}>Nous contacter</h2>
            <p className={s.secSub}>Une question sur le projet ? Envoyez-nous un message.</p>
          </div>
          <div className={s.contactGrid}>
            {/* Info */}
            <div className={s.contactInfo}>
              {[
                { icon: "🏛️", title: "Institution", lines: ["ESPRIT — École Supérieure Privée","d'Ingénierie et de Technologies","2 Rue de l'Artisanat, Tunis"] },
                { icon: "📧", title: "Email", lines: ["nawres@esprit.tn","4data-6g@esprit.tn"] },
                { icon: "💻", title: "GitHub", lines: ["github.com/nawresbensethom/","Esprit-PI-4DATA-2026-6G"] },
                { icon: "🕐", title: "Disponibilité", lines: ["Lun–Ven : 9h00 – 18h00","Réponse sous 24h"] },
              ].map(c => (
                <div key={c.title} className={s.contactItem}>
                  <div className={s.contactIcon}>{c.icon}</div>
                  <div>
                    <div className={s.contactTitle}>{c.title}</div>
                    {c.lines.map((l, i) => <div key={i} className={s.contactLine}>{l}</div>)}
                  </div>
                </div>
              ))}
            </div>
            {/* Form */}
            <form onSubmit={handleSubmit} className={s.contactForm}>
              {sent && <div className={s.successMsg}>✅ Message envoyé ! Nous vous répondrons sous 24h.</div>}
              <div className={s.formRow}>
                <div className={s.formField}>
                  <label className={s.formLabel}>Nom complet</label>
                  <input required className={s.formInput} placeholder="Votre nom" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className={s.formField}>
                  <label className={s.formLabel}>Email</label>
                  <input required type="email" className={s.formInput} placeholder="votre@email.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className={s.formField}>
                <label className={s.formLabel}>Sujet</label>
                <input required className={s.formInput} placeholder="Objet de votre message" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
              </div>
              <div className={s.formField}>
                <label className={s.formLabel}>Message</label>
                <textarea required rows={5} className={s.formTextarea} placeholder="Décrivez votre demande..." value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} />
              </div>
              <button type="submit" className={s.formBtn}>Envoyer le message →</button>
            </form>
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══ */}
      <section className={s.ctaBanner}>
        <div className={s.ctaOrb} />
        <div className={s.inner} style={{ textAlign: "center", position: "relative" }}>
          <h2 className={s.ctaTitle}>Prêt à sécuriser votre réseau 6G ?</h2>
          <p className={s.ctaSub}>Connectez-vous avec les credentials de démonstration et lancez une prédiction en 60 secondes.</p>
          <div className={s.ctaRow}>
            <Link href="/login" className={s.ctaBig}>Commencer maintenant →</Link>
            <div className={s.ctaCreds}>
              <span className={s.credsLabel}>Démo</span>
              <code>admin@esprit.tn</code> · <code>Admin123!</code>
            </div>
          </div>
        </div>
      </section>

      <section className={s.newsletterSection}>
        <div className={s.inner}>
          <div className={s.newsletterBox}>
            <div>
              <h3 className={s.newsletterTitle}>{labels.newsletterTitle}</h3>
              <p className={s.newsletterText}>{labels.newsletterText}</p>
            </div>
            <form className={s.newsletterForm} onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                required
                placeholder="votre@email.com"
                className={s.newsletterInput}
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
              />
              <button type="submit" className={s.newsletterBtn}>{labels.newsletterButton}</button>
            </form>
            {newsletterStatus === "ok" && <p className={s.newsletterMsgOk}>{labels.newsletterOk}</p>}
            {newsletterStatus === "err" && <p className={s.newsletterMsgErr}>{labels.newsletterErr}</p>}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className={s.footer}>
        <div className={s.footerTop}>
          <div className={s.inner}>
            <div className={s.footerGrid}>
              <div className={s.footerBrand}>
                <div className={s.brandMark} />
                <span className={s.brandName}>Verado</span>
                <p className={s.footerTagline}>Système de Détection d'Intrusions IA pour réseaux 6G — Projet de Fin d'Études ESPRIT 2026.</p>
              </div>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Navigation</div>
                {[["#solution","Solution"],["#objectives","Objectifs"],["#advantages","Avantages"],["#how","Fonctionnement"],["#partners","Partenaires"],["#contact","Contact"]].map(([h,l]) => (
                  <a key={h} href={h} className={s.footerLink}>{l}</a>
                ))}
              </div>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Application</div>
                {[["/login","Se connecter"],["/dashboard","Dashboard"],["/upload","Prédiction"],["/drift","Dérive"],["/model","Modèles"]].map(([h,l]) => (
                  <Link key={h} href={h} className={s.footerLink}>{l}</Link>
                ))}
              </div>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Ressources</div>
                <a href="http://localhost:5000" target="_blank" rel="noopener" className={s.footerLink}>MLflow UI</a>
                <a href="http://localhost:3001" target="_blank" rel="noopener" className={s.footerLink}>Grafana</a>
                <a href="http://localhost:8090/docs" target="_blank" rel="noopener" className={s.footerLink}>API Docs</a>
                <a href="https://github.com/nawresbensethom/Esprit-PI-4DATA-2026-6G-Network-Anomaly-Detection" target="_blank" rel="noopener" className={s.footerLink}>GitHub</a>
                <Link href="/privacy" className={s.footerLink}>Politique de confidentialité</Link>
                <Link href="/terms" className={s.footerLink}>Conditions d'utilisation</Link>
              </div>
            </div>
          </div>
        </div>
        <div className={s.footerBottom}>
          <div className={s.inner}>
            <span>© 2026 Verado · ESPRIT · 4DATA · Tous droits réservés.</span>
            <span>Projet Intégrateur · Détection d'Anomalies Réseaux 6G par IA</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
