"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle, Shield, UserX, X, Loader2, AlertTriangle,
} from "lucide-react";

type ConfirmState = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
};

/** Modal de confirmación del sistema (nada de confirm()/prompt() nativos). */
function ConfirmDialog({
  state,
  busy,
  onClose,
}: {
  state: ConfirmState;
  busy: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="text-lg font-bold text-foreground">{state.title}</h3>
          <button
            onClick={() => !busy && onClose()}
            className="p-2 -m-1 text-muted hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="text-sm text-muted mb-5">{state.body}</div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => !busy && onClose()}
            disabled={busy}
            className="px-4 py-2.5 min-h-10 text-sm font-bold text-muted border border-border rounded-xl hover:bg-background transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => state.run()}
            disabled={busy}
            className={`inline-flex items-center gap-2 px-4 py-2.5 min-h-10 text-sm font-bold rounded-xl transition-colors disabled:opacity-50 ${
              state.danger
                ? "bg-red text-white hover:opacity-90"
                : "bg-gold text-background hover:bg-gold-hover"
            }`}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : state.danger ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LeaveTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        onClick={() =>
          setConfirm({
            title: "Salir del equipo",
            body: "Dejarás de contar para los torneos por equipo de este equipo. Podrás volver solo si te vuelven a invitar.",
            confirmLabel: "Salir del equipo",
            danger: true,
            run: async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  toast.error(data.error || "No se pudo salir del equipo.");
                  return;
                }
                toast.success("Saliste del equipo");
                setConfirm(null);
                router.push("/teams");
              } catch {
                toast.error("No se pudo salir del equipo. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            },
          })
        }
        className="w-full py-2.5 min-h-11 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors"
      >
        Salir del equipo
      </button>
      {confirm && <ConfirmDialog state={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
    </>
  );
}

export function PendingAction({
  memberId, teamId, action, icon, label, variant,
}: {
  memberId: string; teamId: string; action: string; icon: React.ReactNode; label: string; variant: "green" | "red";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: action }),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            toast.error(data.error || "No se pudo actualizar la solicitud.");
            return;
          }
          toast.success(action === "ACTIVE" ? "Solicitud aceptada" : "Solicitud rechazada");
          router.refresh();
        } catch {
          toast.error("No se pudo actualizar la solicitud. Intenta de nuevo.");
        } finally {
          setBusy(false);
        }
      }}
      disabled={busy}
      title={label}
      className={`p-2 min-w-10 min-h-10 flex items-center justify-center rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
        variant === "green"
          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
          : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
      }`}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
    </button>
  );
}

// Remove a pending invitation (captain only)
export function RemoveMemberButton({ memberId, teamId, memberName }: { memberId: string; teamId: string; memberName: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <button
        onClick={() =>
          setConfirm({
            title: "Cancelar invitación",
            body: (
              <>
                Se cancelará la invitación enviada a <strong>{memberName}</strong>. Podrás invitarlo de nuevo más adelante.
              </>
            ),
            confirmLabel: "Cancelar invitación",
            danger: true,
            run: async () => {
              setBusy(true);
              try {
                const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  toast.error(data.error || "No se pudo cancelar la invitación.");
                  return;
                }
                toast.success("Invitación cancelada");
                setConfirm(null);
                router.refresh();
              } catch {
                toast.error("No se pudo cancelar la invitación. Intenta de nuevo.");
              } finally {
                setBusy(false);
              }
            },
          })
        }
        className="px-2 py-1.5 min-h-9 text-[10px] font-bold text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
      >
        Cancelar
      </button>
      {confirm && <ConfirmDialog state={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
    </>
  );
}

// Inline action button for active members (promote to captain / kick)
export function MemberActionButton({ memberId, userId, teamId, action, memberName }: {
  memberId: string; userId: string; teamId: string; action: "promote" | "kick"; memberName: string;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const res = action === "promote"
        ? await fetch(`/api/teams/${teamId}/captain`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newCaptainId: userId }),
          })
        : await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "No se pudo completar la acción.");
        return;
      }
      toast.success(action === "promote" ? `${memberName} ahora es el líder` : `${memberName} fue retirado del equipo`);
      setConfirm(null);
      router.refresh();
    } catch {
      toast.error("No se pudo completar la acción. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  if (action === "promote") {
    return (
      <>
        <button
          onClick={() =>
            setConfirm({
              title: "Ascender a líder",
              body: (
                <>
                  <strong>{memberName}</strong> pasará a ser el líder del equipo. Tú dejarás de ser capitán.
                </>
              ),
              confirmLabel: "Ascender",
              run,
            })
          }
          title="Ascender a líder"
          className="p-1.5 min-w-9 min-h-9 rounded-lg text-gold bg-gold/10 hover:bg-gold/20 transition-colors flex items-center justify-center"
        >
          <Shield className="w-3.5 h-3.5" />
        </button>
        {confirm && <ConfirmDialog state={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
      </>
    );
  }

  return (
    <>
      <button
        onClick={() =>
          setConfirm({
            title: "Expulsar del equipo",
            body: (
              <>
                <strong>{memberName}</strong> será retirado del equipo. No podrá ver el chat ni participar en los próximos torneos con el equipo.
              </>
            ),
            confirmLabel: "Expulsar",
            danger: true,
            run,
          })
        }
        title="Expulsar del equipo"
        className="p-1.5 min-w-9 min-h-9 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors flex items-center justify-center"
      >
        <UserX className="w-3.5 h-3.5" />
      </button>
      {confirm && <ConfirmDialog state={confirm} busy={busy} onClose={() => !busy && setConfirm(null)} />}
    </>
  );
}
