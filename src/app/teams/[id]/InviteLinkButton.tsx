"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

type Props = { teamId: string };

export function InviteLinkButton({ teamId }: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const link = `${window.location.origin}/teams/${teamId}/join`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement("input");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={copyLink}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-gold/20 hover:border-gold/50 rounded-xl transition-all text-sm font-bold group"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-green-400">¡Enlace copiado!</span>
        </>
      ) : (
        <>
          <Link2 className="w-4 h-4 text-gold group-hover:scale-110 transition-transform" />
          <span className="text-gold">Copiar enlace de invitación</span>
        </>
      )}
    </button>
  );
}
