import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, username: true, avatarUrl: true } },
      organizers: {
        include: { user: { select: { id: true, username: true } } },
      },
      rounds: {
        include: {
          matches: {
            include: {
              winner: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { roundNumber: "asc" },
      },
      prizes: true,
      _count: { select: { registrations: true } },
    },
  });

  if (!tournament) {
    return NextResponse.json({ error: "Torneo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(tournament);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const data = await req.json();

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.game && { game: data.game }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.entryFee !== undefined && { entryFee: data.entryFee }),
      ...(data.maxTeams && { maxTeams: data.maxTeams }),
      ...(data.minTeams && { minTeams: data.minTeams }),
      ...(data.bracketType && { bracketType: data.bracketType }),
      ...(data.status && { status: data.status }),
      ...(data.eventDate && { eventDate: new Date(data.eventDate) }),
      ...(data.registrationDeadline !== undefined && {
        registrationDeadline: data.registrationDeadline ? new Date(data.registrationDeadline) : null,
      }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.rules !== undefined && { rules: data.rules }),
    },
  });

  return NextResponse.json(tournament);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  await prisma.tournament.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
