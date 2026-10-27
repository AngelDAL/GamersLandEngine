"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, Send, Loader2, Swords, RotateCcw } from "lucide-react";

type Props = {
  matchId: string;
  userId: string;
  team1Name: string;
  team2Name: string;
  isParticipant: boolean;
};

type ChatMsg = {
  id: string;
  senderId: string;
  content?: string;
  createdAt: string;
  sender?: { id: string; username: string };
  _status?: "sending" | "failed";
  _payload?: { roomId: string; content: string };
};

// Fuera del componente: las reglas de pureza de React prohíben Date.now()
// directamente en el cuerpo del render/handlers del componente.
function nowMs() {
  return Date.now();
}

export function MatchChat({ matchId, userId, team1Name, team2Name, isParticipant }: Props) {
  const { socket, connected, joinRoom, leaveRoom } = useSocket(userId);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const roomId = `match:${matchId}`;

  useEffect(() => {
    if (!socket || !expanded) return;

    joinRoom(roomId);

    fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => { setMessages(data.messages || []); setLoading(false); })
      .catch(() => setLoading(false));

    const handler = (msg: ChatMsg & { roomId?: string }) => {
      setMessages((prev) => {
        if (msg.senderId === userId) {
          const withoutOptimistic = prev.filter(
            (m) => !(m.id?.startsWith("temp-") && m._status === "sending" && m.content === msg.content),
          );
          if (withoutOptimistic.some((m) => m.id === msg.id)) return withoutOptimistic;
          return [...withoutOptimistic, msg];
        }
        return prev.some((m) => m.id === msg.id) ? prev : [...prev, msg];
      });
    };
    socket.on("chat:message", handler);

    return () => {
      leaveRoom(roomId);
      socket.off("chat:message", handler);
    };
  }, [socket, roomId, expanded, joinRoom, leaveRoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !socket) return;
    const tempId = `temp-${nowMs()}`;
    const payload = { roomId, content };
    setMessages((prev) => [...prev, {
      id: tempId, senderId: userId, content, createdAt: new Date().toISOString(),
      _status: "sending", _payload: payload,
    }]);
    setInput("");
    socket.timeout(5000).emit("chat:message", payload, (err: Error | null) => {
      if (err) {
        setMessages((prev) => {
          const pending = prev.some((m) => m.id === tempId && m._status === "sending");
          return pending
            ? prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" } : m))
            : prev;
        });
      }
    });
  };

  const retryMessage = (m: ChatMsg) => {
    if (!m._payload || !socket) return;
    const tempId = `temp-retry-${nowMs()}`;
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, id: tempId, _status: "sending" } : x)),
    );
    socket.timeout(5000).emit("chat:message", m._payload, (err: Error | null) => {
      if (err) {
        setMessages((prev) => {
          const pending = prev.some((x) => x.id === tempId && x._status === "sending");
          return pending
            ? prev.map((x) => (x.id === tempId ? { ...x, _status: "failed" } : x))
            : prev;
        });
      }
    });
  };

  if (!isParticipant) return null;

  return (
    <div className="border-t border-border mt-4 pt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-gold hover:underline mb-2"
      >
        <MessageSquare className="w-4 h-4" />
        {expanded ? "Ocultar chat de partida" : "Chat con el equipo rival"}
        {!connected && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
      </button>

      {expanded && (
        <div className="bg-background border border-border rounded-xl h-[250px] flex flex-col">
          <div className="bg-surface px-3 py-2 border-b border-border flex items-center gap-2 text-xs text-muted">
            <Swords className="w-3.5 h-3.5 text-gold" />
            {team1Name} vs {team2Name}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 text-muted animate-spin" /></div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted">
                <p>Coordinación entre equipos</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={m.id || i} className={`flex gap-2 text-sm ${m.senderId === userId ? "flex-row-reverse" : ""}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${m.senderId === userId ? "bg-gold text-background" : "bg-surface text-foreground"} ${m._status === "failed" ? "border border-red-500/50" : ""} ${m._status === "sending" ? "opacity-60" : ""}`}>
                    <p className="text-[10px] opacity-70 font-bold mb-0.5">{m.sender?.username || "?"}</p>
                    <p>{m.content}</p>
                    {m._status === "failed" ? (
                      <button
                        onClick={() => retryMessage(m)}
                        className="inline-flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 font-bold mt-0.5"
                      >
                        <RotateCcw className="w-2.5 h-2.5" /> No enviado · Reintentar
                      </button>
                    ) : m._status === "sending" ? (
                      <p className="text-[8px] opacity-50 mt-0.5">Enviando…</p>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-border p-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || !connected}
              className="w-9 h-9 bg-gold text-background rounded-lg flex items-center justify-center disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
