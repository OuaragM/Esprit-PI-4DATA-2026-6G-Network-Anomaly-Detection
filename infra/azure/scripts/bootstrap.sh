#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# One-time bootstrap for the Azure Container Apps deployment.
#
# Creates everything Terraform itself cannot create (chicken-and-egg):
#   1. Resource group + storage account + container for Terraform remote state
#   2. An Entra ID app registration with a GitHub OIDC federated credential,
#      so the CD workflow logs in without long-lived secrets
#   3. Role assignments: Contributor on the subscription (Terraform) and
#      Storage Blob Data Contributor on the state account (azurerm backend)
#   4. Registers the resource providers the stack needs
#
# Prereqs: az CLI, logged in (az login) on the target subscription.
#
# Usage:
#   ./bootstrap.sh <github-owner>/<repo> [location] [state-rg] [state-sa]
# Example:
#   ./bootstrap.sh myuser/Esprit-PI-4DATA-2026-6G-Network-Anomaly-Detection francecentral
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

GITHUB_REPO="${1:?usage: bootstrap.sh <github-owner>/<repo> [location] [state-rg] [state-sa]}"
LOCATION="${2:-francecentral}"
STATE_RG="${3:-verado-tfstate-rg}"
# Storage account names: 3-24 chars, lowercase alphanumeric, globally unique.
STATE_SA="${4:-veradotfstate$RANDOM}"
APP_NAME="verado-cd-github"

SUBSCRIPTION_ID="$(az account show --query id -o tsv)"
TENANT_ID="$(az account show --query tenantId -o tsv)"

echo "▸ Subscription: $SUBSCRIPTION_ID"
echo "▸ Repo:         $GITHUB_REPO"
echo "▸ Location:     $LOCATION"

echo "▸ Registering resource providers (idempotent, may take a minute)…"
for ns in Microsoft.App Microsoft.ContainerService Microsoft.OperationalInsights \
          Microsoft.DBforPostgreSQL Microsoft.Storage; do
  az provider register --namespace "$ns" --wait
done

echo "▸ Creating Terraform state storage: $STATE_RG / $STATE_SA …"
az group create --name "$STATE_RG" --location "$LOCATION" --output none
az storage account create \
  --name "$STATE_SA" --resource-group "$STATE_RG" --location "$LOCATION" \
  --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --output none
az storage container create \
  --name tfstate --account-name "$STATE_SA" --auth-mode login --output none

echo "▸ Creating Entra app registration: $APP_NAME …"
APP_ID="$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv)"
if [ -z "$APP_ID" ] || [ "$APP_ID" = "None" ]; then
  APP_ID="$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)"
fi
az ad sp show --id "$APP_ID" --output none 2>/dev/null || az ad sp create --id "$APP_ID" --output none

echo "▸ Adding GitHub OIDC federated credential (main branch)…"
cat > /tmp/federated-credential.json <<EOF
{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:${GITHUB_REPO}:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}
EOF
az ad app federated-credential create --id "$APP_ID" \
  --parameters /tmp/federated-credential.json --output none 2>/dev/null \
  || echo "  (federated credential already exists — skipping)"
rm -f /tmp/federated-credential.json

echo "▸ Assigning roles…"
az role assignment create --assignee "$APP_ID" \
  --role "Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}" --output none
az role assignment create --assignee "$APP_ID" \
  --role "Storage Blob Data Contributor" \
  --scope "/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${STATE_RG}/providers/Microsoft.Storage/storageAccounts/${STATE_SA}" \
  --output none

echo ""
echo "✓ Bootstrap complete. Add these GitHub repository secrets:"
echo "  (Settings → Secrets and variables → Actions → New repository secret)"
echo ""
echo "  AZURE_CLIENT_ID          $APP_ID"
echo "  AZURE_TENANT_ID          $TENANT_ID"
echo "  AZURE_SUBSCRIPTION_ID    $SUBSCRIPTION_ID"
echo "  AZURE_TFSTATE_RG         $STATE_RG"
echo "  AZURE_TFSTATE_SA         $STATE_SA"
echo "  POSTGRES_ADMIN_PASSWORD  <pick one — letters/digits only>"
echo ""
echo "  Recommended: JWT_SECRET, INTERNAL_API_KEY, MINIO_SECRET_KEY, GRAFANA_PASSWORD"
echo "  Optional:    GHCR_PAT (private packages), VERCEL_FRONTEND_ORIGIN, SMTP_USER/PASSWORD/FROM"
echo ""
echo "Then run the CD workflow with deploy_target=azure."
