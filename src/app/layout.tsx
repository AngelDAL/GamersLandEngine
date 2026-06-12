import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import { Navbar } from "@/components/layout/Navbar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GamersLand - Sistema de Torneos",
  description: "Plataforma de gestión de torneos de videojuegos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${inter.className} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
