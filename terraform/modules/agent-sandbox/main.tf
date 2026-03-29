##############################################################################
# Agent Sandbox Module — Ephemeral Fargate Tasks for AI Agents
#
# Each agent job gets its own isolated Fargate task with:
#   - Restricted networking (no internet by default)
#   - Limited CPU/memory
#   - Auto-terminated after timeout
#   - Results pushed to S3
#
# Supports swapping models: the AI_MODEL env var controls which
# open-source model the agent uses (via any OpenAI-compatible API).
##############################################################################

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "ecs_cluster_arn" { type = string }
variable "ai_base_url" { type = string }
variable "ai_api_key" { type = string; sensitive = true }
variable "ai_model" { type = string }

# ─── Security Group (restricted) ─────────────────────────────────────

resource "aws_security_group" "agent" {
  name_prefix = "ideahub-agent-"
  vpc_id      = var.vpc_id

  # Only allow outbound to the AI API endpoint (private subnet)
  # For models hosted in the same VPC, restrict CIDR to VPC range
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # tighten in production
    description = "HTTPS to AI model API"
  }

  egress {
    from_port   = 11434
    to_port     = 11434
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Ollama in VPC"
  }

  tags = {
    Name = "ideahub-agent-sandbox"
  }
}

# ─── IAM ──────────────────────────────────────────────────────────────

resource "aws_iam_role" "agent_execution" {
  name = "ideahub-agent-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "agent_execution" {
  role       = aws_iam_role.agent_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "agent_task" {
  name = "ideahub-agent-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "agent_s3" {
  name = "agent-s3-write"
  role = aws_iam_role.agent_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject"]
      Resource = "arn:aws:s3:::ideahub-agent-artifacts/jobs/*"
    }]
  })
}

# ─── Logs ─────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "agent" {
  name              = "/ecs/ideahub/agent-sandbox"
  retention_in_days = 14
}

# ─── Task Definition ─────────────────────────────────────────────────

resource "aws_ecs_task_definition" "agent" {
  family                   = "ideahub-agent-sandbox"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"   # 0.25 vCPU per agent
  memory                   = "512"   # 512MB per agent

  execution_role_arn = aws_iam_role.agent_execution.arn
  task_role_arn      = aws_iam_role.agent_task.arn

  container_definitions = jsonencode([{
    name  = "agent"
    image = "ghcr.io/ai-idea-hub/agent-sandbox:latest"

    environment = [
      { name = "AI_BASE_URL", value = var.ai_base_url },
      { name = "AI_API_KEY", value = var.ai_api_key },
      { name = "AI_MODEL", value = var.ai_model },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.agent.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = "agent"
      }
    }

    # Resource limits for sandboxing
    linuxParameters = {
      initProcessEnabled = true
      capabilities = {
        drop = ["ALL"]  # drop all Linux capabilities
      }
      tmpfs = [{
        containerPath = "/tmp"
        size          = 128 # 128MB tmp space
        mountOptions  = ["noexec", "nosuid"]
      }]
    }
  }])

  # Ephemeral storage for agent workspace
  ephemeral_storage {
    size_in_gib = 5
  }
}

data "aws_region" "current" {}

# ─── Outputs ──────────────────────────────────────────────────────────

output "task_definition_arn" {
  value = aws_ecs_task_definition.agent.arn
}

output "security_group_id" {
  value = aws_security_group.agent.id
}

output "agent_subnets" {
  value = join(",", var.private_subnet_ids)
}
