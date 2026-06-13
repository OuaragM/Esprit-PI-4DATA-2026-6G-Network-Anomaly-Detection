# ─────────────────────────────────────────────────────────────────────────────
# One PostgreSQL Flexible Server replaces the three compose Postgres
# containers (postgres / mlflow_db / monitoring_db) as three databases.
#
# All services connect with the admin user — the per-service users the AWS
# db-init task created are intentionally dropped (demo scope).
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_postgresql_flexible_server" "main" {
  name                = "${var.project_name}-pg-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  version                       = "16"
  sku_name                      = var.postgres_sku_name
  storage_mb                    = 32768
  administrator_login           = var.postgres_admin_login
  administrator_password        = var.postgres_admin_password
  public_network_access_enabled = true
  tags                          = var.tags

  lifecycle {
    ignore_changes = [zone] # Azure may move the server between zones
  }
}

resource "azurerm_postgresql_flexible_server_database" "dbs" {
  for_each = toset(["dashboard", "mlflow", "moe_monitoring"])

  name      = each.key
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Container Apps reach the server over its public endpoint from Azure IPs.
# 0.0.0.0 - 0.0.0.0 is Azure's "allow Azure services" sentinel range.
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "allow-azure-services"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# The services build their connection URLs from compose-style env vars without
# TLS query params (asyncpg/psycopg2 defaults differ), so don't force TLS.
# Demo-scope trade-off — documented in ../README.md.
resource "azurerm_postgresql_flexible_server_configuration" "no_forced_tls" {
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "OFF"
}

locals {
  pg_host = azurerm_postgresql_flexible_server.main.fqdn
  pg_auth = "${var.postgres_admin_login}:${var.postgres_admin_password}"

  dashboard_db_url  = "postgresql+asyncpg://${local.pg_auth}@${local.pg_host}:5432/dashboard"
  mlflow_db_url     = "postgresql://${local.pg_auth}@${local.pg_host}:5432/mlflow"
  monitoring_db_url = "postgresql://${local.pg_auth}@${local.pg_host}:5432/moe_monitoring"
}
