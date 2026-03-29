/**
 * Agent Worker Process
 *
 * Run separately from the web server:
 *   npm run agents:worker
 *
 * Consumes jobs from the BullMQ queue and dispatches them
 * to the appropriate sandbox strategy (local / Docker / ECS).
 */

import { Worker } from "bullmq";
import { prisma } from "../lib/db";
import {
  AgentConfig,
  connection,
  getSandboxStrategy,
} from "./agent-orchestrator";

const MAX_CONCURRENT = parseInt(process.env.AGENT_MAX_CONCURRENT || "5");

console.log("🤖 Agent Worker starting...");
console.log(`   Strategy: ${getSandboxStrategy().name}`);
console.log(`   Max concurrent: ${MAX_CONCURRENT}`);
console.log(`   Redis: ${process.env.REDIS_URL || "redis://localhost:6379"}`);

const worker = new Worker<AgentConfig>(
  "agent-jobs",
  async (job) => {
    const config = job.data;
    const strategy = getSandboxStrategy();

    console.log(
      `\n📋 Job ${config.jobId} [${config.jobType}] — using ${strategy.name} strategy`
    );

    // Update job status in DB
    await prisma.agentJob.update({
      where: { id: config.jobId },
      data: { status: "PROVISIONING" },
    });

    let containerId: string | null = null;

    try {
      // Step 1: Provision sandbox
      containerId = await strategy.provision(config);
      console.log(`   ✅ Sandbox provisioned: ${containerId.slice(0, 20)}`);

      await prisma.agentJob.update({
        where: { id: config.jobId },
        data: {
          status: "RUNNING",
          containerId,
          startedAt: new Date(),
        },
      });

      // Step 2: Execute the job
      const result = await strategy.execute(containerId, config);

      // Step 3: Store results
      await prisma.agentJob.update({
        where: { id: config.jobId },
        data: {
          status: result.success ? "COMPLETED" : "FAILED",
          result: result.data as any,
          logs: result.logs,
          completedAt: new Date(),
        },
      });

      // Step 4: Update idea with results if applicable
      if (result.success) {
        const fieldMap: Record<string, string> = {
          MARKET_RESEARCH: "marketResearch",
          COMPETITOR_ANALYSIS: "competitors",
          TECHNICAL_ROADMAP: "technicalPlan",
        };

        const field = fieldMap[config.jobType];
        if (field) {
          await prisma.idea.update({
            where: { id: config.ideaId },
            data: { [field]: result.data as any },
          });
        }
      }

      console.log(
        `   ${result.success ? "✅" : "❌"} Job ${config.jobId} finished in ${result.durationMs}ms`
      );

      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`   ❌ Job ${config.jobId} failed: ${msg}`);

      await prisma.agentJob.update({
        where: { id: config.jobId },
        data: {
          status: "FAILED",
          logs: [`Fatal error: ${msg}`],
          completedAt: new Date(),
        },
      });

      throw err;
    } finally {
      // Step 5: Always tear down the sandbox
      if (containerId) {
        await strategy.teardown(containerId);
      }
    }
  },
  {
    connection,
    concurrency: MAX_CONCURRENT,
    limiter: {
      max: 10,
      duration: 60000, // max 10 jobs per minute
    },
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("🛑 Shutting down worker...");
  await worker.close();
  process.exit(0);
});

console.log("🤖 Agent Worker ready — waiting for jobs...\n");
