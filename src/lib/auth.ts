import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Rate limiting en memoria por usuario: 10 fallos en 15 minutos bloquean el
// intento sin consultar la BD. Es simple a propósito — un ataque de fuerza bruta
// no debe poder ni siquiera llegar a bcrypt, que es deliberadamente lento.
// Cada instancia del proceso tiene su propio mapa, suficiente para un solo server.
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { fails: number; until: number }>();

function isRateLimited(login: string): boolean {
  const key = login.toLowerCase();
  const entry = loginAttempts.get(key);
  if (!entry) return false;
  // Limpieza perezosa: al tocar la entrada vencida la descartamos.
  if (entry.until <= Date.now()) {
    loginAttempts.delete(key);
    return false;
  }
  return entry.fails >= MAX_FAILS;
}

function recordFailure(login: string) {
  const key = login.toLowerCase();
  const entry = loginAttempts.get(key);
  const now = Date.now();
  if (!entry || entry.until <= now) {
    loginAttempts.set(key, { fails: 1, until: now + WINDOW_MS });
    return;
  }
  entry.fails += 1;
}

function clearFailures(login: string) {
  loginAttempts.delete(login.toLowerCase());
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Usuario o Email", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const login =
          typeof credentials?.username === "string"
            ? credentials.username.trim()
            : "";
        const password =
          typeof credentials?.password === "string" ? credentials.password : "";

        if (!login) return null;

        // Password siempre string y con longitud mínima antes de tocar bcrypt.
        if (password.length < 6) return null;

        if (isRateLimited(login)) return null;

        // Buscar usuario por username o correo
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ username: login }, { email: login }],
          },
        });

        if (!user) {
          recordFailure(login);
          return null;
        }

        // Sin contraseña registrada no hay camino legacy: se rechaza siempre.
        if (!user.passwordHash) {
          recordFailure(login);
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          recordFailure(login);
          return null;
        }

        clearFailures(login);
        return {
          id: user.id,
          name: user.username,
          role: user.role,
          avatarUrl: user.avatarUrl,
          email: user.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.role = user.role;
        token.avatarUrl = user.avatarUrl;
        token.email = user.email ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.avatarUrl = token.avatarUrl as string | null;
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
  },
});
