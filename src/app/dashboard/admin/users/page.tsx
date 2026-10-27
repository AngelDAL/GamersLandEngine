import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ArrowLeft } from "lucide-react";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") redirect("/auth/login");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/dashboard/admin"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver al panel
      </Link>

      <h1 className="text-3xl font-black text-foreground flex items-center gap-3 mb-8">
        <Users className="w-8 h-8 text-gold" />
        Usuarios
      </h1>

      <AdminUsersClient />
    </div>
  );
}
