output "alb_dns_name" {
  description = "Public ALB DNS name. Use this as NEXT_PUBLIC_API_URL until you attach a custom HTTPS domain."
  value       = aws_lb.public.dns_name
}

output "api_base_url" {
  description = "API base URL for Vercel."
  value       = var.acm_certificate_arn == "" ? "http://${aws_lb.public.dns_name}" : "https://${aws_lb.public.dns_name}"
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_capacity_provider_name" {
  value = aws_ecs_capacity_provider.ec2.name
}

output "ecs_autoscaling_group_name" {
  value = aws_autoscaling_group.ecs.name
}

output "asset_bucket" {
  description = "Upload MoE data and trained artefacts here, then run the asset-sync ECS task."
  value       = aws_s3_bucket.assets.id
}

output "db_init_task_definition" {
  description = "Run this one-off task after apply to create mlflow and moe_monitoring databases."
  value       = aws_ecs_task_definition.db_init.arn
}

output "asset_sync_task_definition" {
  description = "Run this one-off task after uploading assets to S3."
  value       = aws_ecs_task_definition.asset_sync.arn
}

output "ecs_public_subnet_ids" {
  value = values(aws_subnet.public)[*].id
}

output "ecs_security_group_id" {
  value = aws_security_group.ecs.id
}

output "grafana_admin_password_secret_arn" {
  value     = aws_secretsmanager_secret.grafana_password.arn
  sensitive = true
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}
