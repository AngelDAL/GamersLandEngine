"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Send, Loader2 } from "lucide-react";

type Props = {
  tournamentId: string;
  userId: string;
  status: string;
  registration: any;
  isPlayer: boolean;
  isAdmin: boolean;
};

export function TournamentActions({ tournamentId, userId, status, registration, isPlayer }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const canRegister = status === "OPEN_REGISTRATION" && isPlayer && !registration;

  const requestRegistration = async () => {
    setLoading(true);
    await fetch(`/api/tournaments/${tournamentId}/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setLoading(false);
    setRequested(true);
    router.refresh();
  };

  if (!isPlayer) return null;

  return (
    <Card className="mb-6 p-5">
      {registration ? (
        <div className="flex items-center gap-3 text-green-400">
          <CheckCircle className="w-6 h-6" />
          <div>
            <p className="font-bold text-sm">¡Registrado exitosamente!</p>
            <p className="text-xs text-muted">Estado: {registration.status}</p>
          </div>
        </div>
      ) : requested ? (
        <div className="flex items-center gap-3 text-gold">
          <Send className="w-6 h-6" />
          <div>
            <p className="font-bold text-sm">Solicitud enviada</p>
            <p className="text-xs text-muted">El organizador confirmará tu registro</p>
          </div>
        </div>
      ) : canRegister ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-gold text-sm">¿Quieres jugar este torneo?</p>
            <p className="text-xs text-muted">Recibirás un QR para que el organizador te registre</p>
          </div>
          <Button onClick={requestRegistration} disabled={loading} size="lg">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Enviando..." : "REGISTRARME"}
          </Button>
        </div>
      ) : status === "CLOSED" || status === "IN_PROGRESS" ? (
        <div className="text-center text-muted text-sm">
          <p>Las inscripciones están cerradas para este torneo</p>
        </div>
      ) : null}
    </Card>
  );
}
