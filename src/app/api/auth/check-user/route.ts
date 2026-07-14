import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/auth/check-user?username=xxx
 * Returns whether the username exists and if the user needs a password.
 * Used by the login page for the two-step flow.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username || username.trim().length === 0) {
    return NextResponse.json({ exists: false, needsPassword: false });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
    select: { role: true, adminPassword: true },
  });

  if (!user) {
    // New user — will be created as PLAYER, no password needed
    return NextResponse.json({ exists: false, needsPassword: false });
  }

  const needsPassword = user.role === "ADMIN" || user.role === "EXPOSITOR" || user.role === "EJECUTIVO";
  return NextResponse.json({
    exists: true,
    role: user.role,
    needsPassword,
    hasDefault: needsPassword && !user.adminPassword,
  });
}
