import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { aiComplete, PROMPTS } from "@/lib/ai";

// POST /api/ideas/:id/validate — trigger AI validation pipeline
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idea = await prisma.idea.findUnique({ where: { id: params.id } });
  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  if (idea.authorId !== user.id) {
    return NextResponse.json({ error: "Only the author can validate" }, { status: 403 });
  }

  // Cost: $1.50 in credits for full validation
  const validationCost = 1.5;
  if (user.credits < validationCost) {
    return NextResponse.json(
      { error: "Insufficient credits", required: validationCost, available: user.credits },
      { status: 402 }
    );
  }

  // Mark as validating
  await prisma.idea.update({
    where: { id: params.id },
    data: { status: "VALIDATING" },
  });

  // Debit credits
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { credits: { decrement: validationCost } },
    }),
    prisma.creditTransaction.create({
      data: {
        amount: -validationCost,
        type: "AGENT_USAGE",
        description: `AI validation for: ${idea.title}`,
        userId: user.id,
      },
    }),
  ]);

  // Create agent jobs for each validation step
  const jobTypes = [
    { type: "MARKET_RESEARCH" as const, prompt: PROMPTS.marketResearch(idea.title, idea.description) },
    { type: "COMPETITOR_ANALYSIS" as const, prompt: PROMPTS.competitorAnalysis(idea.title, idea.description) },
    { type: "TECHNICAL_ROADMAP" as const, prompt: PROMPTS.technicalRoadmap(idea.title, idea.description) },
  ];

  const jobs = await Promise.all(
    jobTypes.map((jt) =>
      prisma.agentJob.create({
        data: {
          type: jt.type,
          prompt: jt.prompt,
          ideaId: params.id,
          creditsUsed: validationCost / jobTypes.length,
        },
      })
    )
  );

  // Run AI validation in background (non-blocking)
  runValidation(params.id, jobs.map((j) => j.id)).catch(console.error);

  return NextResponse.json({
    message: "Validation started",
    jobs: jobs.map((j) => ({ id: j.id, type: j.type, status: j.status })),
  });
}

async function runValidation(ideaId: string, jobIds: string[]) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
  if (!idea) return;

  const results: Record<string, unknown> = {};

  for (const jobId of jobIds) {
    const job = await prisma.agentJob.findUnique({ where: { id: jobId } });
    if (!job) continue;

    await prisma.agentJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      const result = await aiComplete(job.prompt);
      results[job.type] = result;

      await prisma.agentJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          result: result as any,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      await prisma.agentJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          logs: [`Error: ${err instanceof Error ? err.message : "Unknown error"}`],
          completedAt: new Date(),
        },
      });
    }
  }

  // Update idea with results
  await prisma.idea.update({
    where: { id: ideaId },
    data: {
      status: "VALIDATED",
      marketResearch: (results.MARKET_RESEARCH as any) ?? undefined,
      competitors: (results.COMPETITOR_ANALYSIS as any) ?? undefined,
      technicalPlan: (results.TECHNICAL_ROADMAP as any) ?? undefined,
    },
  });
}
