import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "ORGANIZER") {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const { id } = await params;
  const { userId, teamId } = await req.json();

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
