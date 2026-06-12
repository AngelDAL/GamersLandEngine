import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users, Shield, UserPlus, Gamepad2 } from "lucide-react";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/auth/login");

  const allUsers = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      role: true,
      createdAt: true,
      _count: { select: { registrations: true, memberships: true } },
    },
  });

  const roleColors: Record<string, string> = {
    ADMIN: "bg-red-500/20 text-red-400 border-red-500/30",
    ORGANIZER: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    SPONSOR: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    PLAYER: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const counts = {
    total: allUsers.length,
    admins: allUsers.filter((u) => u.role === "ADMIN").length,
    orgs: allUsers.filter((u) => u.role === "ORGANIZER").length,
    sponsors: allUsers.filter((u) => u.role === "SPONSOR").length,
    players: allUsers.filter((u) => u.role === "PLAYER").length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-black text-foreground flex items-center gap-3 mb-8">
        <Users className="w-8 h-8 text-gold" />
        Usuarios
      </h1>

      <div className="grid gap-3 md:grid-cols-5 mb-8">
        <Card className="p-3 text-center"><p className="text-xs text-muted">Total</p><p className="text-xl font-bold">{counts.total}</p></Card>
        <Card className="p-3 text-center border-red-500/30"><p className="text-xs text-muted">Admins</p><p className="text-xl font-bold text-red-400">{counts.admins}</p></Card>
        <Card className="p-3 text-center border-blue-500/30"><p className="text-xs text-muted">Organizadores</p><p className="text-xl font-bold text-blue-400">{counts.orgs}</p></Card>
        <Card className="p-3 text-center border-purple-500/30"><p className="text-xs text-muted">Sponsors</p><p className="text-xl font-bold text-purple-400">{counts.sponsors}</p></Card>
        <Card className="p-3 text-center border-green-500/30"><p className="text-xs text-muted">Jugadores</p><p className="text-xl font-bold text-green-400">{counts.players}</p></Card>
      </div>

      <Card>
        <div className="space-y-1">
          {allUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-background transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold bg-gold/10 text-gold">
                  {u.username[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm">{u.username}</p>
                  <p className="text-xs text-muted">
                    {u._count.registrations} torneos · {u._count.memberships} equipos
                  </p>
                </div>
              </div>
              <Badge variant={u.role === "ADMIN" ? "red" : u.role === "ORGANIZER" ? "blue" : u.role === "SPONSOR" ? "gold" : "green"}>
                {u.role}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
