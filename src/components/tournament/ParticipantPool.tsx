"use client";

import { useState } from "react";
import { Search, Users, GripVertical } from "lucide-react";

type Participant = { id: string; name: string };

type Props = {
  participants: Participant[];
  assignedIds: Set<string>;
  onAssignToSlot: (participantId: string, slotLabel: string) => void;
  slots: { matchId: string; label: string }[];
};

export function ParticipantPool({ participants, assignedIds, onAssignToSlot, slots }: Props) {
  const [search, setSearch] = useState("");
  const [selectedFor, setSelectedFor] = useState<string | null>(null);

  const unassigned = participants.filter((p) => !assignedIds.has(p.id));
  const filtered = unassigned.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDragStart = (e: React.DragEvent, participantId: string) => {
    e.dataTransfer.setData("text/plain", participantId);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gold flex items-center gap-2">
          <Users className="w-4 h-4" />
          Participantes
        </h3>
        <span className="text-[10px] text-muted">
          {unassigned.length} sin asignar / {participants.length} total
        </span>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted" />
        <input
          type="text"
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground placeholder-muted focus:outline-none focus:border-gold"
        />
      </div>

      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted text-center py-6">No hay participantes disponibles</p>
        ) : (
          filtered.map((p) => (
            <div
              key={p.id}
              draggable
              onDragStart={(e) => handleDragStart(e, p.id)}
              className="flex items-center gap-2 px-2.5 py-2 bg-background border border-border rounded-lg cursor-grab active:cursor-grabbing hover:border-gold/50 transition-colors group"
            >
              <GripVertical className="w-3 h-3 text-muted shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
              <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center text-gold text-[9px] font-bold shrink-0">
                {p.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-xs font-medium truncate">{p.name}</span>
              <select
                onChange={(e) => {
                  if (e.target.value) onAssignToSlot(p.id, e.target.value);
                  e.target.value = "";
                }}
                className="text-[8px] px-1.5 py-1 bg-gold/10 text-gold rounded border border-gold/30 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                defaultValue=""
              >
                <option value="" disabled>Slot</option>
                {slots.filter((s) => !assignedIds.has(p.id)).map((s) => (
                  <option key={`${s.matchId}-${s.label}`} value={`${s.matchId}:${s.label}`}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
