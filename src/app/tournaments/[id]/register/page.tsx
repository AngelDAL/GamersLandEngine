import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { RegisterClient } from "./RegisterClient";

export default async function RegisterPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "ORGANIZER")) {
    redirect("/auth/login");
  }

  const { id } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    select: { id: true, name: true, game: true },
  });

  if (!tournament) notFound();

  const users = await prisma.user.findMany({
    select: { id: true, username: true, avatarUrl: true },
    orderBy: { username: "asc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gold mb-2">Registro Rápido</h1>
      <p className="text-muted text-sm mb-6">Registra jugadores al torneo: {tournament.name}</p>
      <RegisterClient tournamentId={tournament.id} users={users} />
    </div>
  );
}
