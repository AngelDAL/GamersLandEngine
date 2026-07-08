import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const team = await prisma.team.findUnique({ where: { id }, select: { captainId: true } });
  if (!team || (team.captainId !== session.user.id && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "No tienes permisos" }, { status: 403 });
  }

  // Delete members, then team
  await prisma.teamMember.deleteMany({ where: { teamId: id } });
  await prisma.team.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
