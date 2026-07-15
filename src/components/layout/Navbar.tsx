"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Gamepad2, Trophy, Plus, LogOut, QrCode, Menu, X } from "lucide-react";
import { QRDrawer } from "@/components/player/QRDrawer";
import { NotificationBell } from "@/components/notifications/NotificationBell";

export function Navbar() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [showQR, setShowQR] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const mainLinks = [
    { href: "/tournaments", label: "Torneos", show: true },
    { href: "/prizes", label: "Premios", show: role === "PLAYER" },
    { href: "/tournaments/create", label: "+ Crear Torneo", show: role === "ADMIN" || role === "ORGANIZER" },
  ].filter((l) => l.show);

  return (
    <>
      <nav className="bg-[#0A0E1A] border-b border-[#1E2A45] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left side: Logo + Desktop links */}
          <div className="flex items-center gap-6 md:gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 text-[#C8AA6E] font-bold shrink-0">
              <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" />
              <span className="text-base sm:text-xl tracking-wider">GAMERSLAND</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-4 md:gap-6 lg:gap-8 text-sm md:text-base text-[#7B8FA1]">
              <Link href="/tournaments" className="hover:text-[#C8AA6E] transition-colors whitespace-nowrap">
                Torneos
              </Link>
              {role === "PLAYER" && (
                <Link href="/prizes" className="hover:text-[#C8AA6E] transition-colors flex items-center gap-1.5 whitespace-nowrap">
                  <Trophy className="w-4 h-4" />
                  Premios
                </Link>
              )}
              {(role === "ADMIN" || role === "ORGANIZER") && (
                <Link
                  href="/tournaments/create"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gold/10 border border-gold/30 text-gold rounded-lg hover:bg-gold/20 transition-colors whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Torneo</span>
                </Link>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {session ? (
              <>
                <Link
                  href={`/dashboard/${role?.toLowerCase()}`}
                  className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm text-[#7B8FA1] hover:text-[#C8AA6E] transition-colors"
                >
                  <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gold/20 flex items-center justify-center text-gold text-[8px] sm:text-[10px] font-bold">
                    {session.user.name?.[0]?.toUpperCase()}
                  </span>
                  <span className="hidden sm:inline truncate max-w-[100px]">{session.user.name}</span>
                </Link>

                <NotificationBell />

                {role === "PLAYER" && (
                  <button
                    onClick={() => setShowQR(true)}
                    className="p-1.5 sm:p-2 text-muted hover:text-gold transition-colors"
                    title="Mostrar QR"
                  >
                    <QrCode className="w-4 h-4 sm:w-4 sm:h-4" />
                  </button>
                )}

                <button
                  onClick={() => signOut()}
                  className="flex items-center gap-1 text-xs sm:text-sm text-[#E84057] hover:text-red-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>

                {/* Mobile menu toggle */}
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden p-1.5 text-muted hover:text-foreground"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#C8AA6E] text-[#0A0E1A] text-xs sm:text-sm font-bold rounded-lg hover:bg-[#B89A5E] transition-colors whitespace-nowrap"
                >
                  Entrar
                </Link>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="md:hidden p-1.5 text-muted hover:text-foreground"
                >
                  {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden mt-2 pt-2 border-t border-border space-y-1">
            {mainLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-muted hover:text-foreground hover:bg-background rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {session && (
              <Link
                href={`/dashboard/${role?.toLowerCase()}`}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 text-sm text-gold hover:bg-background rounded-lg transition-colors"
              >
                Dashboard ({session.user.name})
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* QR Drawer */}
      {session?.user?.id && (
        <QRDrawer
          userId={session.user.id}
          username={session.user.name || ""}
          open={showQR}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  );
}
