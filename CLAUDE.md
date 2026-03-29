# CLAUDE.md — Context for Claude Code

## What is this project?

AI Idea Hub — a full-stack platform where users submit startup/product ideas, AI agents validate them (market research, competitor analysis, technical roadmap), and the community invests credits to fund further AI-driven development in sandboxed cloud environments.

## Quick Reference

```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run agents:worker    # Start BullMQ agent worker
npx prisma db push       # Sync schema to database
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Visual database browser
docker compose up -d     # Start all local services
```

## Architecture Decisions

- **Next.js App Router** over Pages Router — server components by default, `"use client"` only when needed
- **Prisma** over raw SQL — type safety and migration management
- **BullMQ** over polling — reliable job queue with retries and rate limiting
- **OpenAI-compatible API** over vendor-specific SDKs — swap models by changing env vars
- **Terraform** over CDK — wider ecosystem, team-agnostic, declarative
- **Fargate** over EC2 — no server management, pay-per-use for agent sandboxes

## Important: Credit Operations

All credit changes MUST use Prisma `$transaction` to prevent race conditions. Every credit movement must create a `CreditTransaction` record. Never modify `User.credits` without a corresponding transaction record.

## Important: Agent Sandbox Security

Agent containers run with all Linux capabilities dropped, limited memory (512MB), noexec tmpfs, and isolated networking. Never add `NET_ADMIN`, `SYS_ADMIN`, or other privileged capabilities to sandbox containers.

## Environment

The project needs PostgreSQL, Redis, and an AI model endpoint. For local dev, `docker compose up` handles all of these (including Ollama for local models). See `.env.example` for all config options.
