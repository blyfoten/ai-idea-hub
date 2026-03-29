import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const CreateIdeaSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(20).max(5000),
  tags: z.array(z.string()).default([]),
});

// GET /api/ideas — list & search ideas
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const status = searchParams.get("status");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { description: { contains: query, mode: "insensitive" } },
      { tags: { hasSome: [query.toLowerCase()] } },
    ];
  }

  if (status) {
    where.status = status;
  }

  const [ideas, total] = await Promise.all([
    prisma.idea.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { investments: true, agentJobs: true } },
      },
      orderBy: { totalInvested: "desc" },
      skip,
      take: limit,
    }),
    prisma.idea.count({ where }),
  ]);

  return NextResponse.json({
    ideas,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// POST /api/ideas — create a new idea
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, description, tags } = CreateIdeaSchema.parse(body);

    // Check for duplicate ideas (basic text similarity)
    const similar = await prisma.idea.findFirst({
      where: {
        title: { contains: title.split(" ").slice(0, 3).join(" "), mode: "insensitive" },
      },
    });

    if (similar) {
      return NextResponse.json(
        {
          error: "A similar idea already exists",
          existingIdea: { id: similar.id, title: similar.title },
        },
        { status: 409 }
      );
    }

    const idea = await prisma.idea.create({
      data: {
        title,
        description,
        tags: tags.map((t) => t.toLowerCase()),
        authorId: user.id,
        status: "DRAFT",
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ idea }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
