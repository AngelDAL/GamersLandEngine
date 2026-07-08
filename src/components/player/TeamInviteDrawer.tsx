"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/hooks/useSocket";
import { useSession } from "next-auth/react";
import { Shield, CheckCircle, XCircle, Users, X } from "lucide-react";

type InviteData = {
  id: string;
  title: string;
  message: string;
  redirectUrl: string;
  teamName?: string;
  inviterName?: string;
};

// Track dismissed invites during this session
const dismissedRef: Record<string, number> = {};

export function TeamInviteDrawer() {
  const { data: session } = useSession();
  const { socket } = useSocket(session?.user?.id);
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [visible, setVisible] = useState(false);
  const [responding, setResponding] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Socket event listener
  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.type === "team_invite" && data.redirectUrl) {
        const match = data.redirectUrl.match(/\/teams\/([^/]+)/);
        const teamId = match?.[1];
        if (!teamId) return;
        if (dismissedRef[teamId] && Date.now() - dismissedRef[teamId] < 10000) return;
        showDrawer(teamId, data);
      }
    };
    socket.on("notification", handler);
    return () => { socket.off("notification", handler); };
  }, [socket]);

  // Fallback poll: check for pending invites every 5s
  useEffect(() => {
    if (!session?.user?.id) return;

    const checkPending = async () => {
      try {
        const teams = await fetch("/api/teams").then(r => r.json());
        for (const team of teams || []) {
          if (!Array.isArray(team.members)) continue;
          const pending = team.members.find(
            (m: any) => m.userId === session.user.id && m.status === "PENDING"
          );
          if (pending) {
            if (dismissedRef[team.id] && Date.now() - dismissedRef[team.id] < 10000) continue;
            showDrawer(team.id, {
              title: `Invitación a ${team.name}`,
              message: `Has sido invitado a unirte al equipo "${team.name}".`,
              redirectUrl: `/teams/${team.id}`,
            });
            break;
          }
        }
      } catch {}
    };

    const initialTimer = setTimeout(checkPending, 1000);
    pollRef.current = setInterval(checkPending, 5000);
    return () => {
      clearTimeout(initialTimer);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session?.user?.id]);

  function showDrawer(teamId: string, data: any) {
    setInvite({
      id: teamId,
      title: data.title || "Invitación a equipo",
      message: data.message || "",
      redirectUrl: data.redirectUrl || `/teams/${teamId}`,
    });
    setVisible(true);
  }

  if (!visible || !invite) return null;

  function dismiss() {
    if (invite) dismissedRef[invite.id] = Date.now();
    setVisible(false);
    setInvite(null);
  }

  const handleAccept = async () => {
    if (!invite) return;
    setResponding(true);
    const res = await fetch(`/api/teams/${invite.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: true }),
    }).catch(() => null);

    setResponding(false);
    dismiss();
    if (res?.ok) router.push(invite.redirectUrl);
    else router.refresh();
  };

  const handleReject = async () => {
    if (!invite) return;
    setResponding(true);
    await fetch(`/api/teams/${invite.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: false }),
    }).catch(() => {});

    setResponding(false);
    dismiss();
    router.refresh();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[100] transition-opacity"
        onClick={() => dismiss()}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 z-[101] bg-surface border-t-2 border-gold/40 rounded-t-3xl shadow-2xl animate-slide-up"
        style={{ maxHeight: "80vh", height: "auto" }}>
        
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Close button */}
        <button
          onClick={() => dismiss()}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-6 pb-8 pt-2 overflow-y-auto">
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-full bg-gold/10 border-2 border-gold/30 flex items-center justify-center">
              <Users className="w-10 h-10 text-gold" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-xl font-black text-foreground text-center mb-2">
            {invite.title}
          </h2>

          {/* Message */}
          <p className="text-sm text-muted text-center mb-6 leading-relaxed px-4">
            {invite.message}
          </p>

          {/* Info card */}
          <div className="bg-background border border-border rounded-xl p-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-gold" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Invitación de equipo</p>
                <p className="text-xs text-muted">
                  Al aceptar, serás miembro oficial del equipo y podrás participar en torneos.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              disabled={responding}
              className="flex-1 py-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold rounded-xl text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-600/20"
            >
              <CheckCircle className="w-5 h-5" />
              {responding ? "Aceptando..." : "Aceptar invitación"}
            </button>
            <button
              onClick={handleReject}
              disabled={responding}
              className="flex-1 py-4 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-bold rounded-xl text-base flex items-center justify-center gap-2 transition-colors"
            >
              <XCircle className="w-5 h-5" />
              {responding ? "Rechazando..." : "Rechazar"}
            </button>
          </div>

          <p className="text-[10px] text-muted text-center mt-4">
            También puedes revisar esta invitación desde la campana de notificaciones
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </>
  );
}
