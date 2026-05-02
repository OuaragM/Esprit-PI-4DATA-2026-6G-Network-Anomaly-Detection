/**
 * Lightweight i18n — no external library. STRINGS holds every visible label
 * keyed by a stable id; t(key) returns the locale's value or falls back to
 * the key itself, so any untranslated string still renders meaningfully.
 *
 * Locale is read from localStorage("sentra_lang") with a navigator.language
 * fallback. Updates are broadcast via React Context.
 */

export type Locale = "en" | "fr";
export const LOCALES: Locale[] = ["en", "fr"];
export const LANG_KEY = "sentra_lang";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

export type StringKey = keyof typeof EN;

const EN = {
  // ── Common ─────────────────────────────────────────────────────────
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.refresh": "Refresh",
  "common.clear": "Clear",
  "common.close": "Close",
  "common.create": "Create",
  "common.edit": "Edit",
  "common.delete": "Delete",
  "common.view": "View",
  "common.back": "Back",
  "common.loading": "Loading…",
  "common.no_data": "No data",
  "common.search": "Search…",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.signout": "Sign out",
  "common.backend_live": "backend live",
  "common.healthy": "healthy",
  "common.unreachable": "unreachable",
  "common.checking": "checking…",

  // ── Sidebar nav ────────────────────────────────────────────────────
  "nav.workspace": "Workspace",
  "nav.administration": "Administration",
  "nav.models": "Models",
  "nav.dashboard": "Dashboard",
  "nav.history": "History",
  "nav.realtime": "Realtime feed",
  "nav.upload": "New scan",
  "nav.users": "Users",
  "nav.settings": "Thresholds & config",
  "nav.drift": "Drift & fairness",
  "nav.model": "Model registry",
  "nav.account": "Account",

  // ── Role labels ────────────────────────────────────────────────────
  "role.security_analyst": "Security Analyst",
  "role.admin": "Administrator",
  "role.data_scientist": "Data Scientist",

  // ── Login ──────────────────────────────────────────────────────────
  "login.title": "Sign in",
  "login.email": "Email",
  "login.password": "Password",
  "login.submit": "Continue",
  "login.failed": "Sign-in failed",

  // ── Dashboard ──────────────────────────────────────────────────────
  "dashboard.title": "Dashboard",
  "dashboard.desc": "Live model quality, recent activity, and system health for the unified MoE IDS platform.",
  "dashboard.kpi.accuracy": "Model accuracy",
  "dashboard.kpi.f1": "F1",
  "dashboard.kpi.auc": "ROC AUC",
  "dashboard.kpi.last_training": "Last training",
  "dashboard.kpi.scans_today": "Scans today",
  "dashboard.kpi.attacks_today": "Attacks today",
  "dashboard.kpi.drift_psi": "Drift PSI",
  "dashboard.kpi.history_entries": "History entries",
  "dashboard.recent_scans": "Recent scans",
  "dashboard.drift_status": "Drift status",
  "dashboard.run_check": "Run check",

  // ── Upload ─────────────────────────────────────────────────────────
  "upload.title": "New scan",
  "upload.desc": "Upload a CSV of 5G/6G network flows. Routed through the gateway → inference-svc → MoE model.",
  "upload.dropzone": "Drop CSV file here",
  "upload.dropzone_hint": "or click to browse · accepts .csv up to 50 MB",
  "upload.start": "Start prediction",
  "upload.scoring": "Scoring…",
  "upload.new_scan": "New scan",
  "upload.predictions": "Predictions",

  // ── History ────────────────────────────────────────────────────────
  "history.title": "History",
  "history.desc": "Past prediction runs from the prediction_log Postgres table, shared across all users.",
  "history.runs": "Runs",
  "history.rows_scored": "Rows scored",
  "history.attacks_detected": "Attacks detected",
  "history.avg_attack_rate": "Avg attack rate",
  "history.past_scans": "Past scans",
  "history.clear_local": "Clear local cache",

  // ── Realtime ───────────────────────────────────────────────────────
  "realtime.title": "Realtime feed",
  "realtime.desc": "Simulated live stream of 6G flows. Each tick samples a random row, scores it, and prepends it to the feed.",
  "realtime.start": "Start feed",
  "realtime.stop": "Stop",
  "realtime.flows_scored": "Flows scored",
  "realtime.attacks": "Attacks",
  "realtime.mean_prob": "Mean probability",
  "realtime.poll_interval": "Polling interval",
  "realtime.live_flows": "Live flows",
  "realtime.expert_dist": "Expert distribution",

  // ── Drift ──────────────────────────────────────────────────────────
  "drift.title": "Drift & fairness",
  "drift.desc": "PSI on attack-rate distribution + KS test on probability scores. Compares recent prediction logs against the training baseline.",
  "drift.current_psi": "Current PSI",
  "drift.window": "Window",
  "drift.requests_in_window": "Requests in window",
  "drift.run_check": "Run drift check",
  "drift.last_report": "Last report",

  // ── Model registry ─────────────────────────────────────────────────
  "model.title": "Model registry",
  "model.desc": "Trigger training runs, watch live status, and hot-reload the inference service after a successful run.",
  "model.start_training": "Start training",
  "model.live_status": "Live training status",
  "model.hot_reload": "Hot-reload",
  "model.mlflow_registry": "MLflow registry",
  "model.open_mlflow": "Open MLflow ↗",

  // ── Users ──────────────────────────────────────────────────────────
  "users.title": "Users",
  "users.desc": "Create and manage accounts. Roles control which pages and admin actions each user can reach.",
  "users.create": "Create user",
  "users.total": "Total users",
  "users.active": "Active",
  "users.admins": "Admins",
  "users.deactivate": "Deactivate",
  "users.reactivate": "Reactivate",
  "users.reset_pwd": "Reset pwd",
  "users.modal.email": "Email",
  "users.modal.full_name": "Full name",
  "users.modal.password": "Password",
  "users.modal.role": "Role",
  "users.modal.active": "Active",

  // ── Settings ───────────────────────────────────────────────────────
  "settings.title": "Thresholds & config",
  "settings.desc": "Read-only view of the values that govern training promotion, drift detection, and inference behaviour.",
  "settings.promotion_gate": "Model promotion gate",
  "settings.drift_thresholds": "Drift detection",
  "settings.inference_limits": "Inference limits",

  // ── Account ────────────────────────────────────────────────────────
  "account.title": "My account",
  "account.desc": "Profile and security settings for the current session.",
  "account.profile": "Profile",
  "account.change_password": "Change password",
  "account.current": "Current password",
  "account.new": "New password",
  "account.confirm": "Confirm new",

  // ── Verdicts / badges ─────────────────────────────────────────────
  "verdict.attack": "attack",
  "verdict.benign": "benign",
  "status.ok": "ok",
  "status.running": "running",
  "status.success": "success",
  "status.failed": "failed",
  "status.no_run_yet": "no run yet",
  "status.drift_detected": "drift detected",
  "status.streaming": "streaming",
  "status.paused": "paused",
  "status.idle": "idle",

  // ── Notifications ──────────────────────────────────────────────────
  "notif.title": "Notifications",
  "notif.empty": "No notifications.",
  "notif.drift": "Drift detected",
  "notif.train_ok": "Training run succeeded",
  "notif.train_fail": "Training run failed",
  "notif.train_running": "Training in progress",
  "notif.model_active": "Active model version",
} as const;

const FR: Record<keyof typeof EN, string> = {
  // Common
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.refresh": "Actualiser",
  "common.clear": "Effacer",
  "common.close": "Fermer",
  "common.create": "Créer",
  "common.edit": "Modifier",
  "common.delete": "Supprimer",
  "common.view": "Voir",
  "common.back": "Retour",
  "common.loading": "Chargement…",
  "common.no_data": "Aucune donnée",
  "common.search": "Rechercher…",
  "common.actions": "Actions",
  "common.status": "Statut",
  "common.signout": "Déconnexion",
  "common.backend_live": "backend en ligne",
  "common.healthy": "fonctionnel",
  "common.unreachable": "injoignable",
  "common.checking": "vérification…",

  // Nav
  "nav.workspace": "Espace de travail",
  "nav.administration": "Administration",
  "nav.models": "Modèles",
  "nav.dashboard": "Tableau de bord",
  "nav.history": "Historique",
  "nav.realtime": "Flux en direct",
  "nav.upload": "Nouvelle analyse",
  "nav.users": "Utilisateurs",
  "nav.settings": "Seuils et config",
  "nav.drift": "Dérive et équité",
  "nav.model": "Registre du modèle",
  "nav.account": "Compte",

  // Roles
  "role.security_analyst": "Analyste sécurité",
  "role.admin": "Administrateur",
  "role.data_scientist": "Scientifique données",

  // Login
  "login.title": "Connexion",
  "login.email": "Email",
  "login.password": "Mot de passe",
  "login.submit": "Continuer",
  "login.failed": "Échec de la connexion",

  // Dashboard
  "dashboard.title": "Tableau de bord",
  "dashboard.desc": "Qualité du modèle, activité récente et état du système — plateforme MoE IDS unifiée.",
  "dashboard.kpi.accuracy": "Précision modèle",
  "dashboard.kpi.f1": "F1",
  "dashboard.kpi.auc": "ROC AUC",
  "dashboard.kpi.last_training": "Dernier entraînement",
  "dashboard.kpi.scans_today": "Analyses du jour",
  "dashboard.kpi.attacks_today": "Attaques du jour",
  "dashboard.kpi.drift_psi": "PSI dérive",
  "dashboard.kpi.history_entries": "Entrées d'historique",
  "dashboard.recent_scans": "Analyses récentes",
  "dashboard.drift_status": "État dérive",
  "dashboard.run_check": "Lancer test",

  // Upload
  "upload.title": "Nouvelle analyse",
  "upload.desc": "Téléverser un CSV de flux réseau 5G/6G. Acheminé via gateway → inference-svc → modèle MoE.",
  "upload.dropzone": "Déposez le fichier CSV ici",
  "upload.dropzone_hint": "ou cliquez pour parcourir · .csv jusqu'à 50 Mo",
  "upload.start": "Lancer la prédiction",
  "upload.scoring": "Scoring…",
  "upload.new_scan": "Nouvelle analyse",
  "upload.predictions": "Prédictions",

  // History
  "history.title": "Historique",
  "history.desc": "Analyses précédentes (table prediction_log), partagées entre utilisateurs.",
  "history.runs": "Exécutions",
  "history.rows_scored": "Lignes notées",
  "history.attacks_detected": "Attaques détectées",
  "history.avg_attack_rate": "Taux d'attaque moyen",
  "history.past_scans": "Analyses passées",
  "history.clear_local": "Vider cache local",

  // Realtime
  "realtime.title": "Flux en direct",
  "realtime.desc": "Flux simulé de paquets 6G. Chaque tick échantillonne une ligne aléatoire, la note et l'ajoute en tête.",
  "realtime.start": "Démarrer le flux",
  "realtime.stop": "Arrêter",
  "realtime.flows_scored": "Flux notés",
  "realtime.attacks": "Attaques",
  "realtime.mean_prob": "Probabilité moyenne",
  "realtime.poll_interval": "Intervalle",
  "realtime.live_flows": "Flux en direct",
  "realtime.expert_dist": "Répartition experts",

  // Drift
  "drift.title": "Dérive et équité",
  "drift.desc": "PSI sur la distribution du taux d'attaque + test KS sur les scores. Compare les logs récents à la baseline d'entraînement.",
  "drift.current_psi": "PSI actuel",
  "drift.window": "Fenêtre",
  "drift.requests_in_window": "Requêtes (fenêtre)",
  "drift.run_check": "Lancer test de dérive",
  "drift.last_report": "Dernier rapport",

  // Model
  "model.title": "Registre du modèle",
  "model.desc": "Déclencher des entraînements, suivre le statut en direct, recharger le modèle après une exécution réussie.",
  "model.start_training": "Lancer entraînement",
  "model.live_status": "Statut en direct",
  "model.hot_reload": "Recharger à chaud",
  "model.mlflow_registry": "Registre MLflow",
  "model.open_mlflow": "Ouvrir MLflow ↗",

  // Users
  "users.title": "Utilisateurs",
  "users.desc": "Créer et gérer les comptes. Les rôles contrôlent les pages et actions accessibles.",
  "users.create": "Créer un utilisateur",
  "users.total": "Utilisateurs totaux",
  "users.active": "Actifs",
  "users.admins": "Administrateurs",
  "users.deactivate": "Désactiver",
  "users.reactivate": "Réactiver",
  "users.reset_pwd": "Réinit. mdp",
  "users.modal.email": "Email",
  "users.modal.full_name": "Nom complet",
  "users.modal.password": "Mot de passe",
  "users.modal.role": "Rôle",
  "users.modal.active": "Actif",

  // Settings
  "settings.title": "Seuils et config",
  "settings.desc": "Vue lecture seule des valeurs qui régissent la promotion modèle, la détection de dérive et l'inférence.",
  "settings.promotion_gate": "Seuil de promotion",
  "settings.drift_thresholds": "Détection de dérive",
  "settings.inference_limits": "Limites d'inférence",

  // Account
  "account.title": "Mon compte",
  "account.desc": "Profil et sécurité de la session courante.",
  "account.profile": "Profil",
  "account.change_password": "Changer le mot de passe",
  "account.current": "Mot de passe actuel",
  "account.new": "Nouveau mot de passe",
  "account.confirm": "Confirmer",

  // Verdicts
  "verdict.attack": "attaque",
  "verdict.benign": "bénin",
  "status.ok": "ok",
  "status.running": "en cours",
  "status.success": "succès",
  "status.failed": "échec",
  "status.no_run_yet": "aucune exécution",
  "status.drift_detected": "dérive détectée",
  "status.streaming": "diffusion",
  "status.paused": "en pause",
  "status.idle": "inactif",

  // Notifications
  "notif.title": "Notifications",
  "notif.empty": "Aucune notification.",
  "notif.drift": "Dérive détectée",
  "notif.train_ok": "Entraînement réussi",
  "notif.train_fail": "Échec d'entraînement",
  "notif.train_running": "Entraînement en cours",
  "notif.model_active": "Version active du modèle",
};

const STRINGS: Record<Locale, Record<string, string>> = { en: EN, fr: FR };

export function t(locale: Locale, key: StringKey | string): string {
  const dict = STRINGS[locale] ?? STRINGS.en;
  // @ts-expect-error — key is widened to string for graceful fallback
  return dict[key] ?? STRINGS.en[key] ?? key;
}

export function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "en" || saved === "fr") return saved;
  if (navigator.language?.toLowerCase().startsWith("fr")) return "fr";
  return "en";
}
