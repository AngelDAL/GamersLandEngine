"use client";

import { useState } from "react";

const LANES = [
  { value: "", label: "Sin línea" },
  { value: "TOP", label: "Top" },
  { value: "JUNGLE", label: "Jungla" },
  { value: "MID", label: "Mid" },
  { value: "ADC", label: "ADC" },
  { value: "SUPPORT", label: "Support" },
];

export function LaneSelector({
  memberId,
  currentLane,
  teamId,
}: {
  memberId: string;
  currentLane: string | null;
  teamId: string;
}) {
  const [lane, setLane] = useState(currentLane || "");
  const [saving, setSaving] = useState(false);

  const handleChange = async (newLane: string) => {
    setSaving(true);
    setLane(newLane);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lane: newLane || null }),
      });
      if (!res.ok) {
        setLane(currentLane || "");
      }
    } catch {
      setLane(currentLane || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={lane}
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
        saving
          ? "opacity-50"
          : lane
            ? "bg-gold/10 border-gold/30 text-gold font-bold"
            : "bg-background border-border text-muted"
      }`}
    >
      {LANES.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
