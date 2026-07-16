import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamClient } from "./TeamClient";
import { TeamChat } from "@/components/chat/TeamChat";
import { LaneSelector } from "@/components/team/LaneSelector";
import {
  Users, Shield, CheckCircle, XCircle, X, UserPlus, Swords,
  MessageSquare, Clock, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { LeaveTeamButton, MemberActionButton, RemoveMemberButton, PendingAction } from "./TeamActions";
import { InviteLinkButton } from "./InviteLinkButton";

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
  const requestMembers = team.members.filter((m) => m.status === "REQUEST");

  // Is the current user invited (pending)?
  const myPending = team.members.find((m) => m.userId === session.user.id && m.status === "PENDING");
  // Is the current user a requester (requested to join)?
  const myRequest = team.members.find((m) => m.userId === session.user.id && m.status === "REQUEST");

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

      {/* ── INVITATION BANNER for invited users (PENDING only) ── */}
      {myPending && !isMember && !isCaptain && (
        <div className="mb-6 p-5 bg-gold/5 border-2 border-gold/40 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-gold font-bold text-sm flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                Tienes una invitación pendiente
              </p>
              <p className="text-muted text-xs">
                <strong>{team.captain.username}</strong> te ha invitado a unirte a <strong>{team.name}</strong>.
                {myPending.message && <span className="block mt-1 italic">"{myPending.message}"</span>}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <PendingAction
                memberId={myPending.id}
                teamId={id}
                action="ACTIVE"
                icon={<CheckCircle className="w-4 h-4" />}
                label="Aceptar"
                variant="green"
              />
              <PendingAction
                memberId={myPending.id}
                teamId={id}
                action="REJECTED"
                icon={<XCircle className="w-4 h-4" />}
                label="Rechazar"
                variant="red"
              />
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST BANNER for users who requested to join ── */}
      {myRequest && !isMember && !isCaptain && (
        <div className="mb-6 p-5 bg-blue-500/5 border-2 border-blue-500/40 rounded-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-blue-400 font-bold text-sm flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4" />
                Solicitud enviada
              </p>
              <p className="text-muted text-xs">
                Solicitaste unirte a <strong>{team.name}</strong>. Espera a que el capitán revise tu solicitud.
                {myRequest.message && <span className="block mt-1 italic">"{myRequest.message}"</span>}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
                <PendingAction
                  memberId={myRequest.id}
                  teamId={id}
                  action="REJECTED"
                  icon={<X className="w-4 h-4" />}
                  label="Cancelar solicitud"
                  variant="red"
                />
            </div>
          </div>
        </div>
      )}

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
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                        {m.user.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-medium truncate">{m.user.username}</span>
                        {m.user.id === team.captainId && (
                          <Badge variant="gold" className="ml-2 text-[10px]">Líder</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Lane selector for captain */}
                      {canManage && (
                        <LaneSelector memberId={m.id} currentLane={m.lane} teamId={id} />
                      )}
                      {/* Lane badge for non-captain */}
                      {!canManage && m.lane && (
                        <span className="text-[10px] px-2 py-1 rounded-lg bg-gold/10 border border-gold/30 text-gold font-bold">
                          {m.lane === "TOP" ? "Top" :
                           m.lane === "JUNGLE" ? "Jungla" :
                           m.lane === "MID" ? "Mid" :
                           m.lane === "ADC" ? "ADC" : "Support"}
                        </span>
                      )}
                      {canManage && m.user.id !== session.user.id && (
                        <div className="flex gap-1.5">
                          <MemberActionButton
                            memberId={m.id}
                            userId={m.user.id}
                            teamId={id}
                            action="promote"
                            memberName={m.user.username}
                          />
                          <MemberActionButton
                            memberId={m.id}
                            userId={m.user.id}
                            teamId={id}
                            action="kick"
                            memberName={m.user.username}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Invitations sent by captain - captain view (user must accept) */}
          {canManage && pendingMembers.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-gold flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                Invitaciones pendientes ({pendingMembers.length})
              </h2>
              <p className="text-xs text-muted mb-3">Estos usuarios han recibido una invitación. Ellos deben aceptarla o rechazarla desde su cuenta.</p>
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
                    <RemoveMemberButton memberId={m.id} teamId={id} memberName={m.user.username} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Join requests from free agents - captain can accept/reject */}
          {canManage && requestMembers.length > 0 && (
            <Card>
              <h2 className="text-lg font-bold text-blue-400 flex items-center gap-2 mb-4">
                <UserPlus className="w-5 h-5" />
                Solicitudes de unión ({requestMembers.length})
              </h2>
              <p className="text-xs text-muted mb-3">Jugadores que quieren unirse a tu equipo. Acepta o rechaza sus solicitudes.</p>
              <div className="space-y-2">
                {requestMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-xs font-bold">
                        {m.user.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-2">
                          {m.user.username}
                          <Link
                            href={`/players/${m.user.id}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-[10px] text-gold hover:text-gold/70 transition-colors"
                            title="Ver perfil de League of Legends"
                          >
                            <Swords className="w-3 h-3" />
                            Perfil LoL
                          </Link>
                        </p>
                        <p className="text-xs text-muted">{m.message || "Sin mensaje"}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <PendingAction
                        memberId={m.id}
                        teamId={id}
                        action="ACTIVE"
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

          {canManage && <InviteLinkButton teamId={id} />}

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
            <LeaveTeamButton teamId={id} />
          )}
        </div>
      </div>
    </div>
  );
}
