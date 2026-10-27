import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const userId = session.user.id;
  const { message } = await req.json();

  // Check team exists and get captain info
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, captainId: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Can't request to join your own team as captain
  if (team.captainId === userId) {
    return NextResponse.json({ error: "Eres el capitán de este equipo" }, { status: 400 });
  }

  // Check existing membership
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });

  if (existing) {
    if (existing.status === "PENDING" || existing.status === "REQUEST") {
      return NextResponse.json(
        { error: "Ya tienes una solicitud pendiente en este equipo" },
        { status: 409 }
      );
    }
    if (existing.status === "ACTIVE") {
      return NextResponse.json(
        { error: "Ya eres miembro" },
        { status: 409 }
      );
    }
    if (existing.status === "REJECTED") {
      // Re-activate the request
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { status: "REQUEST", message: message || null },
      });

      // Create notification for the captain
      await prisma.notification.create({
        data: {
          userId: team.captainId,
          type: "team_request",
          title: "Solicitud de unión",
          message: `${session.user.name || "Alguien"} quiere unirse a tu equipo`,
          redirectUrl: `/teams/${teamId}`,
        },
      });

      return NextResponse.json({ success: true, message: "Solicitud enviada nuevamente" });
    }
  }

  // Create new membership as REQUEST (captain needs to accept)
  await prisma.teamMember.create({
    data: {
      userId,
      teamId,
      status: "REQUEST",
      message: message || null,
    },
  });

  // Create notification for the team captain
  await prisma.notification.create({
    data: {
      userId: team.captainId,
      type: "team_request",
      title: "Solicitud de unión",
      message: `${session.user.name || "Alguien"} quiere unirse a tu equipo`,
      redirectUrl: `/teams/${teamId}`,
    },
  });

  return NextResponse.json({ success: true, message: "Solicitud enviada al capitán" });
}
