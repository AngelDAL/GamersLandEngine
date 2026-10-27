import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
        const login = (credentials?.username as string)?.trim();
        const password = credentials?.password as string;

        if (!login) return null;

        // Find user by username or email
        const user = await prisma.user.findFirst({
          where: {
            OR: [{ username: login }, { email: login }],
          },
        });

        if (!user) return null;

        // Existing user WITHOUT password set — allow login only if no password provided
        // (backward compatibility: old accounts created before auth update)
        if (!user.passwordHash) {
          if (password) return null; // they entered a password but don't have one set
          // No password → legacy login
          return {
            id: user.id,
            name: user.username,
            role: user.role,
            avatarUrl: user.avatarUrl,
            email: user.email,
          };
        }

        // Password is required for users who have one set
        if (!password) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.avatarUrl = (user as any).avatarUrl;
        token.email = (user as any).email;
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
