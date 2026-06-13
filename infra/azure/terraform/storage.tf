# ─────────────────────────────────────────────────────────────────────────────
# Storage account + Azure Files shares.
#
# Replaces both the EFS filesystem (runtime mounts) and the S3 asset bucket
# (CI uploads straight into the shares with `az storage file upload-batch`,
# so no asset-sync task is needed).
# ─────────────────────────────────────────────────────────────────────────────

resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.project_name, "-", "")}${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
  tags                     = var.tags
}

locals {
  # share key → { quota (GiB), access mode for the ACA storage link }
  file_shares = {
    artefacts       = { quota = 50, access_mode = "ReadWrite" } # model artefacts (training writes, inference/monitoring read)
    moe-data        = { quota = 10, access_mode = "ReadOnly" }  # cleaned CSVs, uploaded by CI
    prediction-logs = { quota = 10, access_mode = "ReadWrite" } # moe-inference writes, moe-monitoring reads
    mlruns          = { quota = 50, access_mode = "ReadWrite" } # MLflow artifact store
    minio-data      = { quota = 50, access_mode = "ReadWrite" } # MinIO object data (uploads/exports buckets)
  }
}

resource "azurerm_storage_share" "shares" {
  for_each = local.file_shares

  name               = each.key
  storage_account_id = azurerm_storage_account.main.id
  quota              = each.value.quota
}

# Make each share mountable from container apps in the environment.
resource "azurerm_container_app_environment_storage" "shares" {
  for_each = local.file_shares

  name                         = each.key
  container_app_environment_id = azurerm_container_app_environment.main.id
  account_name                 = azurerm_storage_account.main.name
  share_name                   = azurerm_storage_share.shares[each.key].name
  access_key                   = azurerm_storage_account.main.primary_access_key
  access_mode                  = each.value.access_mode
}
