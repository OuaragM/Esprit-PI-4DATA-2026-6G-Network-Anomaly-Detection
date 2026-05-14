#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-}"
TERRAFORM_DIR="${TERRAFORM_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../terraform" && pwd)}"
CORE_CAPACITY="${CORE_CAPACITY:-2}"
FULL_CAPACITY="${FULL_CAPACITY:-3}"

if [[ "$MODE" != "up" && "$MODE" != "down" && "$MODE" != "full" ]]; then
  echo "usage: $0 up|full|down"
  echo "  up   = core demo services only"
  echo "  full = core + MLflow/Prometheus/Grafana/Pushgateway/training"
  echo "  down = all ECS services and EC2 capacity to zero"
  exit 2
fi

cd "$TERRAFORM_DIR"
CLUSTER="$(terraform output -raw ecs_cluster_name)"
ASG="$(terraform output -raw ecs_autoscaling_group_name)"

CORE_SERVICES=(
  api-gateway
  auth-svc
  upload-svc
  inference-svc
  report-svc
  moe-inference-svc
  moe-monitoring-svc
  redis
  minio
)

ON_DEMAND_SERVICES=(
  moe-training-svc
  mlflow
  prometheus
  grafana
  pushgateway
)

scale_service() {
  local service="$1"
  local count="$2"
  aws ecs update-service \
    --cluster "$CLUSTER" \
    --service "$service" \
    --desired-count "$count" >/dev/null
}

if [[ "$MODE" == "down" ]]; then
  for service in "${CORE_SERVICES[@]}" "${ON_DEMAND_SERVICES[@]}" moe-training-svc; do
    scale_service "$service" 0 || true
  done
  aws autoscaling update-auto-scaling-group \
    --auto-scaling-group-name "$ASG" \
    --min-size 0 \
    --desired-capacity 0
  echo "Scaled ECS services and EC2 capacity down."
  exit 0
fi

aws autoscaling update-auto-scaling-group \
  --auto-scaling-group-name "$ASG" \
  --min-size 1 \
  --desired-capacity "$([[ "$MODE" == "full" ]] && echo "$FULL_CAPACITY" || echo "$CORE_CAPACITY")"

for service in "${CORE_SERVICES[@]}"; do
  scale_service "$service" 1
done

if [[ "$MODE" == "full" ]]; then
  for service in "${ON_DEMAND_SERVICES[@]}"; do
    scale_service "$service" 1
  done
fi

echo "Scaled demo stack $MODE."
