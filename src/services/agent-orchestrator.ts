/**
 * Agent Orchestrator
 *
 * Manages the lifecycle of sandboxed AI agent workers:
 *   1. Receives job from BullMQ queue
 *   2. Provisions an isolated container (Docker / ECS Fargate)
 *   3. Injects the prompt + model config into the sandbox
 *   4. Streams logs back to the database
 *   5. Collects results and tears down the sandbox
 *
 * In local dev, agents run as child processes.
 * In production, agents run as ECS Fargate tasks or Kubernetes jobs.
 */

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

// ─── Configuration ───────────────────────────────────────────────────

export interface AgentConfig {
  jobId: string;
  ideaId: string;
  jobType: string;
  prompt: string;
  model: string;
  aiBaseUrl: string;
  aiApiKey: string;
  timeoutSeconds: number;
}

export interface AgentResult {
  success: boolean;
  data: unknown;
  logs: string[];
  durationMs: number;
  tokensUsed?: number;
}

// ─── Redis connection ────────────────────────────────────────────────

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// ─── Queues ──────────────────────────────────────────────────────────

export const agentQueue = new Queue("agent-jobs", { connection });

/**
 * Enqueue an agent job for async processing.
 */
export async function enqueueAgentJob(config: AgentConfig) {
  return agentQueue.add(config.jobType, config, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  });
}

// ─── Sandbox Strategies ──────────────────────────────────────────────

interface SandboxStrategy {
  name: string;
  provision(config: AgentConfig): Promise<string>; // returns containerId
  execute(containerId: string, config: AgentConfig): Promise<AgentResult>;
  teardown(containerId: string): Promise<void>;
}

/**
 * Local strategy — runs the AI call in-process (dev mode).
 */
const localStrategy: SandboxStrategy = {
  name: "local",

  async provision(config) {
    return `local-${config.jobId}`;
  },

  async execute(containerId, config) {
    const startTime = Date.now();
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Starting ${config.jobType} on model ${config.model}`);
    logs.push(`[${new Date().toISOString()}] Sandbox: ${containerId}`);

    try {
      // Dynamic import to avoid circular deps
      const { aiComplete } = await import("../lib/ai");
      const result = await aiComplete(config.prompt);

      logs.push(`[${new Date().toISOString()}] AI call completed successfully`);

      return {
        success: true,
        data: result,
        logs,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logs.push(`[${new Date().toISOString()}] ERROR: ${msg}`);

      return {
        success: false,
        data: null,
        logs,
        durationMs: Date.now() - startTime,
      };
    }
  },

  async teardown() {
    // no-op in local mode
  },
};

/**
 * Docker strategy — spins up an isolated container per job.
 * Used for staging / self-hosted production.
 */
const dockerStrategy: SandboxStrategy = {
  name: "docker",

  async provision(config) {
    const { execSync } = await import("child_process");
    const image = process.env.AGENT_SANDBOX_IMAGE || "ghcr.io/ai-idea-hub/agent-sandbox:latest";

    const containerId = execSync(
      `docker run -d --rm \
        --memory=512m --cpus=1 \
        --network=agent-net \
        -e AI_BASE_URL="${config.aiBaseUrl}" \
        -e AI_API_KEY="${config.aiApiKey}" \
        -e AI_MODEL="${config.model}" \
        -e JOB_ID="${config.jobId}" \
        -e JOB_TYPE="${config.jobType}" \
        --name agent-${config.jobId} \
        ${image}`,
      { encoding: "utf-8" }
    ).trim();

    return containerId;
  },

  async execute(containerId, config) {
    const { execSync } = await import("child_process");
    const startTime = Date.now();
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Container ${containerId.slice(0, 12)} provisioned`);

    try {
      // Write the prompt into the container
      execSync(
        `docker exec ${containerId} sh -c 'cat > /tmp/prompt.txt << "PROMPT_EOF"\n${config.prompt}\nPROMPT_EOF'`
      );

      // Execute the agent script inside the container
      const output = execSync(
        `docker exec ${containerId} python /app/agent.py --prompt /tmp/prompt.txt --timeout ${config.timeoutSeconds}`,
        { encoding: "utf-8", timeout: (config.timeoutSeconds + 30) * 1000 }
      );

      const result = JSON.parse(output);
      logs.push(`[${new Date().toISOString()}] Agent completed in container`);

      return {
        success: true,
        data: result,
        logs,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      logs.push(`[${new Date().toISOString()}] Container ERROR: ${msg}`);

      return {
        success: false,
        data: null,
        logs,
        durationMs: Date.now() - startTime,
      };
    }
  },

  async teardown(containerId) {
    const { execSync } = await import("child_process");
    try {
      execSync(`docker stop ${containerId}`, { timeout: 10000 });
    } catch {
      // container may have already stopped
    }
  },
};

/**
 * ECS Fargate strategy — launches tasks on AWS.
 * Used for production cloud deployment.
 */
const ecsFargateStrategy: SandboxStrategy = {
  name: "ecs-fargate",

  async provision(config) {
    // In production, this calls AWS SDK to run a Fargate task
    // The task definition is managed by Terraform (see /terraform)
    const { ECSClient, RunTaskCommand } = await import("@aws-sdk/client-ecs");

    const ecs = new ECSClient({ region: process.env.AWS_REGION || "eu-north-1" });

    const result = await ecs.send(
      new RunTaskCommand({
        cluster: "ideahub-agents",
        taskDefinition: "ideahub-agent-sandbox",
        launchType: "FARGATE",
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: (process.env.AGENT_SUBNETS || "").split(","),
            securityGroups: (process.env.AGENT_SECURITY_GROUPS || "").split(","),
            assignPublicIp: "DISABLED",
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: "agent",
              environment: [
                { name: "AI_BASE_URL", value: config.aiBaseUrl },
                { name: "AI_API_KEY", value: config.aiApiKey },
                { name: "AI_MODEL", value: config.model },
                { name: "JOB_ID", value: config.jobId },
                { name: "JOB_TYPE", value: config.jobType },
                { name: "PROMPT", value: config.prompt },
              ],
            },
          ],
        },
        tags: [
          { key: "ideaId", value: config.ideaId },
          { key: "jobId", value: config.jobId },
        ],
      })
    );

    const taskArn = result.tasks?.[0]?.taskArn || "";
    return taskArn;
  },

  async execute(taskArn, config) {
    // In production, the Fargate task pushes results to S3/SQS
    // The worker polls for completion
    const startTime = Date.now();
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Fargate task launched: ${taskArn}`);
    logs.push(`[${new Date().toISOString()}] Waiting for task completion...`);

    // TODO: implement polling for task completion via ECS waiter
    // For MVP, this is a placeholder
    return {
      success: true,
      data: { message: "Fargate execution — results delivered via S3" },
      logs,
      durationMs: Date.now() - startTime,
    };
  },

  async teardown(taskArn) {
    if (!taskArn) return;

    const { ECSClient, StopTaskCommand } = await import("@aws-sdk/client-ecs");
    const ecs = new ECSClient({ region: process.env.AWS_REGION || "eu-north-1" });

    try {
      await ecs.send(
        new StopTaskCommand({
          cluster: "ideahub-agents",
          task: taskArn,
          reason: "Job completed or timed out",
        })
      );
    } catch {
      // task may have already stopped
    }
  },
};

// ─── Strategy selection ──────────────────────────────────────────────

export function getSandboxStrategy(): SandboxStrategy {
  const env = process.env.AGENT_SANDBOX_MODE || "local";

  switch (env) {
    case "docker":
      return dockerStrategy;
    case "ecs":
    case "fargate":
      return ecsFargateStrategy;
    default:
      return localStrategy;
  }
}

// ─── Export for worker ───────────────────────────────────────────────

export { connection };
