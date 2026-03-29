# AI Idea Hub

A platform for discovering, validating, and executing ideas using AI-driven workflows and a credit-based economy. AI agents run in sandboxed cloud environments using open-source models.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                   Next.js (React + SSR)                      │
├─────────────────────────────────────────────────────────────┤
│                        API Layer                             │
│              Next.js API Routes (REST)                       │
├──────────────┬──────────────┬───────────────────────────────┤
│  PostgreSQL  │    Redis     │    Agent Orchestrator          │
│  (Prisma)    │  (BullMQ)   │  ┌─────────────────────────┐  │
│              │              │  │  Sandbox Strategies:     │  │
│  - Users     │  - Job Queue │  │  • Local (dev)          │  │
│  - Ideas     │  - Rate Limit│  │  • Docker (staging)     │  │
│  - Credits   │              │  │  • ECS Fargate (prod)   │  │
│  - AgentJobs │              │  └─────────────────────────┘  │
├──────────────┴──────────────┴───────────────────────────────┤
│                  AI Model Layer                              │
│        OpenAI-compatible API (swap freely)                   │
│  Ollama │ vLLM │ Together AI │ OpenRouter │ Any provider    │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start (Local Development)

### Option 1: Docker Compose (recommended)

```bash
# Start everything: Postgres, Redis, Ollama, App, Worker
docker compose up

# Pull a model into Ollama (first time only)
docker exec -it ai-idea-hub-ollama-1 ollama pull llama3.1:8b

# Open http://localhost:3000
```

### Option 2: Manual Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env with your settings

# 3. Start Postgres + Redis (or use Docker for just these)
docker compose up postgres redis -d

# 4. Push the database schema
npx prisma db push

# 5. Start the app
npm run dev

# 6. Start the agent worker (separate terminal)
npm run agents:worker
```

## AI Model Configuration

The platform uses the OpenAI-compatible API format, so you can point it at any provider:

| Provider | `AI_BASE_URL` | Model Example |
|----------|---------------|---------------|
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1:8b` |
| vLLM (self-hosted) | `http://localhost:8000/v1` | `meta-llama/Meta-Llama-3.1-8B` |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo` |
| OpenRouter | `https://openrouter.ai/api/v1` | `meta-llama/llama-3.1-8b-instruct` |
| Anthropic (via proxy) | Requires adapter | `claude-3-haiku` |

## Cloud Deployment (AWS)

The infrastructure is managed with Terraform in `/terraform`.

### What Gets Deployed

- **ECS Fargate** — Next.js app (2 instances) + Agent worker (1 instance)
- **RDS PostgreSQL** — Primary database (db.t3.micro for MVP)
- **ElastiCache Redis** — Job queue for BullMQ
- **S3** — Agent artifacts and file storage
- **ALB** — Load balancer with health checks
- **Agent Sandbox** — Ephemeral Fargate tasks with:
  - Dropped Linux capabilities (no root, no mount, etc.)
  - 256 CPU / 512MB memory per agent
  - Isolated networking (no internet access by default)
  - Auto-cleanup after completion

### Deploy

```bash
cd terraform/environments/prod

# Initialize
terraform init

# Plan
terraform plan -var="db_password=YOUR_SECURE_PASSWORD" -var="ai_api_key=YOUR_KEY"

# Apply
terraform apply -var="db_password=YOUR_SECURE_PASSWORD" -var="ai_api_key=YOUR_KEY"
```

## Agent Sandbox Strategies

The agent orchestrator supports three sandbox modes:

| Mode | Use Case | How It Works |
|------|----------|--------------|
| `local` | Development | Runs AI calls in-process, no container isolation |
| `docker` | Staging / Self-hosted | Spins up a Docker container per job with CPU/memory limits |
| `ecs` | Production (AWS) | Launches an ECS Fargate task per job with full isolation |

Set the mode via `AGENT_SANDBOX_MODE` environment variable.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account (grants $5 credits) |
| POST | `/api/auth/login` | Login |
| GET | `/api/ideas?q=&status=` | Search/list ideas |
| POST | `/api/ideas` | Submit a new idea |
| GET | `/api/ideas/:id` | Get idea details + AI results |
| POST | `/api/ideas/:id/validate` | Trigger AI validation ($1.50) |
| POST | `/api/ideas/:id/invest` | Invest credits (10% platform fee) |
| GET | `/api/agents?ideaId=` | List agent jobs |
| GET | `/api/credits` | Credit balance + transactions |

## Project Structure

```
ai-idea-hub/
├── src/
│   ├── app/                    # Next.js pages + API routes
│   │   ├── api/                # REST endpoints
│   │   ├── dashboard/          # User dashboard
│   │   ├── ideas/              # Idea pages (list, detail, new)
│   │   └── search/             # Idea discovery
│   ├── components/             # Shared React components
│   ├── lib/                    # Core utilities
│   │   ├── ai.ts               # AI client + prompt templates
│   │   ├── auth.ts             # JWT auth
│   │   └── db.ts               # Prisma client
│   └── services/               # Background services
│       ├── agent-orchestrator.ts  # Sandbox lifecycle management
│       └── agent-worker.ts        # BullMQ consumer
├── prisma/
│   └── schema.prisma           # Database schema
├── terraform/                  # Infrastructure-as-code
│   ├── modules/
│   │   ├── ecs/                # ECS Fargate (app + worker)
│   │   ├── rds/                # PostgreSQL
│   │   ├── s3/                 # Artifact storage
│   │   └── agent-sandbox/      # Ephemeral agent tasks
│   └── environments/
│       └── prod/               # Production config
├── docker/
│   └── agent-sandbox/          # Agent container image
│       ├── Dockerfile
│       └── agent.py            # Python agent script
├── docker-compose.yml          # Local dev stack
└── Dockerfile                  # App container
```

## Credit Economy

- **Signup bonus**: $5 in free AI credits
- **Validation cost**: $1.50 per idea (runs 3 AI agents)
- **Platform fee**: 10% of all credit purchases funds new users
- **Agent costs**: Debited per job based on model + compute time

## License

MIT
