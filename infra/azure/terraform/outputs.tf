output "api_base_url" {
  description = "Public HTTPS endpoint of the api-gateway — set NEXT_PUBLIC_API_URL in Vercel to this."
  value       = "https://${azurerm_container_app.apps["api-gateway"].ingress[0].fqdn}"
}

output "resource_group_name" {
  value = azurerm_resource_group.main.name
}

output "container_app_environment_name" {
  value = azurerm_container_app_environment.main.name
}

output "storage_account_name" {
  description = "Storage account holding the Azure Files shares (artefacts, moe-data, …)."
  value       = azurerm_storage_account.main.name
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}
