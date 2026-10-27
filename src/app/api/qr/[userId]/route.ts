import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole, roleForbidden } from "@/lib/permissions";

/** GET /api/qr/[userId] — datos del QR de un jugador. Solo staff (antes era anónimo). */
export async function GET(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await requireAuth();
    if (!requireRole(session, ["ADMIN", "ORGANIZER", "SPONSOR"])) {
      return roleForbidden();
    }

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
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[QR GET] Error:", err);
    return NextResponse.json({ error: "Error al obtener el código" }, { status: 500 });
  }
}
