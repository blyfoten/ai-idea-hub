##############################################################################
# RDS Module — PostgreSQL Database
##############################################################################

variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "db_password" { type = string; sensitive = true }
variable "ecs_security_group" { type = string }

resource "aws_db_subnet_group" "main" {
  name       = "ideahub-db"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "db" {
  name_prefix = "ideahub-db-"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.ecs_security_group]
  }
}

resource "aws_db_instance" "main" {
  identifier = "ideahub"

  engine         = "postgres"
  engine_version = "16"
  instance_class = "db.t3.micro" # MVP-sized, scale later

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp3"

  db_name  = "ideahub"
  username = "ideahub"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  multi_az                = false # MVP: single AZ
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "ideahub-final"

  tags = {
    Name = "ideahub-postgres"
  }
}

output "db_endpoint" {
  value = aws_db_instance.main.endpoint
}
