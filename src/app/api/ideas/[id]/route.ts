import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/ideas/:id — get idea detail
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idea = await prisma.idea.findUnique({
    where: { id: params.id },
    include: {
      author: { select: { id: true, name: true } },
      investments: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { amount: "desc" },
        take: 20,
      },
      agentJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      _count: { select: { investments: true, agentJobs: true } },
    },
  });

  if (!idea) {
    return NextResponse.json({ error: "Idea not found" }, { status: 404 });
  }

  return NextResponse.json({ idea });
}
