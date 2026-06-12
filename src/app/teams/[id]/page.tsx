import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamClient } from "./TeamClient";
import { TeamChat } from "@/components/chat/TeamChat";
import {
  Users, Shield, CheckCircle, XCircle, UserPlus,
  MessageSquare, Clock, ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const { id } = await params;
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      captain: { select: { id: true, username: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, username: true, avatarUrl: true } } },
        orderBy: { status: "asc" },
      },
    },
  });

  if (!team) notFound();

  const isCaptain = team.captainId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  const isMember = team.members.some((m) => m.userId === session.user.id && m.status === "ACTIVE");
  const canManage = isCaptain || isAdmin;

  const activeMembers = team.members.filter((m) => m.status === "ACTIVE");
  const pendingMembers = team.members.filter((m) => m.status === "PENDING");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/tournaments" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-6">
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver a torneos
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center text-gold text-xl font-black shrink-0">
          {team.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-black text-foreground">{team.name}</h1>
          <p className="text-muted text-sm flex items-center gap-1.5 mt-1">
            <Shield className="w-3.5 h-3.5 text-gold" />
            Capitán: {team.captain.username}
            {isCaptain && <Badge variant="gold" className="ml-1">Eres el líder</Badge>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Members */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" />
              Miembros ({activeMembers.length})
            </h2>
            {activeMembers.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">Sin miembros activos</p>
            ) : (
              <div className="space-y-2">
                {activeMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                        {m.user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{m.user.username}</span>
                        {m.user.id === team.captainId && (
                          <Badge variant="gold" className="ml-2 text-[10px]">Líder</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Pending applications */}
          {canManage && pendingMembers.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                Solicitudes pendientes ({pendingMembers.length})
              </h2>
              <div className="space-y-2">
                {pendingMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold">
                        {m.user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{m.user.username}</p>
                        <p className="text-xs text-muted">{m.message || "Sin mensaje"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <PendingAction
                        memberId={m.id}
                        teamId={id}
                        action="ACCEPT"
                        icon={<CheckCircle className="w-4 h-4" />}
                        label="Aceptar"
                        variant="green"
                      />
                      <PendingAction
                        memberId={m.id}
                        teamId={id}
                        action="REJECTED"
                        icon={<XCircle className="w-4 h-4" />}
                        label="Rechazar"
                        variant="red"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Chat - only for members */}
          {isMember && (
            <Card>
              <TeamChat teamId={id} userId={session.user.id} />
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {canManage && <TeamClient teamId={id} />}

          <Card>
            <h2 className="text-sm font-bold text-gold flex items-center gap-2 mb-3">
              <Users className="w-4 h-4" />
              Estadísticas
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Miembros activos</span>
                <span className="font-bold">{activeMembers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Solicitudes</span>
                <span className="font-bold">{pendingMembers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Cupos disponibles</span>
                <span className="font-bold">{Math.max(0, 5 - activeMembers.length)}</span>
              </div>
            </div>
          </Card>

          {isMember && !isCaptain && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (confirm("¿Salir del equipo?")) {
                  await fetch(`/api/teams/${id}/leave`, { method: "POST" });
                  window.location.href = "/tournaments";
                }
              }}
            >
              <button type="submit" className="w-full py-2.5 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors">
                Salir del equipo
              </button>
            </form>
          )}

          {isCaptain && activeMembers.length > 1 && (
            <Card>
              <h2 className="text-sm font-bold text-gold mb-3">Transferir capitanía</h2>
              <CaptainTransfer
                teamId={id}
                members={activeMembers.filter((m) => m.user.id !== session.user.id).map((m) => ({ id: m.user.id, username: m.user.username }))}
              />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CaptainTransfer({ teamId, members }: { teamId: string; members: { id: string; username: string }[] }) {
  return (
    <div className="space-y-1">
      {members.map((m) => (
        <form
          key={m.id}
          onSubmit={async (e) => {
            e.preventDefault();
            if (confirm(`¿Transferir capitanía a ${m.username}?`)) {
              await fetch(`/api/teams/${teamId}/captain`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newCaptainId: m.id }),
              });
              window.location.reload();
            }
          }}
        >
          <button type="submit" className="w-full text-left px-3 py-1.5 text-xs text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors">
            {m.username}
          </button>
        </form>
      ))}
    </div>
  );
}

function PendingAction({
  memberId,
  teamId,
  action,
  icon,
  label,
  variant,
}: {
  memberId: string;
  teamId: string;
  action: string;
  icon: React.ReactNode;
  label: string;
  variant: "green" | "red";
}) {
  return (
    <form
      action={`/api/teams/${teamId}/members/${memberId}`}
      method="POST"
      onSubmit={async (e) => {
        e.preventDefault();
        await fetch(`/api/teams/${teamId}/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action }),
        });
        window.location.reload();
      }}
    >
      <button
        type="submit"
        className={`p-2 rounded-lg text-xs font-bold transition-colors ${
          variant === "green"
            ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
            : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
        }`}
      >
        {icon}
      </button>
    </form>
  );
}
