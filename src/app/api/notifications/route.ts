import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireAuth();

    // Siempre filtrado por el dueño de la sesión: sin esto un usuario veía
    // notificaciones ajenas solo por conocer el listado.
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, read: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[NOTIFICATIONS GET] Error:", err);
    return NextResponse.json(
      { error: "Error al obtener las notificaciones" },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  try {
    const session = await requireAuth();

    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[NOTIFICATIONS PATCH] Error:", err);
    return NextResponse.json(
      { error: "Error al actualizar las notificaciones" },
      { status: 500 }
    );
  }
}
