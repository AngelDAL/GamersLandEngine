import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const publicPaths = ["/auth/login", "/", "/api/auth", "/riot.txt"];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p) || pathname === p);

  // Tournament pages (list, detail, bracket) are public
  const isTournamentView = pathname.startsWith("/tournaments/") &&
    !pathname.endsWith("/create") &&
    !pathname.includes("/manage") &&
    !pathname.includes("/register");

  const isStatic = pathname.startsWith("/_next") || pathname.startsWith("/uploads") || pathname.startsWith("/avatars") || pathname.startsWith("/banners");
  if (isStatic) return NextResponse.next();
  if (isPublic || isTournamentView) return NextResponse.next();

  const token = req.cookies.get("next-auth.session-token") || req.cookies.get("__Secure-next-auth.session-token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|avatars|riot.txt).*)"],
};
