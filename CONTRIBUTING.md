# Contributing to AI Idea Hub

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### Getting Started

```bash
# Clone the repo
git clone https://github.com/blyfoten/ai-idea-hub.git
cd ai-idea-hub

# Install dependencies
npm install

# Copy environment config
cp .env.example .env

# Start infrastructure (Postgres, Redis, Ollama)
docker compose up postgres redis ollama -d

# Pull an AI model (first time)
docker exec -it ai-idea-hub-ollama-1 ollama pull llama3.1:8b

# Push database schema
npx prisma db push

# Start the dev server
npm run dev

# In a separate terminal, start the agent worker
npm run agents:worker
```

The app is available at http://localhost:3000.

## Making Changes

### Branch Naming

- `feat/short-description` — new features
- `fix/short-description` — bug fixes
- `infra/short-description` — infrastructure changes
- `docs/short-description` — documentation only

### Commit Messages

Use imperative mood and keep them concise:

```
Add semantic search for ideas
Fix credit deduction race condition
Update ECS task definition memory limits
```

### Code Style

- TypeScript with strict mode
- Tailwind CSS for styling (no custom CSS unless necessary)
- Zod for all API input validation
- Use the `@/` import alias for anything under `src/`
- Prefer named exports over default exports (except for page components)

### Pull Requests

1. Create a branch from `main`
2. Make your changes
3. Ensure `npm run build` passes
4. Write a clear PR description explaining what and why
5. Link any related issues

## Project Areas

Here's where to look depending on what you want to work on:

| Area | Location | Notes |
|------|----------|-------|
| Frontend pages | `src/app/` | Next.js App Router pages |
| API endpoints | `src/app/api/` | REST route handlers |
| Database schema | `prisma/schema.prisma` | Run `prisma db push` after changes |
| AI prompts | `src/lib/ai.ts` | Prompt templates for agent tasks |
| Agent system | `src/services/` | Orchestrator + worker |
| Infrastructure | `terraform/` | Modular Terraform configs |
| Agent container | `docker/agent-sandbox/` | Isolated execution environment |

## Reporting Issues

When opening an issue, please include:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Environment details (OS, Node version, browser)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
