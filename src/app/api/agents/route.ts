import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET /api/agents — list agent jobs for the current user's ideas
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const ideaId = searchParams.get("ideaId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {
    idea: { authorId: user.id },
  };

  if (ideaId) where.ideaId = ideaId;
  if (status) where.status = status;

  const jobs = await prisma.agentJob.findMany({
    where,
    include: {
      idea: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ jobs });
}
