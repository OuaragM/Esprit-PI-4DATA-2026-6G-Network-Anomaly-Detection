# Azure Container Apps Deployment

Deploys the backend + ML stack to **Azure Container Apps (ACA)** while the Next.js frontend stays on Vercel. This is the Azure counterpart of [`infra/aws`](../aws/README.md), sized for an **Azure for Students ($100 credit)** subscription.

## Architecture

| docker-compose service | Azure resource |
|---|---|
| api-gateway | Container App — the **only** externally reachable app (HTTPS, free TLS at `*.azurecontainerapps.io`) |
| auth / upload / celery-worker / inference / report | Container Apps, internal ingress |
| moe-inference / moe-training / moe-monitoring | Container Apps; **training scales to zero** when idle |
| postgres + mlflow_db + monitoring_db | One **PostgreSQL Flexible Server** (B1ms, ~$13/mo) with databases `dashboard`, `mlflow`, `moe_monitoring` |
| redis | Container App (`redis:7-alpine`) with internal TCP ingress :6379 |
| minio | Container App with internal TCP ingress :9000 + Azure Files volume (kept because Azure has no S3-compatible API; console :9001 not exposed) |
| EFS volumes / S3 bucket | **Azure Files shares**: `artefacts`, `moe-data`, `prediction-logs`, `mlruns`, `minio-data` |
| mlflow / prometheus / grafana / pushgateway | Container Apps; Prometheus & Grafana use config **baked into images** (`moe-ids/monitoring/Dockerfile.prometheus|grafana`) since ACA cannot bind-mount repo files |
| node-exporter / cadvisor | **Dropped** — no host access on ACA; platform metrics live in Azure Monitor / Log Analytics |

Service discovery: apps resolve each other **by app name** inside the environment. HTTP services go through the internal ingress on port 80 (`http://auth-svc`), so service-URL env vars carry no port. Redis/MinIO use TCP ingress and keep their compose addresses (`redis:6379`, `minio:9000`).

Estimated cost: ~$20–40/month (Flexible Server ~$13 + ACA consumption mostly inside the monthly free grant + storage/logs).

## One-time setup

1. **Bootstrap** (creates Terraform state storage + GitHub OIDC identity):

   ```bash
   az login
   cd infra/azure/scripts
   ./bootstrap.sh <github-owner>/<repo> francecentral
   ```

2. **Add the GitHub secrets** the script prints:

   | Secret | Required | Purpose |
   |---|---|---|
   | `AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID` | yes | OIDC login (no stored credentials) |
   | `AZURE_TFSTATE_RG` / `AZURE_TFSTATE_SA` | yes | Terraform remote state |
   | `POSTGRES_ADMIN_PASSWORD` | yes | Flexible Server admin (letters/digits only) |
   | `JWT_SECRET`, `INTERNAL_API_KEY`, `MINIO_SECRET_KEY`, `GRAFANA_PASSWORD` | recommended | fall back to compose demo defaults if unset |
   | `GHCR_PAT` | if ghcr packages are private | `read:packages` PAT for image pulls |
   | `VERCEL_FRONTEND_ORIGIN` | recommended | CORS origin, e.g. `https://your-app.vercel.app` |
   | `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | optional | auth-svc password-reset emails |

## Deploy

Run the **CD** workflow (Actions → CD → Run workflow) with:

- `deploy_target` = `azure`
- `azure_region` = `francecentral` (or your region)
- `frontend_origin` = your Vercel URL (or leave `*` for an open demo)

The workflow builds + pushes images, trains and logs to MLflow, applies `infra/azure/terraform`, uploads the trained artefacts and cleaned CSVs to the Azure Files shares, restarts `moe-inference-svc`, and health-checks the gateway.

To run Terraform locally instead:

```bash
cd infra/azure/terraform
cp terraform.tfvars.example terraform.tfvars   # edit it
terraform init \
  -backend-config="resource_group_name=<AZURE_TFSTATE_RG>" \
  -backend-config="storage_account_name=<AZURE_TFSTATE_SA>" \
  -backend-config="container_name=tfstate" \
  -backend-config="key=azure.terraform.tfstate" \
  -backend-config="use_azuread_auth=true"
terraform apply
```

## Vercel cutover

```bash
# from infra/azure/terraform
terraform output -raw api_base_url
```

In Vercel: set `NEXT_PUBLIC_API_URL` to that URL, redeploy the frontend, and make sure `frontend_origin` (workflow input or `VERCEL_FRONTEND_ORIGIN` secret) matches the Vercel domain so CORS passes.

## Smoke test

```bash
curl -fsS "$(terraform output -raw api_base_url)/health"
```

From the Vercel app:

- Login with `admin@esprit.tn / Admin123!`
- Upload `moe-ids/tests/fixtures/sample_5g_10rows.csv`
- Check `/history`, `/drift`, and `/model`

Logs: `az containerapp logs show -g verado-demo-rg -n moe-inference-svc --follow`

## Cost control (student credit)

```bash
RG=verado-demo-rg
# Sleep the MLOps screens outside demo hours
for app in mlflow prometheus grafana pushgateway moe-monitoring-svc; do
  az containerapp update -g $RG -n $app --min-replicas 0 --max-replicas 1
done
# Wake them before the demo
for app in mlflow prometheus grafana pushgateway moe-monitoring-svc; do
  az containerapp update -g $RG -n $app --min-replicas 1
done
```

`moe-training-svc` already idles at zero and wakes on the first training request from the dashboard. The PostgreSQL Flexible Server can be stopped entirely between demos: `az postgres flexible-server stop -g $RG -n <server-name>` (it auto-restarts after 7 days).

## Known trade-offs (demo scope)

- **TLS to PostgreSQL is not enforced** (`require_secure_transport=OFF`) because the services build plain compose-style connection URLs. Traffic stays on the Azure backbone; re-enable + add `ssl` URL params for production.
- **MinIO on Azure Files (SMB)** is not a POSIX filesystem — fine for light demo traffic, not production-grade. Fallback: swap MinIO SDK calls for Azure Blob Storage.
- **Prometheus/Grafana storage is ephemeral** — metric history resets when those apps restart (dashboards are baked into the Grafana image, so they always come back).
- **Region quotas**: if `B_Standard_B1ms` is rejected in `francecentral`, retry with `azure_region=westeurope` or `swedencentral`.
