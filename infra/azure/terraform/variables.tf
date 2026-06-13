variable "project_name" {
  description = "Prefix for every Azure resource name."
  type        = string
  default     = "verado-demo"
}

variable "location" {
  description = "Azure region. Student subscriptions: if B1ms is rejected here, try westeurope or swedencentral."
  type        = string
  default     = "francecentral"
}

variable "github_owner" {
  description = "GitHub owner whose ghcr.io packages hold the images (lowercased automatically)."
  type        = string
}

variable "image_tag" {
  description = "Image tag published by the CD workflow (git SHA or 'latest')."
  type        = string
  default     = "latest"
}

variable "frontend_origin" {
  description = "Vercel frontend origin for CORS, e.g. https://your-app.vercel.app. '*' for an open demo."
  type        = string
  default     = "*"
}

# ── ghcr.io pull credentials (only needed when packages are private) ─────────
variable "ghcr_username" {
  description = "GitHub username for ghcr.io pulls. Leave empty for public packages."
  type        = string
  default     = ""
}

variable "ghcr_pat" {
  description = "GitHub PAT with read:packages for ghcr.io pulls. Leave empty for public packages."
  type        = string
  default     = ""
  sensitive   = true
}

# ── PostgreSQL Flexible Server ────────────────────────────────────────────────
variable "postgres_admin_login" {
  description = "Admin login for the PostgreSQL Flexible Server."
  type        = string
  default     = "idsadmin"
}

variable "postgres_admin_password" {
  description = "Admin password. Use only URL-safe characters (letters, digits) — it is embedded in connection-string env vars."
  type        = string
  sensitive   = true
}

variable "postgres_sku_name" {
  description = "Flexible Server SKU. B_Standard_B1ms is the cheapest burstable tier."
  type        = string
  default     = "B_Standard_B1ms"
}

# ── Application secrets (defaults mirror docker-compose.yml demo values) ─────
variable "jwt_secret" {
  type      = string
  default   = "supersecretkey"
  sensitive = true
}

variable "internal_api_key" {
  type      = string
  default   = "changeme"
  sensitive = true
}

variable "minio_access_key" {
  type    = string
  default = "minioadmin"
}

variable "minio_secret_key" {
  type      = string
  default   = "minioadmin123"
  sensitive = true
}

variable "grafana_admin_password" {
  type      = string
  default   = "admin"
  sensitive = true
}

variable "slack_webhook_url" {
  type      = string
  default   = ""
  sensitive = true
}

# ── SMTP (optional — password-reset emails from auth-svc) ─────────────────────
variable "smtp_host" {
  type    = string
  default = "smtp.gmail.com"
}

variable "smtp_port" {
  type    = string
  default = "587"
}

variable "smtp_user" {
  type    = string
  default = ""
}

variable "smtp_password" {
  type      = string
  default   = ""
  sensitive = true
}

variable "smtp_from" {
  type    = string
  default = ""
}

variable "app_login_url" {
  description = "Login URL embedded in auth emails — the Vercel frontend /login page."
  type        = string
  default     = "http://localhost:3000/login"
}

variable "tags" {
  type = map(string)
  default = {
    project = "6g-anomaly-detection"
    managed = "terraform"
  }
}
