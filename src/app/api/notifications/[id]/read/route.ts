import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, roleForbidden } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();

    const { id } = await params;
    // Se carga primero para poder distinguir 404 (no existe) de 403 (ajena):
    // antes el update inexistente reventaba con 500.
    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json(
        { error: "Notificación no encontrada" },
        { status: 404 }
      );
    }
    if (notification.userId !== session.user.id) {
      return roleForbidden();
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[NOTIFICATION READ] Error:", err);
    return NextResponse.json(
      { error: "Error al marcar la notificación" },
      { status: 500 }
    );
  }
}
