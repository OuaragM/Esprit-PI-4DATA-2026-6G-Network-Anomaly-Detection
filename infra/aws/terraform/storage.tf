resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "random_password" "internal_api_key" {
  length  = 40
  special = false
}

resource "random_password" "grafana" {
  length  = 20
  special = false
}

resource "random_password" "minio" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-rds-subnets"
  subnet_ids = values(aws_subnet.private)[*].id
  tags       = local.common_tags
}

resource "aws_db_instance" "postgres" {
  identifier             = "${local.name}-postgres"
  engine                 = "postgres"
  engine_version         = "16"
  instance_class         = var.rds_instance_class
  allocated_storage      = var.rds_allocated_storage_gb
  db_name                = "dashboard"
  username               = var.rds_username
  password               = random_password.db.result
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false
  skip_final_snapshot    = true
  deletion_protection    = false
  apply_immediately      = true
  storage_encrypted      = true
  tags                   = local.common_tags
}

locals {
  db_host = aws_db_instance.postgres.address
  db_port = aws_db_instance.postgres.port

  dashboard_database_url = "postgresql+asyncpg://${var.rds_username}:${random_password.db.result}@${local.db_host}:${local.db_port}/dashboard"
  mlflow_database_url    = "postgresql://${var.rds_username}:${random_password.db.result}@${local.db_host}:${local.db_port}/mlflow"
  monitoring_db_url      = "postgresql://${var.rds_username}:${random_password.db.result}@${local.db_host}:${local.db_port}/moe_monitoring"
}

resource "aws_secretsmanager_secret" "jwt" {
  name = "${local.name}/jwt-secret"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "jwt" {
  secret_id     = aws_secretsmanager_secret.jwt.id
  secret_string = random_password.jwt.result
}

resource "aws_secretsmanager_secret" "internal_api_key" {
  name = "${local.name}/internal-api-key"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "internal_api_key" {
  secret_id     = aws_secretsmanager_secret.internal_api_key.id
  secret_string = random_password.internal_api_key.result
}

resource "aws_secretsmanager_secret" "dashboard_database_url" {
  name = "${local.name}/dashboard-database-url"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "${local.name}/db-password"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_secretsmanager_secret_version" "dashboard_database_url" {
  secret_id     = aws_secretsmanager_secret.dashboard_database_url.id
  secret_string = local.dashboard_database_url
}

resource "aws_secretsmanager_secret" "mlflow_database_url" {
  name = "${local.name}/mlflow-database-url"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "mlflow_database_url" {
  secret_id     = aws_secretsmanager_secret.mlflow_database_url.id
  secret_string = local.mlflow_database_url
}

resource "aws_secretsmanager_secret" "monitoring_db_url" {
  name = "${local.name}/monitoring-db-url"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "monitoring_db_url" {
  secret_id     = aws_secretsmanager_secret.monitoring_db_url.id
  secret_string = local.monitoring_db_url
}

resource "aws_secretsmanager_secret" "grafana_password" {
  name = "${local.name}/grafana-admin-password"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "grafana_password" {
  secret_id     = aws_secretsmanager_secret.grafana_password.id
  secret_string = random_password.grafana.result
}

resource "aws_secretsmanager_secret" "minio_root_password" {
  name = "${local.name}/minio-root-password"
  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "minio_root_password" {
  secret_id     = aws_secretsmanager_secret.minio_root_password.id
  secret_string = random_password.minio.result
}

resource "aws_efs_file_system" "main" {
  creation_token   = "${local.name}-efs"
  encrypted        = true
  performance_mode = "generalPurpose"
  throughput_mode  = "elastic"
  tags             = merge(local.common_tags, { Name = "${local.name}-efs" })
}

resource "aws_efs_mount_target" "main" {
  for_each = aws_subnet.private

  file_system_id  = aws_efs_file_system.main.id
  subnet_id       = each.value.id
  security_groups = [aws_security_group.efs.id]
}

locals {
  efs_dirs = {
    artefacts  = "/artefacts"
    data       = "/data"
    logs       = "/logs"
    minio      = "/minio"
    mlflow     = "/mlflow"
    grafana    = "/grafana"
    prometheus = "/prometheus"
  }
}

resource "aws_efs_access_point" "dir" {
  for_each = local.efs_dirs

  file_system_id = aws_efs_file_system.main.id

  posix_user {
    gid = 1000
    uid = 1000
  }

  root_directory {
    path = each.value
    creation_info {
      owner_gid   = 1000
      owner_uid   = 1000
      permissions = "0775"
    }
  }

  tags = merge(local.common_tags, { Name = "${local.name}-${each.key}" })
}

resource "aws_s3_bucket" "assets" {
  bucket_prefix = "${local.name}-demo-assets-"
  force_destroy = true
  tags          = local.common_tags
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket                  = aws_s3_bucket.assets.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
