"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RegisterModal } from "./_components/RegisterModal";
import { TeamsSection } from "./_components/TeamsSection";
import { PlayerQR } from "@/components/player/PlayerQR";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  UserPlus, CheckCircle, LogIn, Swords, Users,
  QrCode, Plus, Shield, Send,
} from "lucide-react";

type TeamInfo = {
  id: string;
  name: string;
  captainId: string;
  captain: { id: string; username: string };
  _count: { members: number };
  members: { status: string }[];
};

type FreeAgentInfo = { id: string; username: string };

type Props = {
  tournamentId: string;
  tournamentStatus: string;
  session: { id: string; name: string; role: string } | null;
  registration: any;
  teams: TeamInfo[];
  freeAgents: FreeAgentInfo[];
  userTeamMember: { team: { id: string; name: string } } | null;
  isTeamBased: boolean;
};

export function TournamentDetailClient({
  tournamentId,
  tournamentStatus,
  session,
  registration,
  teams,
  freeAgents,
  userTeamMember,
  isTeamBased,
}: Props) {
  const router = useRouter();
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [actionStep, setActionStep] = useState<"idle" | "qr">("idle");

  const isOpen = tournamentStatus === "OPEN_REGISTRATION";
  const isPlayer = session?.role === "PLAYER";
  const isFreeAgent = isPlayer && !userTeamMember;
  const isRegistered = !!registration;

  const handleStart = () => {
    if (!session) {
      setShowRegisterModal(true);
    } else {
      setActionStep("qr");
    }
  };

  return (
    <>
      {isOpen && (
        <div className="mb-6">
          {/* Step 1: Not registered → show CTA */}
          {!isRegistered && actionStep === "idle" && (
            <Card className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    {session ? (
                      <Swords className="w-5 h-5 text-gold" />
                    ) : (
                      <LogIn className="w-5 h-5 text-gold" />
                    )}
                  </div>
                  <div>
                    {session ? (
                      <>
                        <p className="font-bold text-foreground">¿Quieres participar?</p>
                        <p className="text-xs text-muted mt-0.5">
                          Presiona el botón para generar tu QR y preséntalo con un organizador
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-foreground">¿Quieres jugar?</p>
                        <p className="text-xs text-muted mt-0.5">
                          Crea una cuenta y genera tu código QR para registrarte
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Button onClick={handleStart} size="lg" className="shrink-0 w-full sm:w-auto">
                  {session ? (
                    <QrCode className="w-5 h-5" />
                  ) : (
                    <UserPlus className="w-5 h-5" />
                  )}
                  {session ? "GENERAR QR" : "CREAR CUENTA"}
                </Button>
              </div>
            </Card>
          )}

          {/* Step 2: Show QR to go to organizer */}
          {session && !isRegistered && actionStep === "qr" && (
            <Card className="p-5">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-3">
                  <Send className="w-7 h-7 text-gold" />
                </div>
                <h3 className="font-bold text-lg text-gold mb-1">¡Listo!</h3>
                <p className="text-sm text-muted mb-1">
                  Preséntale este código QR al organizador en el stand del torneo
                </p>
                <p className="text-xs text-muted mb-5">
                  Él escaneará tu código y confirmará tu registro
                </p>

                <PlayerQR userId={session.id} username={session.name} size={180} />

                <div className="flex gap-3 justify-center mt-5">
                  <button
                    onClick={() => setActionStep("idle")}
                    className="px-4 py-2 border border-border text-muted rounded-xl text-xs hover:border-gold/50"
                  >
                    Volver
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Step 3: Already registered (confirmed by admin) */}
          {isRegistered && (
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-green-400">Estás registrado en este torneo</p>
                  <p className="text-xs text-muted mt-0.5">
                    {userTeamMember
                      ? `Miembro de ${userTeamMember.team.name}`
                      : "Eres agente libre — busca un equipo en la sección de abajo"}
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {!userTeamMember && (
                      <>
                        <a
                          href="/teams/create"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold text-background font-bold rounded-lg text-sm hover:bg-gold-hover"
                        >
                          <Plus className="w-4 h-4" />
                          Crear Equipo
                        </a>
                        <button
                          className="inline-flex items-center gap-1.5 px-4 py-2 border border-gold text-gold rounded-lg text-sm font-bold hover:bg-gold/10"
                        >
                          <Users className="w-4 h-4" />
                          Unirme a un equipo
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs text-muted flex items-center gap-1 mb-3">
                      <QrCode className="w-3.5 h-3.5" />
                      Tu QR para el organizador
                    </p>
                    <PlayerQR userId={session!.id} username={session!.name} size={140} />
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── Cerrado ── */}
      {!isOpen && tournamentStatus !== "COMPLETED" && (
        <div className="mb-6 bg-surface border border-border rounded-xl p-4 text-center">
          <p className="text-muted text-sm">Las inscripciones están cerradas para este torneo</p>
        </div>
      )}

      {/* ── Teams Section (only for team tournaments) ── */}
      {isTeamBased && (isRegistered || !isOpen) && (
        <div className="mb-6 bg-surface border border-border rounded-xl p-5">
          <TeamsSection
            teams={teams}
            freeAgents={freeAgents}
            tournamentId={tournamentId}
            userId={session?.id}
            isFreeAgent={isFreeAgent && isRegistered}
          />
        </div>
      )}

      {/* ── Register Modal ── */}
      {showRegisterModal && (
        <RegisterModal
          tournamentId={tournamentId}
          onClose={() => {
            setShowRegisterModal(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
