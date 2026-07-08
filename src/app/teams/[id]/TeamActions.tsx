"use client";

import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Shield, UserX, X } from "lucide-react";

export function LeaveTeamButton({ teamId }: { teamId: string }) {
  const router = useRouter();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm("¿Salir del equipo?")) {
          await fetch(`/api/teams/${teamId}/leave`, { method: "POST" });
          router.push("/tournaments");
        }
      }}
    >
      <button type="submit" className="w-full py-2.5 text-sm text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors">
        Salir del equipo
      </button>
    </form>
  );
}

export function CaptainTransfer({ teamId, members }: { teamId: string; members: { id: string; username: string }[] }) {
  const router = useRouter();
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
              router.refresh();
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

export function PendingAction({
  memberId, teamId, action, icon, label, variant,
}: {
  memberId: string; teamId: string; action: string; icon: React.ReactNode; label: string; variant: "green" | "red";
}) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch(`/api/teams/${teamId}/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action }),
        });
        router.refresh();
      }}
      className={`p-2 rounded-lg text-xs font-bold transition-colors ${
        variant === "green"
          ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
          : "bg-red-500/10 text-red-400 hover:bg-red-500/20"
      }`}
    >
      {icon}
    </button>
  );
}

// Remove a pending invitation (captain only)
export function RemoveMemberButton({ memberId, teamId, memberName }: { memberId: string; teamId: string; memberName: string }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (confirm(`¿Cancelar la invitación a ${memberName}?`)) {
          await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
          router.refresh();
        }
      }}
      className="px-2 py-1 text-[10px] text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors"
    >
      Cancelar
    </button>
  );
}

// Inline action button for active members (promote to captain / kick)
export function MemberActionButton({ memberId, userId, teamId, action, memberName }: {
  memberId: string; userId: string; teamId: string; action: "promote" | "kick"; memberName: string;
}) {
  const router = useRouter();

  if (action === "promote") {
    return (
      <button
        onClick={async () => {
          if (confirm(`¿Ascender a ${memberName} como líder del equipo?`)) {
            await fetch(`/api/teams/${teamId}/captain`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ newCaptainId: userId }),
            });
            router.refresh();
          }
        }}
        title="Ascender a líder"
        className="p-1.5 rounded-lg text-gold bg-gold/10 hover:bg-gold/20 transition-colors"
      >
        <Shield className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      onClick={async () => {
        if (confirm(`¿Expulsar a ${memberName} del equipo?`)) {
          await fetch(`/api/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
          router.refresh();
        }
      }}
      title="Expulsar del equipo"
      className="p-1.5 rounded-lg text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
    >
      <UserX className="w-3.5 h-3.5" />
    </button>
  );
}