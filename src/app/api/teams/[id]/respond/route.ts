import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { accept } = await req.json();

  // Find the user's pending membership in this team
  const membership = await prisma.teamMember.findFirst({
    where: { teamId: id, userId: session.user.id, status: "PENDING" },
  });

  if (!membership) {
    return NextResponse.json({ error: "No tienes una invitación pendiente para este equipo" }, { status: 404 });
  }

  const newStatus = accept ? "ACTIVE" : "REJECTED";

  await prisma.teamMember.update({
    where: { id: membership.id },
    data: { status: newStatus },
  });

  // Create notification for the captain
  const team = await prisma.team.findUnique({
    where: { id },
    select: { captainId: true, name: true },
  });

  if (team) {
    const actionText = accept ? "aceptado" : "rechazado";
    await prisma.notification.create({
      data: {
        userId: team.captainId,
        type: "team_response",
        title: `Invitación ${actionText}a`,
        message: `${session.user.name} ha ${actionText} tu invitación para unirse a "${team.name}".`,
        redirectUrl: `/teams/${id}`,
      },
    });
  }

  return NextResponse.json({ status: newStatus });
}
