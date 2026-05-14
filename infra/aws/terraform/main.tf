data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name          = var.project_name
  azs           = slice(data.aws_availability_zones.available.names, 0, var.az_count)
  ghcr_prefix   = "ghcr.io/${lower(var.github_owner)}"
  public_cidrs  = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i)]
  private_cidrs = [for i in range(var.az_count) : cidrsubnet(var.vpc_cidr, 8, i + 20)]
  ecs_ami_path  = var.ecs_cpu_architecture == "arm64" ? "/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id" : "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id"
  ecs_task_arch = var.ecs_cpu_architecture == "arm64" ? "ARM64" : "X86_64"
  app_login_url = var.frontend_origin == "*" ? "/login" : "${var.frontend_origin}/login"

  common_tags = {
    Project = local.name
    Purpose = "academic-demo"
  }
}

data "aws_ssm_parameter" "ecs_ami" {
  name = local.ecs_ami_path
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  tags                 = merge(local.common_tags, { Name = "${local.name}-vpc" })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name}-igw" })
}

resource "aws_subnet" "public" {
  for_each = { for idx, az in local.azs : az => local.public_cidrs[idx] }

  vpc_id                  = aws_vpc.main.id
  availability_zone       = each.key
  cidr_block              = each.value
  map_public_ip_on_launch = true
  tags                    = merge(local.common_tags, { Name = "${local.name}-public-${each.key}" })
}

resource "aws_subnet" "private" {
  for_each = { for idx, az in local.azs : az => local.private_cidrs[idx] }

  vpc_id            = aws_vpc.main.id
  availability_zone = each.key
  cidr_block        = each.value
  tags              = merge(local.common_tags, { Name = "${local.name}-private-${each.key}" })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  tags   = merge(local.common_tags, { Name = "${local.name}-public-rt" })
}

resource "aws_route" "public_default" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "alb" {
  name        = "${local.name}-alb"
  description = "Public ALB ingress"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-alb-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each = toset(var.allowed_http_cidrs)

  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = each.value
  from_port         = 80
  ip_protocol       = "tcp"
  to_port           = 80
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each = toset(var.acm_certificate_arn == "" ? [] : var.allowed_http_cidrs)

  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = each.value
  from_port         = 443
  ip_protocol       = "tcp"
  to_port           = 443
}

resource "aws_vpc_security_group_egress_rule" "alb_all" {
  security_group_id = aws_security_group.alb.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "ecs" {
  name        = "${local.name}-ecs-hosts"
  description = "ECS container instances"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-ecs-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb_dynamic" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = 32768
  ip_protocol                  = "tcp"
  to_port                      = 65535
}

resource "aws_vpc_security_group_ingress_rule" "ecs_self" {
  security_group_id            = aws_security_group.ecs.id
  referenced_security_group_id = aws_security_group.ecs.id
  ip_protocol                  = "-1"
}

resource "aws_vpc_security_group_ingress_rule" "ecs_ssh" {
  for_each = toset(var.ssh_key_name == null ? [] : var.allowed_ssh_cidrs)

  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = each.value
  from_port         = 22
  ip_protocol       = "tcp"
  to_port           = 22
}

resource "aws_vpc_security_group_egress_rule" "ecs_all" {
  security_group_id = aws_security_group.ecs.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds"
  description = "RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-rds-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 5432
  ip_protocol                  = "tcp"
  to_port                      = 5432
}

resource "aws_security_group" "efs" {
  name        = "${local.name}-efs"
  description = "EFS mounts from ECS"
  vpc_id      = aws_vpc.main.id
  tags        = merge(local.common_tags, { Name = "${local.name}-efs-sg" })
}

resource "aws_vpc_security_group_ingress_rule" "efs_from_ecs" {
  security_group_id            = aws_security_group.efs.id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 2049
  ip_protocol                  = "tcp"
  to_port                      = 2049
}
