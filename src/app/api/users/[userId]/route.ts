import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId } = await params;
  const data = await req.json();

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.role && { role: data.role }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
    },
  });

  return NextResponse.json({ id: user.id, username: user.username, role: user.role });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { userId } = await params;
  await prisma.user.delete({ where: { id: userId } });
  return NextResponse.json({ success: true });
}
