"use client";

import { useState, useEffect, useRef } from "react";
import { useSocket } from "@/hooks/useSocket";
import { MessageSquare, Send, ImagePlus, X, Loader2, Users, Minus, Circle, RotateCcw } from "lucide-react";

type Props = {
  userId: string;
  teams: { id: string; name: string; memberCount: number }[];
};

type ChatMessage = {
  id: string;
  roomId?: string;
  senderId: string;
  content?: string;
  imageUrl?: string;
  createdAt: string;
  sender?: { id: string; username: string; avatarUrl?: string | null };
  _status?: "sending" | "failed";
  _payload?: { roomId: string; content: string; imageUrl?: string };
};

// Fuera del componente: las reglas de pureza de React prohíben Date.now()
// directamente en el cuerpo del render/handlers del componente.
function nowMs() {
  return Date.now();
}

export function ChatWidget({ userId, teams }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; username: string }[]>([]);
  const [unreadByTeam, setUnreadByTeam] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  // Último mensaje visto por equipo (marca de tiempo) para contar no leídos
  // incluso cuando el servidor devuelve listas más largas que el contador.
  const lastSeenRef = useRef<Record<string, number>>({});
  const messagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const currentTeam = teams.find((t) => t.id === selectedTeam);
  const roomId = selectedTeam ? `team:${selectedTeam}` : null;
  const { socket, connected, joinRoom } = useSocket(userId);
  const totalUnread = Object.values(unreadByTeam).reduce((a, b) => a + b, 0);
  const [resolvedRoomIds, setResolvedRoomIds] = useState<Record<string, string>>({});

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Join ALL team rooms on socket connect (y el hook las reúna al reconectar)
  useEffect(() => {
    for (const team of teams) {
      joinRoom(`team:${team.id}`);
    }
  }, [teams, joinRoom]);

  // Global message listener
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      // Find which team this message belongs to using resolved room IDs
      let teamId: string | undefined;
      for (const [tid, rid] of Object.entries(resolvedRoomIds)) {
        if (rid === msg.roomId) { teamId = tid; break; }
      }
      // El eco propio puede llegar antes de conocer el room resuelto
      if (!teamId && msg.senderId === userId) {
        // coincidencia por contenido contra un optimista pendiente
        const pending = messagesRef.current.find(
          (m) => m.id?.startsWith("temp-") && m._status === "sending" && m.content === msg.content,
        );
        if (pending && pending._payload) {
          teamId = pending._payload.roomId.replace(/^team:/, "");
        }
      }
      if (!teamId) return; // Not a known team message

      const isFromOther = msg.senderId !== userId;
      const isChatOpen = open && selectedTeam === teamId && !minimized && document.hasFocus();
      const isChatMinimized = !(open && selectedTeam === teamId && !minimized);

      // Track unread
      if (isFromOther && isChatMinimized) {
        setUnreadByTeam((prev) => ({ ...prev, [teamId]: (prev[teamId] || 0) + 1 }));
      }
      lastSeenRef.current[teamId] = nowMs();

      // If this team's chat is currently open, add the message
      if (open && selectedTeam === teamId) {
        setMessages((prev) => {
          // Reemplaza el mensaje optimista propio por el confirmado del servidor
          const withoutOptimistic = msg.senderId === userId
            ? prev.filter((m) => !(m.id?.startsWith("temp-") && m.content === msg.content))
            : prev;
          if (withoutOptimistic.some((m) => m.id === msg.id)) return withoutOptimistic;
          return [...withoutOptimistic, msg];
        });
      }

      // Browser notification
      if (isFromOther && !isChatOpen && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const senderName = msg.sender?.username || "Alguien";
        const teamName = teams.find((t) => t.id === teamId)?.name || "Equipo";
        try {
          const n = new Notification(teamName, {
            body: `${senderName}: ${msg.content || (msg.imageUrl ? "Imagen" : "Nuevo mensaje")}`,
            icon: "/favicon.ico",
            tag: `chat-${teamId}-${nowMs()}`,
          });
          n.onclick = () => { window.focus(); setOpen(true); setSelectedTeam(teamId); setMinimized(false); };
        } catch { /* notificaciones browser pueden fallar sin permiso real */ }
      }
    };
    socket.on("chat:message", handler);
    return () => { socket.off("chat:message", handler); };
  }, [socket, open, selectedTeam, minimized, userId, teams, resolvedRoomIds]);

  // Load messages when team selected
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      setShowMembers(false);
      setUnreadByTeam((prev) => ({ ...prev, [selectedTeam!]: 0 }));
      setLoading(true);
      try {
        const res = await fetch(`/api/messages?roomId=${encodeURIComponent(roomId)}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          // Store resolved room ID for socket message matching
          if (data.roomId && selectedTeam) {
            setResolvedRoomIds(prev => ({ ...prev, [selectedTeam]: data.roomId }));
          }
          const last = (data.messages || [])[data.messages?.length - 1];
          lastSeenRef.current[selectedTeam!] = last ? new Date(last.createdAt).getTime() : nowMs();
        }
      } catch { /* el estado de error lo maneja el vacío del chat */ }
      setLoading(false);
    })();
  }, [roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Poll de respaldo SOLO cuando el socket está caído: refresca la última
  // marca de tiempo (no el contador de no leídos) cada 60 s.
  useEffect(() => {
    if (connected) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    pollRef.current = setInterval(async () => {
      for (const team of teams) {
        try {
          const res = await fetch(`/api/messages?roomId=${encodeURIComponent(`team:${team.id}`)}`);
          if (!res.ok) continue;
          const data = await res.json();
          const serverMsgs: ChatMessage[] = data.messages || [];
          const lastAt = serverMsgs.length
            ? new Date(serverMsgs[serverMsgs.length - 1].createdAt).getTime()
            : 0;
          if (data.roomId) {
            setResolvedRoomIds(prev => (prev[team.id] === data.roomId ? prev : { ...prev, [team.id]: data.roomId }));
          }
          if (selectedTeam === team.id) {
            const seen = lastSeenRef.current[team.id] || 0;
            if (lastAt > seen) {
              setMessages(serverMsgs);
              lastSeenRef.current[team.id] = lastAt;
            }
          } else {
            const seen = lastSeenRef.current[team.id] || 0;
            const unread = serverMsgs.filter(
              (m) => new Date(m.createdAt).getTime() > seen,
            ).length;
            setUnreadByTeam(prev => (prev[team.id] === unread ? prev : { ...prev, [team.id]: unread }));
          }
        } catch { /* red caída: se reintenta en el siguiente ciclo */ }
      }
    }, 60000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [connected, teams, selectedTeam]);

  // Load team members
  useEffect(() => {
    if (!selectedTeam) return;
    fetch(`/api/teams/${selectedTeam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setTeamMembers(data.members?.filter((m: { status: string }) => m.status === "ACTIVE").map((m: { user: { id: string; username: string } }) => m.user) || []);
      })
      .catch(() => {});
  }, [selectedTeam]);

  // Presence
  useEffect(() => {
    if (!socket || !roomId) return;
    const handler = (users: string[]) => setActiveUsers(users);
    socket.on("presence:users", handler);
    return () => { socket.off("presence:users", handler); };
  }, [socket, roomId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (open && selectedTeam) setTimeout(() => inputRef.current?.focus(), 200); }, [open, selectedTeam]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && open && !selectedTeam) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, selectedTeam]);

  const markFailed = (tempId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" as const } : m)),
    );
  };

  const emitMessage = (tempId: string, payload: { roomId: string; content: string; imageUrl?: string }) => {
    if (!socket || !connected) return false;
    socket.timeout(5000).emit("chat:message", payload, (err: Error | null) => {
      if (err) {
        // Sin ack del servidor: si tampoco llegó el eco broadcast en 5 s,
        // el mensaje queda marcado como no enviado con opción de reintentar.
        setMessages((prev) => {
          const stillPending = prev.some(
            (m) => m.id === tempId && m._status === "sending",
          );
          if (stillPending) {
            return prev.map((m) => (m.id === tempId ? { ...m, _status: "failed" as const } : m));
          }
          return prev;
        });
      }
    });
    return true;
  };

  const sendMessage = async () => {
    if ((!input.trim() && !previewImg) || !roomId) return;
    const tempId = `temp-${nowMs()}`;
    const payload = {
      roomId,
      content: input.trim(),
      ...(previewImg ? { imageUrl: previewImg } : {}),
    };
    const optimisticMsg: ChatMessage = {
      id: tempId, senderId: userId, content: payload.content,
      imageUrl: previewImg || undefined, createdAt: new Date().toISOString(),
      sender: { id: userId, username: "Tú", avatarUrl: null },
      _status: "sending", _payload: payload,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setInput(""); setPreviewImg(null);

    if (socket && connected) {
      emitMessage(tempId, payload);
    } else {
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
    }
  };

  const retryMessage = (m: ChatMessage) => {
    if (!m._payload) return;
    const tempId = `temp-retry-${nowMs()}`;
    setMessages((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, id: tempId, _status: "sending" as const, _payload: m._payload }
          : x,
      ),
    );
    if (socket && connected) {
      emitMessage(tempId, m._payload);
    } else {
      fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m._payload),
      })
        .then((res) => {
          if (!res.ok) throw new Error("send failed");
          setMessages((prev) => prev.filter((x) => x.id !== tempId));
        })
        .catch(() => markFailed(tempId));
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    const form = new FormData(); form.append("image", file);
    try {
      const res = await fetch("/api/upload/chat", { method: "POST", body: form });
      if (res.ok) { const d = await res.json(); setPreviewImg(d.imageUrl); }
    } catch { /* el usuario puede reintentar el archivo */ }
    setUploading(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) { if (item.type.startsWith("image/")) { const file = item.getAsFile(); if (file) { handleFile(file); break; } } }
  };

  const recentSenders = new Set(messages.slice(-10).map((m) => m.senderId));
  const activeMemberIds = new Set([...activeUsers, ...recentSenders, userId]);
  const onlineCount = teamMembers.filter((m) => activeMemberIds.has(m.id) || m.id === userId).length;

  const openChat = (teamId?: string) => {
    setOpen(true);
    if (teamId) {
      setSelectedTeam(teamId);
      setMinimized(false);
      setUnreadByTeam((prev) => ({ ...prev, [teamId]: 0 }));
      lastSeenRef.current[teamId] = nowMs();
    }
  };

  const closeChat = () => { setOpen(false); setSelectedTeam(null); setMinimized(false); };

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat panel */}
      {(open && selectedTeam) && (
        <div className={`bg-surface border border-border rounded-2xl shadow-2xl w-[320px] sm:w-[360px] flex flex-col overflow-hidden transition-all ${minimized ? "h-[52px]" : "h-[450px] max-h-[80vh]"}`}>
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gold/5 shrink-0 w-full">
            <div className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setShowMembers(!showMembers)} role="button" tabIndex={0}>
              <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold text-xs font-bold shrink-0">
                {currentTeam?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{currentTeam?.name || "Chat"}</p>
                <p className="text-[10px] text-muted">{teamMembers.length} miembros · {onlineCount} activos</p>
              </div>
            </div>
            <div className="flex gap-0.5 shrink-0">
              <button onClick={() => setMinimized(!minimized)} className="p-1 text-muted hover:text-foreground transition-colors"><Minus className="w-4 h-4" /></button>
              <button onClick={() => { setSelectedTeam(null); setMinimized(false); setShowMembers(false); }} className="p-1 text-muted hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
            </div>
          </div>
          {showMembers && (
            <div className="border-b border-border bg-background/50 max-h-[150px] overflow-y-auto">
              <div className="px-4 py-2 space-y-1">
                <p className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Miembros</p>
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-2 py-1">
                    <Circle className={`w-2 h-2 ${activeMemberIds.has(m.id) ? "text-green-400 fill-green-400" : "text-muted fill-muted/30"}`} />
                    <span className="text-xs">{m.username}</span>
                    {m.id === userId && <span className="text-[9px] text-gold">(tú)</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {!minimized && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="w-5 h-5 text-muted animate-spin" /></div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-xs text-muted"><p className="text-center">Sin mensajes aún.</p></div>
                ) : (
                  messages.map((m, i) => {
                    const isSelf = m.senderId === userId;
                    const isTemp = m.id?.startsWith("temp-");
                    return (
                      <div key={m.id || i} className={`flex gap-2 text-sm ${isSelf ? "flex-row-reverse" : ""}`}>
                        <div className={`max-w-[85%] px-3 py-2 space-y-1 ${isSelf ? "bg-gold/20 text-foreground rounded-2xl rounded-tr-sm" : "bg-background text-foreground rounded-2xl rounded-tl-sm border border-border"} ${isTemp && m._status === "sending" ? "opacity-60" : ""} ${m._status === "failed" ? "border border-red-500/50" : ""}`}>
                          {!isSelf && <p className="text-[10px] text-gold font-bold">{m.sender?.username || "?"}</p>}
                          {m.content && <p className="text-sm">{m.content}</p>}
                          {m.imageUrl && <img src={m.imageUrl} alt="" className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity" style={{ maxHeight: 180 }} onClick={() => window.open(m.imageUrl, "_blank")} />}
                          <div className="flex items-center justify-end gap-2">
                            {m._status === "failed" ? (
                              <button
                                onClick={() => retryMessage(m)}
                                className="inline-flex items-center gap-1 text-[9px] text-red-400 hover:text-red-300 font-bold"
                              >
                                <RotateCcw className="w-2.5 h-2.5" /> No enviado · Reintentar
                              </button>
                            ) : (
                              <p className="text-[8px] text-muted text-right">
                                {m._status === "sending"
                                  ? "Enviando…"
                                  : new Date(m.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>
              {previewImg && (
                <div className="relative px-3 pt-2 border-t border-border">
                  <div className="relative inline-block">
                    <img src={previewImg} alt="" className="h-14 rounded-lg" />
                    <button onClick={() => setPreviewImg(null)} className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                  </div>
                </div>
              )}
              <div className="border-t border-border p-2 flex gap-1.5 items-end">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="p-1.5 text-muted hover:text-gold transition-colors shrink-0 disabled:opacity-50">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                </button>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} className="hidden" />
                <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} onPaste={handlePaste}
                  placeholder="Mensaje..." className="flex-1 px-3 py-1.5 bg-background border border-border rounded-lg text-sm text-foreground placeholder-muted focus:outline-none focus:border-gold" />
                <button onClick={sendMessage} disabled={!input.trim() && !previewImg}
                  className="w-8 h-8 bg-gold text-background rounded-lg flex items-center justify-center disabled:opacity-50 hover:bg-gold-hover transition-colors shrink-0">
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Team list */}
      {(open && !selectedTeam) && (
        <div className="bg-surface border border-border rounded-2xl shadow-2xl w-[280px] sm:w-[300px] overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-gold" />
              Conversaciones
              {totalUnread > 0 && <span className="text-[10px] text-muted">({totalUnread} nuevos)</span>}
            </h3>
            <button onClick={closeChat} className="p-0.5 text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {teams.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted"><Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No tienes equipos activos</p></div>
            ) : (
              teams.map((team) => {
                const unread = unreadByTeam[team.id] || 0;
                return (
                  <button key={team.id} onClick={() => openChat(team.id)}
                    className="w-full text-left px-4 py-3 hover:bg-background transition-colors flex items-center gap-3 border-b border-border last:border-0">
                    <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center text-gold text-sm font-bold shrink-0">
                      {team.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-[10px] text-muted">{team.memberCount} miembros</p>
                    </div>
                    <div className="relative">
                      <MessageSquare className="w-4 h-4 text-muted shrink-0" />
                      {unread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => { if (open) closeChat(); else openChat(); }}
        className="w-14 h-14 rounded-full bg-gold text-background shadow-xl shadow-gold/30 flex items-center justify-center hover:bg-gold-hover transition-all hover:scale-105 active:scale-95 relative"
      >
        {open ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
        {!open && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg animate-pulse">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
