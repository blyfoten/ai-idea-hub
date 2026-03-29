##############################################################################
# AI Idea Hub — Production Infrastructure
#
# Architecture:
#   - ECS Fargate: Next.js app + Agent worker
#   - RDS PostgreSQL: Primary database
#   - ElastiCache Redis: Job queue (BullMQ)
#   - S3: Agent artifacts + file storage
#   - ALB: Load balancer with TLS
#   - ECS Fargate (sandboxed): Ephemeral agent containers
##############################################################################

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "ideahub-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "eu-north-1"
    dynamodb_table = "ideahub-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ai-idea-hub"
      Environment = "prod"
      ManagedBy   = "terraform"
    }
  }
}

# ─── Variables ────────────────────────────────────────────────────────

variable "aws_region" {
  default = "eu-north-1"
}

variable "domain_name" {
  description = "Primary domain for the application"
  type        = string
  default     = "ideahub.example.com"
}

variable "db_password" {
  description = "RDS master password"
  type        = string
  sensitive   = true
}

variable "ai_api_key" {
  description = "API key for AI model provider"
  type        = string
  sensitive   = true
  default     = ""
}

variable "ai_base_url" {
  description = "Base URL for OpenAI-compatible AI API"
  type        = string
  default     = "https://api.together.xyz/v1"
}

variable "ai_model" {
  description = "Default AI model identifier"
  type        = string
  default     = "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo"
}

# ─── Networking ───────────────────────────────────────────────────────

module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "ideahub-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b", "${var.aws_region}c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = true # cost optimization for MVP
  enable_dns_hostnames = true
}

# ─── Database (RDS PostgreSQL) ────────────────────────────────────────

module "rds" {
  source = "../../modules/rds"

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnets
  db_password        = var.db_password
  ecs_security_group = module.ecs.ecs_security_group_id
}

# ─── Redis (ElastiCache) ─────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "redis" {
  name       = "ideahub-redis"
  subnet_ids = module.vpc.private_subnets
}

resource "aws_security_group" "redis" {
  name_prefix = "ideahub-redis-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.ecs.ecs_security_group_id]
  }
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "ideahub-redis"
  engine               = "redis"
  node_type            = "cache.t3.micro" # MVP-sized
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

# ─── S3 (Agent Artifacts) ────────────────────────────────────────────

module "s3" {
  source = "../../modules/s3"
}

# ─── ECS Cluster + Web App Service ───────────────────────────────────

module "ecs" {
  source = "../../modules/ecs"

  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnets
  private_subnet_ids = module.vpc.private_subnets

  database_url = "postgresql://ideahub:${var.db_password}@${module.rds.db_endpoint}/ideahub"
  redis_url    = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:6379"

  ai_base_url = var.ai_base_url
  ai_api_key  = var.ai_api_key
  ai_model    = var.ai_model

  artifacts_bucket = module.s3.bucket_name
}

# ─── Agent Sandbox (isolated ECS tasks) ──────────────────────────────

module "agent_sandbox" {
  source = "../../modules/agent-sandbox"

  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnets
  ecs_cluster_arn    = module.ecs.cluster_arn

  ai_base_url = var.ai_base_url
  ai_api_key  = var.ai_api_key
  ai_model    = var.ai_model
}

# ─── Outputs ──────────────────────────────────────────────────────────

output "app_url" {
  value = "https://${module.ecs.alb_dns_name}"
}

output "db_endpoint" {
  value     = module.rds.db_endpoint
  sensitive = true
}

output "agent_cluster" {
  value = module.ecs.cluster_arn
}
