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

  const [users, existingRegistrations] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, avatarUrl: true },
      orderBy: { username: "asc" },
    }),
    prisma.tournamentRegistration.findMany({
      where: { tournamentId: id },
      select: { userId: true, status: true },
    }),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gold mb-6">Registro rápido</h1>
      <RegisterClient
        tournamentId={tournament.id}
        users={users}
        registeredUserIds={existingRegistrations.map((r) => r.userId)}
      />
    </div>
  );
}
