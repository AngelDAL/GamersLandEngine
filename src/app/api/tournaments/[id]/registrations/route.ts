import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { userId: targetId, teamId } = body;

  // If no target userId, user is registering themselves
  const userId = targetId || session.user.id;
  const isAdmin = role === "ADMIN" || role === "ORGANIZER";

  // Only admins can register OTHER people
  if (userId !== session.user.id && !isAdmin) {
    return NextResponse.json({ error: "No puedes registrar a otro jugador" }, { status: 403 });
  }

  const existing = await prisma.tournamentRegistration.findUnique({
    where: { tournamentId_userId: { tournamentId: id, userId } },
  });

  if (existing) {
    return NextResponse.json({ error: "El jugador ya está registrado" }, { status: 409 });
  }

  const registration = await prisma.tournamentRegistration.create({
    data: {
      tournamentId: id,
      userId,
      teamId,
      status: "CONFIRMED",
      registeredBy: session.user.id,
    },
  });

  return NextResponse.json(registration, { status: 201 });
}
