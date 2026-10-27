"use client";

import { useState } from "react";
import { UserPlus, X, Crown, User } from "lucide-react";

type Props = {
  matchId: string;
  slot: "team1" | "team2";
  participant: { id: string; name: string } | null;
  isWinner: boolean;
  isCaptain?: boolean;
  isUser?: boolean;
  /** Solo quien gestiona la llave puede asignar o quitar participantes. */
  canEdit?: boolean;
  onAssign: (participantId: string) => void;
  onRemove: () => void;
  availableParticipants: { id: string; name: string }[];
};

export function BracketSlot({
  matchId, slot, participant, isWinner, isCaptain, isUser, canEdit = false,
  onAssign, onRemove, availableParticipants,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [showSelect, setShowSelect] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    if (!canEdit) return;
    e.preventDefault();
    setDragOver(false);
    const data = e.dataTransfer.getData("text/plain");
    if (data) onAssign(data);
  };

  if (participant) {
    const bgColor = isWinner
      ? "bg-green-500/10 text-green-400 border-green-500/30"
      : isUser
        ? "bg-gold/10 text-gold border-gold/50"
        : "bg-background border-border hover:border-gold/30";

    return (
      <div
        data-slot={`${matchId}:${slot}`}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-all group ${bgColor}`}
      >
        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isWinner ? "bg-green-500/20 text-green-400" :
          isUser ? "bg-gold/20 text-gold" :
          "bg-gold/10 text-gold"
        }`}>
          {participant.name[0].toUpperCase()}
        </div>
        <span className="flex-1 text-xs font-medium truncate">{participant.name}</span>
        {isUser && !isWinner && <User className="w-3.5 h-3.5 text-gold shrink-0" />}
        {isCaptain && <Crown className="w-3 h-3 text-gold shrink-0" />}
        {canEdit && (
          <button
            onClick={onRemove}
            title="Quitar de esta posición"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded text-muted hover:text-red-400 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      data-slot={`${matchId}:${slot}`}
      onDragOver={canEdit ? handleDragOver : undefined}
      onDragLeave={canEdit ? handleDragLeave : undefined}
      onDrop={canEdit ? handleDrop : undefined}
      onClick={() => { if (canEdit && !showSelect) setShowSelect(true); }}
      className={`relative flex items-center gap-2 min-h-[40px] px-3 py-2 rounded-lg text-sm border-2 border-dashed transition-all ${
        canEdit ? "cursor-pointer" : ""
      } ${
        dragOver
          ? "border-gold bg-gold/5"
          : "border-border hover:border-gold/50 hover:bg-gold/5"
      }`}
    >
      <UserPlus className="w-4 h-4 text-muted shrink-0" />
      <span className="flex-1 text-xs text-muted">
        {showSelect ? "Seleccionar..." : "Vacío"}
      </span>

      {showSelect && (
        <select
          onChange={(e) => {
            if (e.target.value) {
              onAssign(e.target.value);
              setShowSelect(false);
            }
          }}
          onBlur={() => setShowSelect(false)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          autoFocus
        >
          <option value="">Cancelar</option>
          {availableParticipants.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
