import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Debes iniciar sesión para unirte a un equipo" }, { status: 401 });
  }

  const { id: teamId } = await params;
  const userId = session.user.id;

  // Check team exists
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { id: true, name: true, captainId: true },
  });
  if (!team) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  // Can't join your own team as captain
  if (team.captainId === userId) {
    return NextResponse.json({ error: "Eres el capitán de este equipo" }, { status: 400 });
  }

  // Check existing membership
  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (existing) {
    if (existing.status === "ACTIVE") {
      return NextResponse.json({ error: "Ya eres miembro de este equipo" }, { status: 409 });
    }
    if (existing.status === "PENDING" || existing.status === "REQUEST") {
      return NextResponse.json({ error: "Ya tienes una invitación o solicitud pendiente. Acéptala o recházala primero." }, { status: 409 });
    }
    if (existing.status === "REJECTED") {
      // Allow re-joining if previously rejected, update the record
      await prisma.teamMember.update({
        where: { id: existing.id },
        data: { status: "ACTIVE" },
      });
      return NextResponse.json({ success: true, message: "Te has unido al equipo" });
    }
  }

  // Create member as ACTIVE (direct join via invite link)
  await prisma.teamMember.create({
    data: {
      userId,
      teamId,
      status: "ACTIVE",
    },
  });

  return NextResponse.json({ success: true, message: "Te has unido al equipo" });
}
