"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { TeamInviteDrawer } from "@/components/player/TeamInviteDrawer";
import { NotificationListener } from "@/components/player/NotificationListener";

type ApiTeam = {
  id: string;
  name: string;
  _count?: { members?: number };
  members?: { userId: string; status: string }[];
};

function GlobalChat() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<{ id: string; name: string; memberCount: number }[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ApiTeam[]) => {
        const userTeams = (Array.isArray(data) ? data : [])
          .filter((t) => t.members?.some((m) => m.userId === session.user.id && m.status === "ACTIVE"))
          .map((t) => ({
            id: t.id,
            name: t.name,
            memberCount: t._count?.members || t.members?.length || 0,
          }));
        setTeams(userTeams);
      })
      .catch(() => {});
  }, [session]);

  if (!session?.user) return null;

  return <ChatWidget userId={session.user.id} teams={teams} />;
}

function AppNotifications() {
  const { data: session } = useSession();
  if (!session?.user?.id) return null;
  return <NotificationListener userId={session.user.id} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <GlobalChat />
      <TeamInviteDrawer />
      <AppNotifications />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: "#141B2D",
            border: "1px solid #1E2A45",
            color: "#E8E6E3",
          },
        }}
      />
    </SessionProvider>
  );
}
