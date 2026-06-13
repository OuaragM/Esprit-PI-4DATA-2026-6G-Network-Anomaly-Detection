# ─────────────────────────────────────────────────────────────────────────────
# Container apps — one entry per docker-compose service.
#
# Service discovery: apps in the same environment resolve each other by app
# name. HTTP apps are reached through the internal ingress on port 80
# (http://<app-name>), TCP apps (redis, minio) on their exposed port.
#
# Dropped vs docker-compose.yml: frontend-svc (Vercel), node-exporter and
# cadvisor (no host access on Container Apps — platform metrics come from
# Azure Monitor / Log Analytics instead).
# ─────────────────────────────────────────────────────────────────────────────

locals {
  # Shared secret bundles, referenced by the per-app `secrets` maps below.
  secret_jwt        = { "jwt-secret" = var.jwt_secret }
  secret_apikey     = { "internal-api-key" = var.internal_api_key }
  secret_dash_db    = { "dashboard-db-url" = local.dashboard_db_url }
  secret_minio      = { "minio-secret-key" = var.minio_secret_key }
  secret_monitor_db = { "monitoring-db-url" = local.monitoring_db_url }

  apps = {

    # ── EDGE — the only externally reachable app ──────────────────────────
    api-gateway = {
      image        = "${local.ghcr}/dashboard-gateway:${var.image_tag}"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 2
      command      = null
      args         = null
      ingress      = { external = true, target_port = 8090, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        AUTH_SERVICE_URL       = "http://auth-svc"
        UPLOAD_SERVICE_URL     = "http://upload-svc"
        INFERENCE_SERVICE_URL  = "http://inference-svc"
        TRAINING_SERVICE_URL   = "http://moe-training-svc"
        MONITORING_SERVICE_URL = "http://moe-monitoring-svc"
        REPORT_SERVICE_URL     = "http://report-svc"
        MLFLOW_URL             = "http://mlflow"
        GRAFANA_URL            = "http://grafana"
        FRONTEND_ORIGIN        = var.frontend_origin
      }
      secret_env = { JWT_SECRET = "jwt-secret", INTERNAL_API_KEY = "internal-api-key" }
      secrets    = merge(local.secret_jwt, local.secret_apikey)
    }

    # ── IDENTITY & BUSINESS SERVICES ──────────────────────────────────────
    auth-svc = {
      image        = "${local.ghcr}/dashboard-auth:${var.image_tag}"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8001, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        JWT_EXPIRY_MINUTES = "60"
        SMTP_HOST          = var.smtp_host
        SMTP_PORT          = var.smtp_port
        SMTP_USER          = var.smtp_user
        SMTP_FROM          = var.smtp_from
        SMTP_TLS           = "true"
        APP_LOGIN_URL      = var.app_login_url
      }
      secret_env = {
        DATABASE_URL  = "dashboard-db-url"
        JWT_SECRET    = "jwt-secret"
        SMTP_PASSWORD = "smtp-password"
      }
      secrets = merge(local.secret_jwt, local.secret_dash_db, {
        # ACA secrets cannot be empty — fall back to a placeholder when SMTP
        # is not configured (auth-svc then simply fails to send emails).
        "smtp-password" = coalesce(var.smtp_password, "unset")
      })
    }

    upload-svc = {
      image        = "${local.ghcr}/dashboard-upload:${var.image_tag}"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8002, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        REDIS_URL             = "redis://redis:6379/0"
        MINIO_ENDPOINT        = "minio:9000"
        MINIO_ACCESS_KEY      = var.minio_access_key
        MINIO_BUCKET_UPLOADS  = "uploads"
        INFERENCE_SERVICE_URL = "http://inference-svc"
      }
      secret_env = { DATABASE_URL = "dashboard-db-url", MINIO_SECRET_KEY = "minio-secret-key" }
      secrets    = merge(local.secret_dash_db, local.secret_minio)
    }

    celery-worker = {
      image        = "${local.ghcr}/dashboard-upload:${var.image_tag}"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = ["celery", "-A", "app.tasks.celery_app", "worker", "--loglevel=info", "--concurrency=2"]
      args         = null
      ingress      = null
      volumes      = []
      env = {
        REDIS_URL             = "redis://redis:6379/0"
        MINIO_ENDPOINT        = "minio:9000"
        MINIO_ACCESS_KEY      = var.minio_access_key
        INFERENCE_SERVICE_URL = "http://inference-svc"
        REPORT_SERVICE_URL    = "http://report-svc"
      }
      secret_env = { DATABASE_URL = "dashboard-db-url", MINIO_SECRET_KEY = "minio-secret-key" }
      secrets    = merge(local.secret_dash_db, local.secret_minio)
    }

    inference-svc = {
      image        = "${local.ghcr}/dashboard-inference:${var.image_tag}"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8003, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        MLOPS_BASE_URL = "http://moe-inference-svc"
        MLOPS_TIMEOUT  = "60"
      }
      secret_env = { MLOPS_API_KEY = "internal-api-key" }
      secrets    = local.secret_apikey
    }

    report-svc = {
      image        = "${local.ghcr}/dashboard-report:${var.image_tag}"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8004, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        MINIO_ENDPOINT       = "minio:9000"
        MINIO_ACCESS_KEY     = var.minio_access_key
        MINIO_BUCKET_EXPORTS = "exports"
      }
      secret_env = { DATABASE_URL = "dashboard-db-url", MINIO_SECRET_KEY = "minio-secret-key" }
      secrets    = merge(local.secret_dash_db, local.secret_minio)
    }

    # ── ML MICROSERVICES ──────────────────────────────────────────────────
    moe-inference-svc = {
      image        = "${local.ghcr}/moe-inference:${var.image_tag}"
      cpu          = 1.0
      memory       = "2Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8000, transport = "auto", exposed_port = null }
      volumes = [
        { share = "artefacts", path = "/app/artefacts" },
        { share = "moe-data", path = "/app/data" },
        { share = "prediction-logs", path = "/app/logs" },
      ]
      env = {
        ARTEFACTS_DIR       = "/app/artefacts/production"
        WEBAPP_ORIGIN       = var.frontend_origin
        LOG_DIR             = "/app/logs/predictions"
        MLFLOW_TRACKING_URI = "http://mlflow"
        DATA_5G_PATH        = "/app/data/Global_CLEANED.csv"
        DATA_6G_PATH        = "/app/data/AIoT_6G_CLEANED.csv"
      }
      secret_env = { API_KEY = "internal-api-key", MONITORING_DB_URL = "monitoring-db-url" }
      secrets    = merge(local.secret_apikey, local.secret_monitor_db)
    }

    # Scales to zero when idle; the gateway's first training request wakes it.
    # Intentionally NOT scraped by Prometheus (a 15s scrape would keep it awake).
    moe-training-svc = {
      image        = "${local.ghcr}/moe-training:${var.image_tag}"
      cpu          = 2.0
      memory       = "4Gi"
      min_replicas = 0
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8010, transport = "auto", exposed_port = null }
      volumes = [
        { share = "artefacts", path = "/app/artefacts" },
        { share = "moe-data", path = "/app/data" },
      ]
      env = {
        ARTEFACTS_DIR       = "/app/artefacts/production"
        INFERENCE_BASE_URL  = "http://moe-inference-svc"
        MLFLOW_TRACKING_URI = "http://mlflow"
        PUSHGATEWAY_URL     = "http://pushgateway"
        DATA_5G_PATH        = "/app/data/Global_CLEANED.csv"
        DATA_6G_PATH        = "/app/data/AIoT_6G_CLEANED.csv"
      }
      secret_env = { API_KEY = "internal-api-key" }
      secrets    = local.secret_apikey
    }

    moe-monitoring-svc = {
      image        = "${local.ghcr}/moe-monitoring:${var.image_tag}"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 8011, transport = "auto", exposed_port = null }
      volumes = [
        { share = "artefacts", path = "/app/artefacts" },
        { share = "prediction-logs", path = "/app/logs" },
      ]
      env = {
        ARTEFACTS_DIR     = "/app/artefacts/production"
        LOG_DIR           = "/app/logs/predictions"
        SLACK_WEBHOOK_URL = var.slack_webhook_url
      }
      secret_env = { API_KEY = "internal-api-key", MONITORING_DB_URL = "monitoring-db-url" }
      secrets    = merge(local.secret_apikey, local.secret_monitor_db)
    }

    # ── DATA PLANE (postgres → Flexible Server, see database.tf) ──────────
    redis = {
      image        = "redis:7-alpine"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 6379, transport = "tcp", exposed_port = 6379 }
      volumes      = []
      env          = {}
      secret_env   = {}
      secrets      = {}
    }

    # TCP ingress keeps MINIO_ENDPOINT=minio:9000 identical to compose.
    # Console (:9001) is not exposed — use `az storage` / the app instead.
    minio = {
      image        = "minio/minio:latest"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = ["server", "/data"]
      ingress      = { external = false, target_port = 9000, transport = "tcp", exposed_port = 9000 }
      volumes      = [{ share = "minio-data", path = "/data" }]
      env          = { MINIO_ROOT_USER = var.minio_access_key }
      secret_env   = { MINIO_ROOT_PASSWORD = "minio-secret-key" }
      secrets      = local.secret_minio
    }

    # ── MLOPS / OBSERVABILITY ─────────────────────────────────────────────
    mlflow = {
      image        = "ghcr.io/mlflow/mlflow:v2.21.3"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command = [
        "sh", "-c",
        "pip install psycopg2-binary -q && mlflow server --backend-store-uri \"$MLFLOW_BACKEND_STORE_URI\" --artifacts-destination /mlruns_artifacts --host 0.0.0.0 --port 5000"
      ]
      args       = null
      ingress    = { external = false, target_port = 5000, transport = "auto", exposed_port = null }
      volumes    = [{ share = "mlruns", path = "/mlruns_artifacts" }]
      env        = {}
      secret_env = { MLFLOW_BACKEND_STORE_URI = "mlflow-db-url" }
      secrets    = { "mlflow-db-url" = local.mlflow_db_url }
    }

    # Config baked into the image (moe-ids/monitoring/Dockerfile.prometheus).
    # TSDB is ephemeral — Azure Files (SMB) breaks Prometheus mmap, and losing
    # metrics history on restart is acceptable for the demo.
    prometheus = {
      image        = "${local.ghcr}/moe-prometheus:${var.image_tag}"
      cpu          = 0.5
      memory       = "1Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 9090, transport = "auto", exposed_port = null }
      volumes      = []
      env          = {}
      secret_env   = {}
      secrets      = {}
    }

    # Dashboards/datasources baked into the image (Dockerfile.grafana).
    grafana = {
      image        = "${local.ghcr}/moe-grafana:${var.image_tag}"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 3000, transport = "auto", exposed_port = null }
      volumes      = []
      env = {
        GF_USERS_ALLOW_SIGN_UP    = "false"
        GF_AUTH_ANONYMOUS_ENABLED = "false"
      }
      secret_env = { GF_SECURITY_ADMIN_PASSWORD = "grafana-password" }
      secrets    = { "grafana-password" = var.grafana_admin_password }
    }

    pushgateway = {
      image        = "prom/pushgateway:v1.7.0"
      cpu          = 0.25
      memory       = "0.5Gi"
      min_replicas = 1
      max_replicas = 1
      command      = null
      args         = null
      ingress      = { external = false, target_port = 9091, transport = "auto", exposed_port = null }
      volumes      = []
      env          = {}
      secret_env   = {}
      secrets      = {}
    }
  }
}

resource "azurerm_container_app" "apps" {
  for_each = local.apps

  name                         = each.key
  container_app_environment_id = azurerm_container_app_environment.main.id
  resource_group_name          = azurerm_resource_group.main.name
  revision_mode                = "Single"
  tags                         = var.tags

  template {
    min_replicas = each.value.min_replicas
    max_replicas = each.value.max_replicas

    container {
      name    = each.key
      image   = each.value.image
      cpu     = each.value.cpu
      memory  = each.value.memory
      command = each.value.command
      args    = each.value.args

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = each.value.secret_env
        content {
          name        = env.key
          secret_name = env.value
        }
      }

      dynamic "volume_mounts" {
        for_each = each.value.volumes
        content {
          name = volume_mounts.value.share
          path = volume_mounts.value.path
        }
      }
    }

    dynamic "volume" {
      for_each = each.value.volumes
      content {
        name         = volume.value.share
        storage_name = azurerm_container_app_environment_storage.shares[volume.value.share].name
        storage_type = "AzureFile"
      }
    }
  }

  dynamic "ingress" {
    for_each = each.value.ingress == null ? [] : [each.value.ingress]
    content {
      external_enabled = ingress.value.external
      target_port      = ingress.value.target_port
      transport        = ingress.value.transport
      exposed_port     = ingress.value.exposed_port

      traffic_weight {
        latest_revision = true
        percentage      = 100
      }
    }
  }

  dynamic "secret" {
    for_each = local.use_ghcr_auth ? merge(each.value.secrets, { "ghcr-pat" = var.ghcr_pat }) : each.value.secrets
    content {
      name  = secret.key
      value = secret.value
    }
  }

  dynamic "registry" {
    for_each = local.use_ghcr_auth ? toset(["ghcr"]) : toset([])
    content {
      server               = "ghcr.io"
      username             = var.ghcr_username != "" ? var.ghcr_username : var.github_owner
      password_secret_name = "ghcr-pat"
    }
  }

  depends_on = [
    azurerm_postgresql_flexible_server_database.dbs,
    azurerm_postgresql_flexible_server_configuration.no_forced_tls,
  ]
}
