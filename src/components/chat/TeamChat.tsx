"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, Send, Loader2 } from "lucide-react";

type Props = {
  teamId: string;
  userId: string;
};

export function TeamChat({ teamId, userId }: Props) {
  const { socket, connected } = useSocket(userId);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const roomId = `team:${teamId}`;

  useEffect(() => {
    if (!socket) return;

    socket.emit("chat:join", roomId);

    // Load history via API (resolves the room)
    fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`)
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const handler = (msg: any) => {
      setMessages((prev) => [...prev, msg]);
    };
    socket.on("chat:message", handler);

    return () => {
      socket.emit("chat:leave", roomId);
      socket.off("chat:message", handler);
    };
  }, [socket, roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!socket || !input.trim()) return;
    socket.emit("chat:message", { roomId, content: input.trim() });
    setInput("");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gold" />
        <h3 className="font-bold text-sm text-foreground">Chat del equipo</h3>
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
        {!connected && <span className="text-[10px] text-muted">(sin conexión)</span>}
      </div>

      <div className="bg-background border border-border rounded-xl h-[300px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted">
              <p>No hay mensajes aún. Es el primero!</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={m.id || i} className={`flex gap-2 text-sm ${m.senderId === userId ? "flex-row-reverse" : ""}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                  m.senderId === userId
                    ? "bg-gold text-background"
                    : "bg-surface text-foreground"
                }`}>
                  <p className="text-[10px] opacity-70 font-bold mb-0.5">{m.sender?.username || "?"}</p>
                  <p>{m.content}</p>
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
            className="w-9 h-9 bg-gold text-background rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gold-hover transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
