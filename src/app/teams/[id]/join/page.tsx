import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { JoinClient } from "./JoinClient";
import { Users, Shield, Trophy } from "lucide-react";

export default async function JoinTeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      captain: { select: { id: true, username: true, avatarUrl: true } },
      members: {
        where: { status: "ACTIVE" },
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
      },
      participations: {
        include: {
          tournament: { select: { id: true, name: true, game: true, eventDate: true } },
        },
        take: 1,
      },
    },
  });

  if (!team) notFound();

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-b from-background via-background to-gold/5">
      <div className="max-w-lg w-full">
        {/* Invite card */}
        <Card className="p-6 sm:p-8 text-center border-gold/20">
          {/* Team avatar */}
          <div className="w-20 h-20 rounded-3xl bg-gold/10 flex items-center justify-center text-gold text-3xl font-black mx-auto mb-4 ring-4 ring-gold/20">
            {team.name[0].toUpperCase()}
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-1">
            {team.name}
          </h1>

          <p className="text-muted text-sm flex items-center justify-center gap-1.5 mb-6">
            <Shield className="w-3.5 h-3.5 text-gold" />
            Capitán: {team.captain.username}
          </p>

          {/* Tournament info */}
          {team.participations[0] && (
            <div className="bg-gold/5 border border-gold/10 rounded-xl p-3 mb-6 inline-flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-gold" />
              <span className="text-muted">Torneo: </span>
              <span className="font-bold text-foreground">{team.participations[0].tournament.name}</span>
            </div>
          )}

          {/* Members */}
          <div className="mb-6">
            <h2 className="text-xs font-bold text-gold uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
              <Users className="w-3.5 h-3.5" />
              Miembros ({team.members.length})
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {team.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface border border-border rounded-full text-xs"
                >
                  <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[8px] font-bold">
                    {m.user.username[0].toUpperCase()}
                  </div>
                  <span className="font-medium truncate max-w-[80px]">{m.user.username}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Join client */}
          <JoinClient teamId={team.id} teamName={team.name} />
        </Card>
      </div>
    </div>
  );
}
