import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    user,
    qrData: userId,
  });
}
