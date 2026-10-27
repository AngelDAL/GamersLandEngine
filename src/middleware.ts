import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas públicas por igualdad exacta. Antes se comparaba con startsWith("/") y
// el middleware nunca cortaba nada: toda la app quedaba abierta.
const PUBLIC_EXACT = new Set([
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/riot.txt",
  // Vitrina pública del producto: perfiles, premios, guía y agentes libres.
  "/prizes",
  "/guia",
  "/free-agents",
  // El webhook de Riot hace POST sin cookie de sesión.
  "/api/riot/callback",
]);

const PUBLIC_PREFIXES = ["/api/auth", "/players"];

function isPublicTournamentPath(pathname: string): boolean {
  if (pathname === "/tournaments") return true;
  const m = pathname.match(/^\/tournaments\/([^/]+)(\/[^/]*)?$/);
  if (!m) return false;
  const slug = m[1];
  const rest = m[2] ?? "";
  // /tournaments/create, /manage y /register exigen sesión.
  if (slug === "create") return false;
  return rest === "" || rest === "/bracket";
}

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/uploads") ||
    pathname.startsWith("/avatars") ||
    pathname.startsWith("/banners") ||
    pathname.startsWith("/covers") ||
    pathname === "/favicon.ico"
  );
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isStaticPath(pathname)) return NextResponse.next();

  const isPublic =
    PUBLIC_EXACT.has(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    isPublicTournamentPath(pathname);

  if (isPublic) return NextResponse.next();

  // Solo se comprueba PRESENCIA de cookie como barrera inicial; la validación
  // real de firma y sesión la hace auth() dentro de cada ruta.
  const token =
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token");

  if (!token) {
    // A las rutas API se les devuelve JSON; a las páginas, redirección al login.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|avatars|riot.txt).*)"],
};
