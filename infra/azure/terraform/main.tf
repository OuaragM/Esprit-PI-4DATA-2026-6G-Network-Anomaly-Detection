# ─────────────────────────────────────────────────────────────────────────────
# Resource group, Log Analytics, Container Apps environment.
#
# Azure analog of the AWS ECS-on-EC2 stack in ../../aws/terraform:
#   ECS cluster + ALB        → Container Apps environment + built-in ingress
#   RDS PostgreSQL           → PostgreSQL Flexible Server (database.tf)
#   EFS + S3 asset bucket    → Storage account with Azure Files shares (storage.tf)
#   ECS services             → Container apps (containerapps.tf)
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_resource_group" "main" {
  name     = "${var.project_name}-rg"
  location = var.location
  tags     = var.tags
}

# Suffix for globally-unique names (storage account, postgres server).
resource "random_string" "suffix" {
  length  = 6
  lower   = true
  upper   = false
  numeric = true
  special = false
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${var.project_name}-logs"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "${var.project_name}-env"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  tags                       = var.tags
}

locals {
  ghcr_owner = lower(var.github_owner)
  ghcr       = "ghcr.io/${lower(var.github_owner)}"

  # Set ghcr_pat only when the GitHub packages are private. The comparison
  # inherits the variable's sensitivity, which would poison dynamic-block
  # for_each expressions — only the boolean is unwrapped, never the PAT.
  use_ghcr_auth = nonsensitive(var.ghcr_pat != "")
}
