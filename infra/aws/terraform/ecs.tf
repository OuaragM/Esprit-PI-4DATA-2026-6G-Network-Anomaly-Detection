locals {
  db_init_command = <<-EOT
    set -e
    until pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER"; do sleep 2; done
    psql -d dashboard -tAc "SELECT 1 FROM pg_database WHERE datname='mlflow'" | grep -q 1 || createdb mlflow
    psql -d dashboard -tAc "SELECT 1 FROM pg_database WHERE datname='moe_monitoring'" | grep -q 1 || createdb moe_monitoring
  EOT

  asset_sync_command = <<-EOT
    set -e
    mkdir -p /mnt/artefacts/production /mnt/data
    aws s3 sync "s3://${aws_s3_bucket.assets.id}/artefacts/production/" /mnt/artefacts/production/ --delete
    aws s3 sync "s3://${aws_s3_bucket.assets.id}/data/" /mnt/data/ --delete
    find /mnt/artefacts/production -maxdepth 1 -type f -print
    find /mnt/data -maxdepth 1 -type f -print
  EOT

  prometheus_config = <<-EOT
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    scrape_configs:
      - job_name: moe_inference
        static_configs:
          - targets: ["moe-inference-svc:8000"]
        metrics_path: /metrics
      - job_name: moe_training
        static_configs:
          - targets: ["moe-training-svc:8010"]
        metrics_path: /metrics
      - job_name: moe_monitoring
        static_configs:
          - targets: ["moe-monitoring-svc:8011"]
        metrics_path: /metrics
      - job_name: pushgateway
        honor_labels: true
        static_configs:
          - targets: ["pushgateway:9091"]
  EOT

  service_configs = {
    "api-gateway" = {
      image         = "${local.ghcr_prefix}/dashboard-gateway:${var.image_tag}"
      port          = 8090
      cpu           = 128
      memory        = 256
      desired_count = 1
      env = {
        AUTH_SERVICE_URL       = "http://auth-svc:8001"
        UPLOAD_SERVICE_URL     = "http://upload-svc:8002"
        INFERENCE_SERVICE_URL  = "http://inference-svc:8003"
        TRAINING_SERVICE_URL   = "http://moe-training-svc:8010"
        MONITORING_SERVICE_URL = "http://moe-monitoring-svc:8011"
        REPORT_SERVICE_URL     = "http://report-svc:8004"
        MLFLOW_URL             = "http://mlflow:5000"
        GRAFANA_URL            = "http://grafana:3000"
        FRONTEND_ORIGIN        = var.frontend_origin
      }
      secrets = [
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn },
        { name = "INTERNAL_API_KEY", valueFrom = aws_secretsmanager_secret.internal_api_key.arn }
      ]
      mounts = []
    }

    "auth-svc" = {
      image         = "${local.ghcr_prefix}/dashboard-auth:${var.image_tag}"
      port          = 8001
      cpu           = 128
      memory        = 384
      desired_count = 1
      env = {
        JWT_EXPIRY_MINUTES = "60"
        APP_LOGIN_URL      = local.app_login_url
      }
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.dashboard_database_url.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn }
      ]
      mounts = []
    }

    "upload-svc" = {
      image         = "${local.ghcr_prefix}/dashboard-upload:${var.image_tag}"
      port          = 8002
      cpu           = 128
      memory        = 256
      desired_count = 1
      env = {
        REDIS_URL             = "redis://redis:6379/0"
        MINIO_ENDPOINT        = "minio:9000"
        MINIO_ACCESS_KEY      = "minioadmin"
        MINIO_BUCKET_UPLOADS  = "uploads"
        INFERENCE_SERVICE_URL = "http://inference-svc:8003"
      }
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.dashboard_database_url.arn },
        { name = "MINIO_SECRET_KEY", valueFrom = aws_secretsmanager_secret.minio_root_password.arn }
      ]
      mounts = []
    }

    "inference-svc" = {
      image         = "${local.ghcr_prefix}/dashboard-inference:${var.image_tag}"
      port          = 8003
      cpu           = 128
      memory        = 256
      desired_count = 1
      env = {
        MLOPS_BASE_URL = "http://moe-inference-svc:8000"
        MLOPS_TIMEOUT  = "120"
      }
      secrets = [
        { name = "MLOPS_API_KEY", valueFrom = aws_secretsmanager_secret.internal_api_key.arn }
      ]
      mounts = []
    }

    "report-svc" = {
      image         = "${local.ghcr_prefix}/dashboard-report:${var.image_tag}"
      port          = 8004
      cpu           = 128
      memory        = 384
      desired_count = 1
      env = {
        MINIO_ENDPOINT       = "minio:9000"
        MINIO_ACCESS_KEY     = "minioadmin"
        MINIO_BUCKET_EXPORTS = "exports"
      }
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.dashboard_database_url.arn },
        { name = "MINIO_SECRET_KEY", valueFrom = aws_secretsmanager_secret.minio_root_password.arn }
      ]
      mounts = []
    }

    "moe-inference-svc" = {
      image         = "${local.ghcr_prefix}/moe-inference:${var.image_tag}"
      port          = 8000
      cpu           = 1024
      memory        = 5120
      desired_count = 1
      env = {
        ARTEFACTS_DIR          = "/app/artefacts/production"
        WEBAPP_ORIGIN          = var.frontend_origin
        LOG_DIR                = "/app/logs/predictions"
        MLFLOW_TRACKING_URI    = "http://mlflow:5000"
        DATA_5G_PATH           = "/app/data/Global_CLEANED.csv"
        DATA_6G_PATH           = "/app/data/AIoT_6G_CLEANED.csv"
        RELOAD_STRATEGY        = "restart"
        OMP_NUM_THREADS        = "1"
        TF_ENABLE_ONEDNN_OPTS  = "0"
        TF_NUM_INTEROP_THREADS = "1"
        TF_NUM_INTRAOP_THREADS = "1"
      }
      secrets = [
        { name = "API_KEY", valueFrom = aws_secretsmanager_secret.internal_api_key.arn },
        { name = "MONITORING_DB_URL", valueFrom = aws_secretsmanager_secret.monitoring_db_url.arn }
      ]
      mounts = [
        { sourceVolume = "artefacts", containerPath = "/app/artefacts", readOnly = false },
        { sourceVolume = "logs", containerPath = "/app/logs", readOnly = false },
        { sourceVolume = "data", containerPath = "/app/data", readOnly = true }
      ]
    }

    "moe-training-svc" = {
      image         = "${local.ghcr_prefix}/moe-training:${var.image_tag}"
      port          = 8010
      cpu           = 1024
      memory        = 5120
      desired_count = 0
      env = {
        ARTEFACTS_DIR          = "/app/artefacts/production"
        INFERENCE_BASE_URL     = "http://moe-inference-svc:8000"
        MLFLOW_TRACKING_URI    = "http://mlflow:5000"
        PUSHGATEWAY_URL        = "http://pushgateway:9091"
        DATA_5G_PATH           = "/app/data/Global_CLEANED.csv"
        DATA_6G_PATH           = "/app/data/AIoT_6G_CLEANED.csv"
        OMP_NUM_THREADS        = "1"
        TF_ENABLE_ONEDNN_OPTS  = "0"
        TF_NUM_INTEROP_THREADS = "1"
        TF_NUM_INTRAOP_THREADS = "1"
      }
      secrets = [
        { name = "API_KEY", valueFrom = aws_secretsmanager_secret.internal_api_key.arn }
      ]
      mounts = [
        { sourceVolume = "artefacts", containerPath = "/app/artefacts", readOnly = false },
        { sourceVolume = "data", containerPath = "/app/data", readOnly = true }
      ]
    }

    "moe-monitoring-svc" = {
      image         = "${local.ghcr_prefix}/moe-monitoring:${var.image_tag}"
      port          = 8011
      cpu           = 256
      memory        = 768
      desired_count = 1
      env = {
        ARTEFACTS_DIR     = "/app/artefacts/production"
        LOG_DIR           = "/app/logs/predictions"
        SLACK_WEBHOOK_URL = var.slack_webhook_url
      }
      secrets = [
        { name = "API_KEY", valueFrom = aws_secretsmanager_secret.internal_api_key.arn },
        { name = "MONITORING_DB_URL", valueFrom = aws_secretsmanager_secret.monitoring_db_url.arn }
      ]
      mounts = [
        { sourceVolume = "artefacts", containerPath = "/app/artefacts", readOnly = true },
        { sourceVolume = "logs", containerPath = "/app/logs", readOnly = true }
      ]
    }

    "redis" = {
      image         = "redis:7-alpine"
      port          = 6379
      cpu           = 64
      memory        = 128
      desired_count = 1
      env           = {}
      secrets       = []
      mounts        = []
    }

    "minio" = {
      image         = "quay.io/minio/minio:latest"
      port          = 9000
      cpu           = 128
      memory        = 512
      desired_count = 1
      command       = ["server", "/data", "--console-address", ":9001"]
      env = {
        MINIO_ROOT_USER = "minioadmin"
      }
      secrets = [
        { name = "MINIO_ROOT_PASSWORD", valueFrom = aws_secretsmanager_secret.minio_root_password.arn }
      ]
      mounts = [
        { sourceVolume = "minio", containerPath = "/data", readOnly = false }
      ]
    }

    "mlflow" = {
      image         = "ghcr.io/mlflow/mlflow:v2.21.3"
      port          = 5000
      cpu           = 256
      memory        = 768
      desired_count = 0
      entry_point   = ["sh", "-c"]
      command       = ["pip install psycopg2-binary -q && mlflow server --backend-store-uri \"$MLFLOW_BACKEND_STORE_URI\" --artifacts-destination /mlruns_artifacts --host 0.0.0.0 --port 5000"]
      env = {
        MLFLOW_ARTIFACT_ROOT = "/mlruns_artifacts"
      }
      secrets = [
        { name = "MLFLOW_BACKEND_STORE_URI", valueFrom = aws_secretsmanager_secret.mlflow_database_url.arn }
      ]
      mounts = [
        { sourceVolume = "mlflow", containerPath = "/mlruns_artifacts", readOnly = false }
      ]
    }

    "prometheus" = {
      image         = "prom/prometheus:v2.50.1"
      port          = 9090
      cpu           = 128
      memory        = 384
      desired_count = 0
      entry_point   = ["sh", "-c"]
      command       = ["cat > /tmp/prometheus.yml <<'EOF'\n${local.prometheus_config}\nEOF\n/bin/prometheus --config.file=/tmp/prometheus.yml --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=7d"]
      env           = {}
      secrets       = []
      mounts        = []
    }

    "grafana" = {
      image         = "grafana/grafana:10.3.3"
      port          = 3000
      cpu           = 128
      memory        = 384
      desired_count = 0
      env = {
        GF_USERS_ALLOW_SIGN_UP    = "false"
        GF_AUTH_ANONYMOUS_ENABLED = "false"
      }
      secrets = [
        { name = "GF_SECURITY_ADMIN_PASSWORD", valueFrom = aws_secretsmanager_secret.grafana_password.arn }
      ]
      mounts = []
    }

    "pushgateway" = {
      image         = "prom/pushgateway:v1.7.0"
      port          = 9091
      cpu           = 64
      memory        = 128
      desired_count = 0
      env           = {}
      secrets       = []
      mounts        = []
    }
  }
}

resource "aws_ecs_task_definition" "service" {
  for_each = local.service_configs

  family                   = "${local.name}-${each.key}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = tostring(each.value.cpu + 64)
  memory                   = tostring(each.value.memory + 128)
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = local.ecs_task_arch
    operating_system_family = "LINUX"
  }

  dynamic "volume" {
    for_each = { for mount in try(each.value.mounts, []) : mount.sourceVolume => mount }
    content {
      name = volume.key
      efs_volume_configuration {
        file_system_id     = aws_efs_file_system.main.id
        transit_encryption = "ENABLED"
        authorization_config {
          access_point_id = aws_efs_access_point.dir[volume.key].id
          iam             = "DISABLED"
        }
      }
    }
  }

  container_definitions = jsonencode([
    merge(
      {
        name      = each.key
        image     = each.value.image
        essential = true
        cpu       = each.value.cpu
        memory    = each.value.memory
        environment = [
          for name, value in try(each.value.env, {}) : {
            name  = name
            value = tostring(value)
          }
        ]
        secrets = try(each.value.secrets, [])
        mountPoints = [
          for mount in try(each.value.mounts, []) : {
            sourceVolume  = mount.sourceVolume
            containerPath = mount.containerPath
            readOnly      = mount.readOnly
          }
        ]
        logConfiguration = {
          logDriver = "awslogs"
          options = {
            awslogs-group         = aws_cloudwatch_log_group.ecs.name
            awslogs-region        = var.aws_region
            awslogs-stream-prefix = each.key
          }
        }
      },
      each.value.port == null ? {} : {
        portMappings = [{
          name          = each.key
          containerPort = each.value.port
          hostPort      = 0
          protocol      = "tcp"
        }]
      },
      var.ghcr_credentials_secret_arn == "" || !startswith(each.value.image, "ghcr.io/") ? {} : {
        repositoryCredentials = {
          credentialsParameter = var.ghcr_credentials_secret_arn
        }
      },
      can(each.value.command) ? { command = each.value.command } : {},
      can(each.value.entry_point) ? { entryPoint = each.value.entry_point } : {}
    )
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "service" {
  for_each = local.service_configs

  name            = each.key
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = lookup(var.service_desired_counts, each.key, each.value.desired_count)

  capacity_provider_strategy {
    capacity_provider = aws_ecs_capacity_provider.ec2.name
    weight            = 1
  }

  dynamic "load_balancer" {
    for_each = each.key == "api-gateway" ? [aws_lb_target_group.gateway.arn] : each.key == "grafana" ? [aws_lb_target_group.grafana.arn] : each.key == "mlflow" ? [aws_lb_target_group.mlflow.arn] : []
    content {
      target_group_arn = load_balancer.value
      container_name   = each.key
      container_port   = each.value.port
    }
  }

  dynamic "service_connect_configuration" {
    for_each = each.value.port == null ? [] : [1]
    content {
      enabled   = true
      namespace = aws_service_discovery_http_namespace.main.arn

      service {
        port_name      = each.key
        discovery_name = each.key

        client_alias {
          dns_name = each.key
          port     = each.value.port
        }
      }
    }
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200
  enable_execute_command             = true

  depends_on = [
    aws_ecs_cluster_capacity_providers.main,
    aws_lb_listener.http_forward,
    aws_lb_listener.grafana,
    aws_lb_listener.mlflow,
    aws_lb_listener.http_redirect,
    aws_lb_listener.https,
    aws_efs_mount_target.main
  ]

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "db_init" {
  family                   = "${local.name}-db-init"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "128"
  memory                   = "256"
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = local.ecs_task_arch
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([{
    name       = "db-init"
    image      = "postgres:16-alpine"
    essential  = true
    entryPoint = ["sh", "-c"]
    command    = [local.db_init_command]
    environment = [
      { name = "PGHOST", value = local.db_host },
      { name = "PGPORT", value = tostring(local.db_port) },
      { name = "PGUSER", value = var.rds_username }
    ]
    secrets = [
      { name = "PGPASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "db-init"
      }
    }
  }])

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "asset_sync" {
  family                   = "${local.name}-asset-sync"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "128"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    cpu_architecture        = local.ecs_task_arch
    operating_system_family = "LINUX"
  }

  volume {
    name = "artefacts"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.main.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.dir["artefacts"].id
        iam             = "DISABLED"
      }
    }
  }

  volume {
    name = "data"
    efs_volume_configuration {
      file_system_id     = aws_efs_file_system.main.id
      transit_encryption = "ENABLED"
      authorization_config {
        access_point_id = aws_efs_access_point.dir["data"].id
        iam             = "DISABLED"
      }
    }
  }

  container_definitions = jsonencode([{
    name       = "asset-sync"
    image      = "public.ecr.aws/aws-cli/aws-cli:latest"
    essential  = true
    entryPoint = ["sh", "-c"]
    command    = [local.asset_sync_command]
    mountPoints = [
      { sourceVolume = "artefacts", containerPath = "/mnt/artefacts", readOnly = false },
      { sourceVolume = "data", containerPath = "/mnt/data", readOnly = false }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs.name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "asset-sync"
      }
    }
  }])

  tags = local.common_tags
}
