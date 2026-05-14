# AWS ECS-on-EC2 Demo Deployment

This folder deploys the backend/MLOps stack to **ECS on EC2 capacity**, while the Next.js frontend stays on Vercel.

The stack is intentionally EC2-backed, not Fargate-backed, because the project needs TensorFlow/XGBoost containers and the user is working inside a free-trial/minimal-cost constraint.

## What Gets Created

- VPC with public ECS subnets and private RDS/EFS subnets.
- ECS cluster with an EC2 Auto Scaling Group and managed capacity provider.
- Public ALB that exposes only `api-gateway`.
- One RDS PostgreSQL instance.
- One EFS filesystem for model artefacts, data, logs, MinIO, MLflow, Prometheus, and Grafana persistence.
- ECS services for the backend services, ML services, Redis, MinIO, MLflow, Prometheus, Grafana, and Pushgateway.
- One-off ECS task definitions for database initialization and EFS asset sync.

## Before Applying

1. Build and push the backend images with the existing GitHub Actions CD workflow.
2. Deploy `dashboard/frontend` to Vercel.
3. Copy the example vars:

```bash
cd infra/aws/terraform
cp terraform.tfvars.example terraform.tfvars
```

Edit:

- `github_owner`
- `image_tag`
- `frontend_origin`
- optionally `acm_certificate_arn`

If GHCR packages are private, create a Secrets Manager secret first:

```bash
aws secretsmanager create-secret \
  --name verado-demo/ghcr \
  --secret-string '{"username":"YOUR_GITHUB_USER","password":"YOUR_GITHUB_PAT_WITH_READ_PACKAGES"}'
```

Then set `ghcr_credentials_secret_arn` in `terraform.tfvars`.

If `terraform apply` fails with `AccessDenied` for IAM, Secrets Manager, Service Discovery, or EFS, see [IAM_PERMISSIONS.md](IAM_PERMISSIONS.md).

## Deploy

```bash
terraform init
terraform apply
```

After apply, initialize the extra PostgreSQL databases:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
CAPACITY_PROVIDER=$(terraform output -raw ecs_capacity_provider_name)
TASK=$(terraform output -raw db_init_task_definition)

aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK" \
  --capacity-provider-strategy capacityProvider="$CAPACITY_PROVIDER",weight=1 \
  --count 1
```

Upload data and model assets to the generated S3 bucket:

```bash
BUCKET=$(terraform output -raw asset_bucket)
aws s3 sync ../../../MoE/Artifacts "s3://$BUCKET/artefacts/production/"
aws s3 cp ../../../MoE/Global_CLEANED.csv "s3://$BUCKET/data/Global_CLEANED.csv"
aws s3 cp ../../../MoE/AIoT_6G_CLEANED.csv "s3://$BUCKET/data/AIoT_6G_CLEANED.csv"
```

Then sync them into EFS:

```bash
aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$(terraform output -raw asset_sync_task_definition)" \
  --capacity-provider-strategy capacityProvider="$CAPACITY_PROVIDER",weight=1 \
  --count 1
```

If the copied `MoE/Artifacts` folder does not contain every artefact required by `moe-ids/moe_ids/artefacts.py`, run training once to populate `/app/artefacts/production`.

## Vercel Env

Set this in Vercel:

```bash
NEXT_PUBLIC_API_URL=$(terraform output -raw api_base_url)
```

Redeploy the frontend after setting the variable.

## Demo Operations

Scale down outside demo hours. Scale ECS services down first; if services stay at desired count `1`, ECS managed scaling can launch EC2 capacity again.

```bash
../scripts/scale-demo.sh down
```

Scale up before the demo:

```bash
../scripts/scale-demo.sh up
```

Scale up the MLOps screens too:

```bash
../scripts/scale-demo.sh full
```

Temporarily enable training:

```bash
CLUSTER=$(terraform output -raw ecs_cluster_name)
aws ecs update-service --cluster "$CLUSTER" --service mlflow --desired-count 1
aws ecs update-service --cluster "$CLUSTER" --service pushgateway --desired-count 1

aws ecs update-service \
  --cluster "$CLUSTER" \
  --service moe-training-svc \
  --desired-count 1
```

Then trigger training from the frontend or gateway and scale it back to `0`.

## Smoke Test

```bash
API=$(terraform output -raw api_base_url)
curl -fsS "$API/health"
```

Then verify from Vercel:

- Login with `admin@esprit.tn / Admin123!`
- Upload `moe-ids/tests/fixtures/sample_5g_10rows.csv`
- Check `/history`, `/drift`, and `/model`
