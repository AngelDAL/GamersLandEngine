"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  Trophy,
  Users,
  User,
  Menu,
  X,
  Home,
  MessageCircle,
  Gamepad2,
  Settings,
  QrCode,
  Award,
  Bell,
  LogOut,
  Shield,
} from "lucide-react";
import { QRDrawer } from "@/components/player/QRDrawer";

type Icon = React.ComponentType<{ className?: string }>;

const exact = (p: string, prefix: string) =>
  p === prefix || p.startsWith(`${prefix}/`);

type DrawerItem =
  | { kind: "link"; href: string; label: string; icon: Icon }
  | { kind: "action"; label: string; icon: Icon; onClick: () => void };

/**
 * Mobile-only fixed bottom tab bar (4 large items) with a slide-up drawer
 * for secondary navigation. Hidden on `md` and up.
 */
export function MobileBottomTabs() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const pathname = usePathname() || "/";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Close on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while drawer is open (but keep main page scrollable
  // when the drawer is closed). Position fixed on the drawer means
  // overscroll won't propagate to body anyway.
  useEffect(() => {
    if (!drawerOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [drawerOpen]);

  // ESC to close
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Resolve the profile href based on auth/role
  const profileHref = !session
    ? "/auth/login"
    : role === "ADMIN" || role === "ORGANIZER"
      ? "/dashboard/admin"
      : "/dashboard/player";

  const isProfileActive = () => {
    if (!session) return pathname.startsWith("/auth/login");
    return pathname.startsWith("/dashboard");
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/tournaments") return exact(pathname, "/tournaments");
    if (href === "/teams") return exact(pathname, "/teams");
    if (href.startsWith("/dashboard")) return pathname.startsWith("/dashboard");
    return exact(pathname, href);
  };

  const closeDrawer = () => setDrawerOpen(false);

  // Drawer items — order matters
  const drawerItems: DrawerItem[] = [
    { kind: "link", href: "/", label: "Inicio", icon: Home },
    {
      kind: "link",
      href: "/dashboard/player",
      label: "Mis Torneos",
      icon: Gamepad2,
    },
    { kind: "link", href: "/teams", label: "Equipos", icon: Users },
    { kind: "link", href: "/prizes", label: "Premios", icon: Award },
  ];

  // Auth-only drawer items
  if (session) {
    drawerItems.push({
      kind: "action",
      label: "Notificaciones",
      icon: Bell,
      onClick: () => {
        closeDrawer();
        // The header NotificationBell handles its own dropdown; close here
        // and let the user open it from the header. We just give a hint:
        window.dispatchEvent(new CustomEvent("gamersland:focus-notifications"));
      },
    });
    if (session.user?.id) {
      drawerItems.push({
        kind: "action",
        label: "Mi QR",
        icon: QrCode,
        onClick: () => {
          closeDrawer();
          // Open QR on the next tick so the drawer unmount doesn't visually clash
          setTimeout(() => setShowQR(true), 50);
        },
      });
    }
    drawerItems.push({
      kind: "link",
      href: profileHref,
      label: "Ajustes",
      icon: Settings,
    });
    if (role === "ADMIN" || role === "ORGANIZER") {
      drawerItems.push({
        kind: "link",
        href: "/dashboard/admin",
        label: "Panel Admin",
        icon: Shield,
      });
    }
  } else {
    // Visitors also get a Messages entry pointing to auth so they sign in
    drawerItems.push({
      kind: "link",
      href: "/auth/login",
      label: "Mensajes",
      icon: MessageCircle,
    });
    drawerItems.push({
      kind: "link",
      href: "/auth/login",
      label: "Ajustes",
      icon: Settings,
    });
  }

  // Logout last (only when signed in)
  if (session) {
    drawerItems.push({
      kind: "action",
      label: "Cerrar Sesión",
      icon: LogOut,
      onClick: () => {
        closeDrawer();
        signOut({ callbackUrl: "/" });
      },
    });
  }

  // Active-route helper for drawer items
  const drawerIsActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href.startsWith("/dashboard")) return pathname.startsWith("/dashboard");
    return exact(pathname, href);
  };

  return (
    <>
      {/* Bottom tab bar — 4 large items, h-16, hidden md+ */}
      <nav
        aria-label="Navegación inferior"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0A0E1A] border-t border-[#1E2A45] pb-[env(safe-area-inset-bottom)] h-16 shadow-[0_-4px_12px_rgba(0,0,0,0.4)]"
      >
        <ul className="flex items-stretch justify-around h-full">
          {/* Torneos */}
          <li className="flex-1 min-w-0">
            <Link
              href="/tournaments"
              aria-current={isActive("/tournaments") ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 h-full px-1 text-xs font-semibold transition-colors ${
                isActive("/tournaments")
                  ? "text-[#C8AA6E]"
                  : "text-[#7B8FA1] hover:text-[#E8E6E3]"
              }`}
            >
              <Trophy
                className={`w-6 h-6 ${isActive("/tournaments") ? "scale-110" : ""} transition-transform`}
              />
              <span className="truncate w-full text-center leading-tight">Torneos</span>
            </Link>
          </li>

          {/* Equipos */}
          <li className="flex-1 min-w-0">
            <Link
              href="/teams"
              aria-current={isActive("/teams") ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 h-full px-1 text-xs font-semibold transition-colors ${
                isActive("/teams")
                  ? "text-[#C8AA6E]"
                  : "text-[#7B8FA1] hover:text-[#E8E6E3]"
              }`}
            >
              <Users
                className={`w-6 h-6 ${isActive("/teams") ? "scale-110" : ""} transition-transform`}
              />
              <span className="truncate w-full text-center leading-tight">Equipos</span>
            </Link>
          </li>

          {/* Perfil */}
          <li className="flex-1 min-w-0">
            <Link
              href={profileHref}
              aria-current={isProfileActive() ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 h-full px-1 text-xs font-semibold transition-colors ${
                isProfileActive()
                  ? "text-[#C8AA6E]"
                  : "text-[#7B8FA1] hover:text-[#E8E6E3]"
              }`}
            >
              <User
                className={`w-6 h-6 ${isProfileActive() ? "scale-110" : ""} transition-transform`}
              />
              <span className="truncate w-full text-center leading-tight">Perfil</span>
            </Link>
          </li>

          {/* Más — opens drawer */}
          <li className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Más opciones"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              className={`flex flex-col items-center justify-center gap-1 h-full w-full px-1 text-xs font-semibold transition-colors ${
                drawerOpen
                  ? "text-[#C8AA6E]"
                  : "text-[#7B8FA1] hover:text-[#E8E6E3]"
              }`}
            >
              <Menu className="w-6 h-6" />
              <span className="truncate w-full text-center leading-tight">Más</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Slide-up drawer */}
      <div
        aria-hidden={!drawerOpen}
        className={`md:hidden fixed inset-0 z-[60] ${drawerOpen ? "" : "pointer-events-none"}`}
      >
        {/* Backdrop */}
        <div
          onClick={closeDrawer}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Drawer panel — slides up from the bottom */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Más opciones"
          className={`absolute inset-x-0 bottom-0 bg-[#0A0E1A] border-t border-[#1E2A45] rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.5)] transition-transform duration-300 ease-out ${
            drawerOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ maxHeight: "85vh" }}
        >
          <div className="flex flex-col max-h-[85vh]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-[#1E2A45]" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b border-[#1E2A45]">
              <div>
                <h2 className="text-lg font-bold text-[#E8E6E3]">Más opciones</h2>
                <p className="text-[11px] text-[#7B8FA1] mt-0.5">
                  {session
                    ? `Sesión: ${session.user?.name ?? "invitado"}`
                    : "Explora la plataforma"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                aria-label="Cerrar"
                className="p-2 rounded-lg text-[#7B8FA1] hover:text-[#E8E6E3] hover:bg-[#1E2A45] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <nav className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
              <ul className="space-y-1">
                {drawerItems.map((item, idx) => {
                  const Icon = item.icon;
                  const active =
                    item.kind === "link" ? drawerIsActive(item.href) : false;
                  const isLogout = item.kind === "action" && item.label === "Cerrar Sesión";
                  const base =
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors";
                  const tone = isLogout
                    ? "text-[#E84057] hover:bg-[#E84057]/10"
                    : active
                      ? "bg-[#C8AA6E]/10 text-[#C8AA6E] border border-[#C8AA6E]/30"
                      : "text-[#E8E6E3] hover:bg-[#1E2A45]";

                  if (item.kind === "link") {
                    return (
                      <li key={`link-${item.href}-${idx}`}>
                        <Link
                          href={item.href}
                          onClick={closeDrawer}
                          className={`${base} ${tone}`}
                        >
                          <Icon className="w-5 h-5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                          {active && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#C8AA6E]" />
                          )}
                        </Link>
                      </li>
                    );
                  }
                  return (
                    <li key={`action-${item.label}-${idx}`}>
                      <button
                        type="button"
                        onClick={item.onClick}
                        className={`${base} ${tone} w-full text-left`}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-[#1E2A45] text-[10px] text-[#7B8FA1] text-center">
              Toca fuera o presiona ESC para cerrar
            </div>
          </div>
        </div>
      </div>

      {/* QR Drawer (re-used) */}
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
