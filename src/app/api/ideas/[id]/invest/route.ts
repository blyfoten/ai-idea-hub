import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const InvestSchema = z.object({
  amount: z.number().positive().max(1000),
});

// POST /api/ideas/:id/invest — invest credits into an idea
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount } = InvestSchema.parse(body);

    if (user.credits < amount) {
      return NextResponse.json(
        { error: "Insufficient credits", available: user.credits },
        { status: 402 }
      );
    }

    const idea = await prisma.idea.findUnique({ where: { id: params.id } });
    if (!idea) {
      return NextResponse.json({ error: "Idea not found" }, { status: 404 });
    }

    // Platform fee: 10% goes back to fund new users
    const platformFee = amount * 0.1;
    const investedAmount = amount - platformFee;

    // Run as transaction
    const result = await prisma.$transaction(async (tx) => {
      // Debit user credits
      await tx.user.update({
        where: { id: user.id },
        data: { credits: { decrement: amount } },
      });

      // Record investment
      const investment = await tx.investment.create({
        data: {
          amount: investedAmount,
          userId: user.id,
          ideaId: params.id,
        },
      });

      // Update idea total
      await tx.idea.update({
        where: { id: params.id },
        data: { totalInvested: { increment: investedAmount } },
      });

      // Record transactions
      await tx.creditTransaction.createMany({
        data: [
          {
            amount: -amount,
            type: "INVESTMENT",
            description: `Invested in: ${idea.title}`,
            userId: user.id,
          },
          {
            amount: platformFee,
            type: "PLATFORM_FEE",
            description: `Platform fee from investment in: ${idea.title}`,
            userId: user.id, // tracked against user but funds go to pool
          },
        ],
      });

      return investment;
    });

    return NextResponse.json({ investment: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
