"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { TeamInviteDrawer } from "@/components/player/TeamInviteDrawer";

function GlobalChat() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<{ id: string; name: string; memberCount: number }[]>([]);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: any[]) => {
        const userTeams = data
          .filter((t: any) => t.members?.some((m: any) => m.userId === session.user.id && m.status === "ACTIVE"))
          .map((t: any) => ({
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

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <GlobalChat />
      <TeamInviteDrawer />
    </SessionProvider>
  );
}
