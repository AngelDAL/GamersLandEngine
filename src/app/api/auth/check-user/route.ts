import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/check-user?username=xxx
 * Indica si el usuario existe y si necesita contraseña.
 * Todos los usuarios necesitan contraseña — el viejo criterio por rol quedó
 * obsoleto cuando todos las cuentas pasaron a tener passwordHash.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username || username.trim().length === 0) {
    return NextResponse.json({ exists: false, needsPassword: true });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    select: { role: true },
  });

  if (!user) {
    return NextResponse.json({ exists: false, needsPassword: true });
  }

  return NextResponse.json({
    exists: true,
    role: user.role,
    needsPassword: true,
  });
}
