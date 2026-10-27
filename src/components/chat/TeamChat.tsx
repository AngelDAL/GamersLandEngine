"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, Send, Loader2, ImagePlus, X, RotateCcw } from "lucide-react";

type Props = {
  teamId: string;
  userId: string;
};

type ChatMsg = {
  id: string;
  senderId: string;
  content?: string;
  imageUrl?: string;
  createdAt: string;
  sender?: { id: string; username: string };
  _status?: "sending" | "failed";
  _payload?: { roomId: string; content: string; imageUrl?: string };
};

// Fuera del componente: las reglas de pureza de React prohíben Date.now()
// directamente en el cuerpo del render/handlers del componente.
function nowMs() {
  return Date.now();
}

export function TeamChat({ teamId, userId }: Props) {
  const { socket, connected, joinRoom, leaveRoom } = useSocket(userId);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [fullImg, setFullImg] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const roomId = `team:${teamId}`;

  useEffect(() => {
    if (!socket) return;
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
  }, [socket, roomId, joinRoom, leaveRoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const markFailed = (tempId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" } : m)),
    );
  };

  const retryMessage = (m: ChatMsg) => {
    if (!m._payload) return;
    const tempId = `temp-retry-${nowMs()}`;
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id ? { ...x, id: tempId, _status: "sending", _payload: m._payload } : x,
      ),
    );
    if (socket && connected) {
      emitWithAck(tempId, m._payload);
    } else {
      void sendViaHttp(tempId, m._payload);
    }
  };

  const emitWithAck = (tempId: string, payload: { roomId: string; content: string; imageUrl?: string }) => {
    if (!socket) return;
    socket.timeout(5000).emit("chat:message", payload, (err: Error | null) => {
      if (err) {
        // Si el eco broadcast aún no confirmó el mensaje, márcalo como fallido
        setMessages((prev) => {
          const pending = prev.some((m) => m.id === tempId && m._status === "sending");
          return pending
            ? prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" } : m))
            : prev;
        });
      }
    });
  };

  const sendViaHttp = async (tempId: string, payload: { roomId: string; content: string; imageUrl?: string }) => {
    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("send failed");
      const reload = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`);
      if (reload.ok) {
        const json = await reload.json();
        setMessages(json.messages || []);
      }
    } catch {
      markFailed(tempId);
    }
  };

  const sendMessage = () => {
    if (!input.trim() && !previewImg) return;
    const tempId = `temp-${nowMs()}`;
    const payload = { roomId, content: input.trim(), ...(previewImg ? { imageUrl: previewImg } : {}) };
    setMessages((prev) => [...prev, {
      id: tempId, senderId: userId, content: payload.content, imageUrl: previewImg || undefined,
      createdAt: new Date().toISOString(), _status: "sending", _payload: payload,
    }]);
    setInput("");
    setPreviewImg(null);
    if (socket && connected) {
      emitWithAck(tempId, payload);
    } else {
      void sendViaHttp(tempId, payload);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("image", file);
    const res = await fetch("/api/upload/chat", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      setPreviewImg(data.imageUrl);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-gold" />
        <h3 className="font-bold text-sm text-foreground">Chat del equipo</h3>
        <span className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-red-400"}`} />
        {!connected && <span className="text-[10px] text-muted">(sin conexión)</span>}
        <span className="text-[10px] text-muted ml-auto">{messages.length} mensajes</span>
      </div>

      <div className="bg-background border border-border rounded-xl h-[400px] flex flex-col">
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 text-muted animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-muted">
              <p className="text-center">No hay mensajes aún.<br />Comparte estrategias con tu equipo.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={m.id || i} className={`flex gap-2 text-sm ${m.senderId === userId ? "flex-row-reverse" : ""}`}>
                <div className={`max-w-[80%] px-3 py-2 space-y-1 ${
                  m.senderId === userId
                    ? "bg-gold/20 text-foreground rounded-xl rounded-tr-sm"
                    : "bg-surface text-foreground rounded-xl rounded-tl-sm"
                } ${m._status === "failed" ? "border border-red-500/50" : ""} ${m._status === "sending" ? "opacity-60" : ""}`}>
                  <p className="text-[10px] opacity-60 font-bold">{m.sender?.username || "?"}</p>
                  {m.content && <p className="text-sm">{m.content}</p>}
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt=""
                      className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity mt-1"
                      style={{ maxHeight: 200 }}
                      onClick={() => setFullImg(m.imageUrl || null)}
                    />
                  )}
                  {m._status === "failed" ? (
                    <button
                      onClick={() => retryMessage(m)}
                      className="inline-flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 font-bold"
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> No enviado · Reintentar
                    </button>
                  ) : (
                    <p className="text-[9px] opacity-40 text-right">
                      {m._status === "sending"
                        ? "Enviando…"
                        : new Date(m.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Image preview */}
        {previewImg && (
          <div className="relative px-3 pt-2 border-t border-border">
            <div className="relative inline-block">
              <img src={previewImg} alt="" className="h-16 rounded-lg" />
              <button onClick={() => setPreviewImg(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border p-2 flex gap-2 items-end">
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="p-2 text-muted hover:text-gold transition-colors shrink-0 disabled:opacity-50">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFile} className="hidden" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Escribe un mensaje..."
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold"
          />
          <button onClick={sendMessage} disabled={!input.trim() && !previewImg}
            className="w-9 h-9 bg-gold text-background rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gold-hover transition-colors shrink-0">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Full image modal */}
      {fullImg && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setFullImg(null)}>
          <img src={fullImg} alt="" className="max-w-full max-h-full rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
