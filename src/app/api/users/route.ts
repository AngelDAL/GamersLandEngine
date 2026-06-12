import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { username, role } = await req.json();

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "El nombre de usuario ya existe" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { username, role: role || "PLAYER" },
  });

  return NextResponse.json(user, { status: 201 });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const role = searchParams.get("role");

  const where: any = {};
  if (role) where.role = role;

  if (q) {
    // Try exact ID match first
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(q)) {
      const user = await prisma.user.findUnique({
        where: { id: q },
        select: { id: true, username: true, role: true, avatarUrl: true },
      });
      if (user) {
        return NextResponse.json([user]);
      }
    }
    where.username = { contains: q };
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true, username: true, role: true, avatarUrl: true },
    orderBy: { username: "asc" },
  });

  return NextResponse.json(users);
}
