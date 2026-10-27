import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "ORGANIZER") {
    return NextResponse.json({ error: "Solo organizadores" }, { status: 403 });
  }

  const { id: tournamentId, regId } = await params;
  const body = await req.json();

  const updateData: Record<string, any> = {};

  // Toggle payment status
  if (typeof body.paid === "boolean") {
    updateData.paid = body.paid;
  }

  // Toggle check-in (manual override by organizer)
  if (body.checkedIn === true) {
    updateData.checkedInAt = new Date();
  } else if (body.checkedIn === false) {
    updateData.checkedInAt = null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const updated = await prisma.tournamentRegistration.update({
    where: { id: regId },
    data: updateData,
  });

  return NextResponse.json(updated);
}
