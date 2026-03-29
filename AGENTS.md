# AGENTS.md — Guidance for AI Coding Agents

This file provides context for AI coding agents (Copilot, Claude Code, Cursor, Codex, etc.) working on this codebase.

## Project Overview

AI Idea Hub is a full-stack platform where users submit ideas and AI agents validate and develop them in sandboxed cloud environments. It uses a credit-based economy to fund AI compute.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Database**: PostgreSQL via Prisma ORM
- **Queue**: Redis + BullMQ for async agent jobs
- **AI**: OpenAI-compatible API (works with Ollama, vLLM, Together AI, OpenRouter)
- **Infrastructure**: Terraform on AWS (ECS Fargate, RDS, ElastiCache, S3)
- **Styling**: Tailwind CSS

## Repository Structure

```
src/
├── app/              # Next.js pages and API routes (App Router)
│   ├── api/          # REST endpoints — each folder = one route
│   ├── dashboard/    # User dashboard (client component)
│   ├── ideas/        # Idea pages: list, detail, create
│   └── search/       # Idea discovery page
├── lib/              # Shared utilities (db, auth, ai client)
└── services/         # Background services (agent orchestrator + worker)
prisma/               # Database schema
terraform/            # Infrastructure-as-code (modular)
docker/               # Container images (agent sandbox)
```

## Key Patterns

### API Routes

All API routes are in `src/app/api/` using Next.js route handlers. They follow this pattern:

- Input validation with Zod schemas
- Auth via `getCurrentUser()` from `@/lib/auth` (JWT Bearer token)
- Prisma for database access via `@/lib/db`
- Return `NextResponse.json()` with appropriate status codes

### Agent Orchestration

The agent system has three layers:

1. **API** (`src/app/api/ideas/[id]/validate/route.ts`) — creates `AgentJob` records and enqueues work
2. **Orchestrator** (`src/services/agent-orchestrator.ts`) — manages sandbox lifecycle with pluggable strategies (local, Docker, ECS Fargate)
3. **Worker** (`src/services/agent-worker.ts`) — BullMQ consumer that processes queued jobs

Agent sandbox strategy is selected via `AGENT_SANDBOX_MODE` env var.

### AI Client

`src/lib/ai.ts` wraps the OpenAI SDK configured to talk to any OpenAI-compatible endpoint. The `AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` env vars control which provider/model is used. Prompt templates are exported as `PROMPTS`.

### Credit System

Credits flow through `CreditTransaction` records. Every debit/credit is recorded with a type and description. The `User.credits` field is the running balance. A 10% platform fee on investments funds the new-user bonus pool.

## Database

Schema is in `prisma/schema.prisma`. Key models:

- `User` — accounts with credit balance
- `Idea` — submitted ideas with AI-generated analysis fields (JSON)
- `Investment` — credits staked on ideas
- `CreditTransaction` — full ledger of all credit movements
- `AgentJob` — tracks each AI agent execution (status, model, result, logs)

Run `npx prisma db push` to sync schema. Run `npx prisma generate` after schema changes.

## Environment Variables

Copy `.env.example` to `.env`. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis for BullMQ job queue |
| `AI_BASE_URL` | OpenAI-compatible API endpoint |
| `AI_API_KEY` | API key for AI provider |
| `AI_MODEL` | Model identifier (e.g., `llama3.1:8b`) |
| `JWT_SECRET` | Secret for signing auth tokens |
| `AGENT_SANDBOX_MODE` | `local`, `docker`, or `ecs` |

## Conventions

- Use TypeScript strict mode — no `any` unless interfacing with Prisma JSON fields
- API responses: `{ data }` on success, `{ error: string }` on failure
- File naming: kebab-case for files, PascalCase for components
- Imports: use `@/` path alias for `src/`
- Commit messages: imperative mood, concise, explain "why" not "what"
- All new API routes need Zod input validation
- All credit operations must go through a Prisma `$transaction`

## Testing

Tests should be added in `__tests__/` directories colocated with the code they test. Use:

- `vitest` for unit tests
- Prisma with a test database for integration tests (do NOT mock the database)

## Common Tasks

### Add a new API endpoint
1. Create folder in `src/app/api/your-route/`
2. Add `route.ts` with exported HTTP method handlers
3. Add Zod schema for input validation
4. Use `getCurrentUser(req)` if auth is required

### Add a new agent job type
1. Add the type to `JobType` enum in `prisma/schema.prisma`
2. Add a prompt template in `src/lib/ai.ts` → `PROMPTS`
3. Add field mapping in `src/services/agent-worker.ts` if it updates the Idea model
4. Run `npx prisma db push` and `npx prisma generate`

### Add a new page
1. Create folder in `src/app/your-page/`
2. Add `page.tsx` — use `"use client"` directive if it needs interactivity
3. Add navigation link in `src/app/layout.tsx`

## Infrastructure

Terraform modules are in `terraform/modules/`. Each module is self-contained with its own variables and outputs. The production environment config is in `terraform/environments/prod/main.tf`.

To add new infrastructure, create a module and wire it into the environment config. Never put secrets in `.tf` files — use variables with `sensitive = true`.
