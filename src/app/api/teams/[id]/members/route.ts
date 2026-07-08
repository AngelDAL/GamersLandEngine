import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { userId, message } = await req.json();
  const team = await prisma.team.findUnique({
    where: { id },
    select: { captainId: true, name: true },
  });
  if (!team || (team.captainId !== session.user.id && session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  const isAdminOrOrganizer = session.user.role === "ADMIN" || session.user.role === "ORGANIZER";
  // Admins/organizers add directly as ACTIVE; others send PENDING invitation
  const newStatus = isAdminOrOrganizer ? "ACTIVE" : "PENDING";

  // Check if user already has a membership in this team
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: id } },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      return NextResponse.json({ error: "El usuario ya es miembro del equipo" }, { status: 409 });
    }
    await prisma.teamMember.update({
      where: { id: existing.id },
      data: { status: newStatus, message: message || null },
    });
  } else {
    await prisma.teamMember.create({
      data: { userId, teamId: id, status: newStatus, message: message || null },
    });
  }

  if (!isAdminOrOrganizer) {
    // Only send notification for PENDING invitations
    await prisma.notification.create({
      data: {
        userId,
        type: "team_invite",
        title: `Invitación a ${team.name}`,
        message: `${session.user.name} te ha invitado a unirte al equipo "${team.name}".${message ? `\nMensaje: ${message}` : ""}`,
        redirectUrl: `/teams/${id}`,
      },
    });
  }

  return NextResponse.json({ success: true, status: newStatus });
}
