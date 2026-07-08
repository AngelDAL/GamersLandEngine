import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { roundId } = await params;
  const body = await req.json();
  const bracketPosition = body.bracketPosition ?? 0;

  const match = await prisma.match.create({
    data: {
      roundId,
      bracketPosition,
      status: "PENDING",
    },
  });

  return NextResponse.json(match, { status: 201 });
}
