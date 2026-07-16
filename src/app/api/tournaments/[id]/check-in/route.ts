import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  // Find the user's registration for this tournament
  const reg = await prisma.tournamentRegistration.findUnique({
    where: {
      tournamentId_userId: { tournamentId: id, userId: session.user.id },
    },
    include: { tournament: { select: { status: true, eventDate: true } } },
  });

  if (!reg) {
    return NextResponse.json({ error: "No estás registrado en este torneo" }, { status: 404 });
  }

  if (reg.status !== "CONFIRMED") {
    return NextResponse.json({ error: "Tu registro no está confirmado" }, { status: 400 });
  }

  if (reg.checkedInAt) {
    return NextResponse.json({ error: "Ya hiciste check-in" }, { status: 409 });
  }

  // Only allow check-in on the day of the event
  if (reg.tournament.eventDate) {
    const today = new Date();
    const eventDay = new Date(reg.tournament.eventDate);
    const isSameDay =
      today.getFullYear() === eventDay.getFullYear() &&
      today.getMonth() === eventDay.getMonth() &&
      today.getDate() === eventDay.getDate();

    if (!isSameDay) {
      return NextResponse.json(
        { error: "Check-in disponible solo el día del evento" },
        { status: 400 }
      );
    }
  }

  // Update: mark as checked in
  const updated = await prisma.tournamentRegistration.update({
    where: { id: reg.id },
    data: { checkedInAt: new Date() },
  });

  return NextResponse.json(updated);
}
