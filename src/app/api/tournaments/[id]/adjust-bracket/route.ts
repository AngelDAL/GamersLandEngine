import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { maxTeams, minTeams } = await req.json();

  const tournament = await prisma.tournament.update({
    where: { id },
    data: {
      ...(maxTeams && { maxTeams }),
      ...(minTeams && { minTeams }),
    },
  });

  return NextResponse.json(tournament);
}
