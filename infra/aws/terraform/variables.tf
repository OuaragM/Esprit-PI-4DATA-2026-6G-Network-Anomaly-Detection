variable "project_name" {
  description = "Short name used for AWS resource names."
  type        = string
  default     = "verado"
}

variable "aws_region" {
  description = "AWS region for the demo stack."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the demo VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to use."
  type        = number
  default     = 2
}

variable "github_owner" {
  description = "Lowercase GitHub/GHCR owner that contains the published backend images."
  type        = string
}

variable "image_tag" {
  description = "Image tag published by .github/workflows/cd.yml."
  type        = string
  default     = "latest"
}

variable "ghcr_credentials_secret_arn" {
  description = "Optional Secrets Manager ARN for private GHCR pulls. Secret value must be JSON: {\"username\":\"...\",\"password\":\"...\"}."
  type        = string
  default     = ""
}

variable "frontend_origin" {
  description = "Vercel frontend origin, for CORS. Example: https://verado-demo.vercel.app"
  type        = string
}

variable "acm_certificate_arn" {
  description = "Optional ACM certificate ARN for HTTPS on the public ALB. Leave empty to expose HTTP for a short demo."
  type        = string
  default     = ""
}

variable "allowed_http_cidrs" {
  description = "CIDRs allowed to reach the public ALB."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ssh_key_name" {
  description = "Optional EC2 key pair for break-glass SSH. Prefer SSM Session Manager and leave this null."
  type        = string
  default     = null
}

variable "allowed_ssh_cidrs" {
  description = "CIDRs allowed to SSH to ECS hosts when ssh_key_name is set."
  type        = list(string)
  default     = []
}

variable "ecs_instance_type" {
  description = "EC2 instance type for ECS capacity. Use a type that matches ecs_cpu_architecture."
  type        = string
  default     = "m7i-flex.large"
}

variable "ecs_cpu_architecture" {
  description = "CPU architecture for ECS hosts and task definitions. Use x86_64 when ARM free-tier hosts cannot fit the ML tasks."
  type        = string
  default     = "x86_64"

  validation {
    condition     = contains(["arm64", "x86_64"], var.ecs_cpu_architecture)
    error_message = "ecs_cpu_architecture must be arm64 or x86_64."
  }
}

variable "ecs_min_size" {
  description = "Minimum EC2 instances in the ECS Auto Scaling Group. Set 0 outside demo hours."
  type        = number
  default     = 0
}

variable "ecs_desired_size" {
  description = "Desired EC2 instances in the ECS Auto Scaling Group."
  type        = number
  default     = 1
}

variable "ecs_max_size" {
  description = "Maximum EC2 instances in the ECS Auto Scaling Group."
  type        = number
  default     = 2
}

variable "service_desired_counts" {
  description = "Per-service desired count overrides. Use this to scale training/Grafana/MLflow to 0 outside demo time."
  type        = map(number)
  default     = {}
}

variable "rds_instance_class" {
  description = "RDS instance class. db.t4g.micro is free-tier eligible for many new accounts."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage_gb" {
  description = "RDS storage in GB."
  type        = number
  default     = 20
}

variable "rds_username" {
  description = "RDS master username."
  type        = string
  default     = "verado_admin"
}

variable "slack_webhook_url" {
  description = "Optional Slack webhook for drift alerts."
  type        = string
  default     = ""
  sensitive   = true
}

variable "enable_container_insights" {
  description = "Enable ECS Container Insights. Useful for demos, but may create CloudWatch charges."
  type        = bool
  default     = false
}
