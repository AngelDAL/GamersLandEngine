import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { userId } = await req.json();

  const organizer = await prisma.tournamentOrganizer.create({
    data: { tournamentId: id, userId },
  });

  return NextResponse.json(organizer, { status: 201 });
}
