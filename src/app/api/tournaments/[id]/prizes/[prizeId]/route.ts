import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { prizeId } = await params;
  const data = await req.json();

  const prize = await prisma.prize.update({ where: { id: prizeId }, data });
  return NextResponse.json(prize);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; prizeId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { prizeId } = await params;
  await prisma.prize.delete({ where: { id: prizeId } });
  return NextResponse.json({ success: true });
}
