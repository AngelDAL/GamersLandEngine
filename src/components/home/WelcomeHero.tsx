"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gamepad2, Trophy, Users, Swords, Crosshair, Zap, ArrowRight,
  Sparkles, Check, X,
} from "lucide-react";

const STORAGE_KEY = "gl_welcome_hidden";

export function WelcomeHero({
  tournamentCount,
  hasSession,
}: {
  tournamentCount: number;
  hasSession: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // setTimeout(0): evita setState síncrono en el cuerpo del efecto
    const id = setTimeout(() => {
      setMounted(true);
      try {
        if (window.localStorage.getItem(STORAGE_KEY) === "1") setHidden(true);
      } catch { /* almacenamiento puede estar bloqueado */ }
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const skip = () => {
    setClosing(true);
    setTimeout(() => {
      setHidden(true);
      try {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {}
    }, 320);
  };

  if (hidden) return null;

  return (
    <section
      aria-label="Bienvenida a GamersLand"
      className={`relative overflow-hidden bg-[#0A0E1A] border-b border-[#1E2A45] transition-all duration-300 ease-out ${
        closing ? "opacity-0 -translate-y-4 max-h-0" : "opacity-100 max-h-[1200px]"
      } ${mounted ? "" : "opacity-0"}`}
    >
      {/* Ambient gradient + subtle grid, no confetti */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(200,170,110,0.16),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(56,189,248,0.10),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v2H24v-2h12zM36 24v2H24v-2h12z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 py-14 sm:py-20">
        {/* Skip */}
        <div className="flex justify-end -mt-4 sm:-mt-8 mb-4">
          <button
            onClick={skip}
            className="inline-flex items-center gap-1.5 text-xs text-[#7B8FA1] hover:text-white transition-colors group"
          >
            Saltar
            <X className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Eyebrow */}
        <div className="flex items-center gap-2 text-[#C8AA6E] text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mb-4">
          <Sparkles className="w-4 h-4" />
          El evento donde se juega en serio
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-6xl font-black leading-[0.95] tracking-tight text-white max-w-3xl">
          El juego empieza
          <br />
          <span className="text-[#C8AA6E]">aquí, en GamersLand.</span>
        </h1>

        <p className="mt-5 max-w-xl text-[#A7B4C4] sm:text-lg leading-relaxed">
          Torneos reales con brackets en vivo, premios de verdad y el mejor ambiente
          para jugar. Entra, arma tu equipo y demuestra quién manda en la Grieta,
          en Valorant y donde sea que quieras el glory.
        </p>

        {/* Feature chips */}
        <div className="mt-7 flex flex-wrap gap-2.5 text-xs sm:text-sm text-[#DCE3EC]">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <Trophy className="w-3.5 h-3.5 text-[#C8AA6E]" /> Premios en efectivo
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <Users className="w-3.5 h-3.5 text-[#C8AA6E]" /> Forma tu equipo
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/10">
            <Gamepad2 className="w-3.5 h-3.5 text-[#C8AA6E]" /> Llaves en tiempo real
          </span>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/tournaments"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#C8AA6E] hover:bg-[#B89A5E] text-[#0A0E1A] font-bold rounded-full text-sm sm:text-base transition-all shadow-lg shadow-[#C8AA6E]/20"
          >
            Ver torneos
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/guia"
            className="inline-flex items-center gap-2 px-6 py-3.5 border border-white/15 hover:border-[#C8AA6E]/60 hover:text-[#C8AA6E] text-[#A7B4C4] font-semibold rounded-full text-sm sm:text-base transition-all"
          >
            Cómo participar
            <Swords className="w-4 h-4" />
          </Link>
          {!hasSession && (
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-6 py-3.5 text-[#A7B4C4] hover:text-white font-semibold rounded-full text-sm sm:text-base transition-all underline underline-offset-4 decoration-[#C8AA6E]/50"
            >
              Entrar y jugar
            </Link>
          )}
        </div>

        {/* Stats bar */}
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <div className="text-2xl font-black text-white">{tournamentCount}</div>
            <div className="text-xs text-[#7B8FA1] uppercase tracking-wider">torneos activos</div>
          </div>
          <div className="flex items-center gap-2 text-[#7B8FA1] border-l border-white/10 pl-8">
            <Check className="w-4 h-4 text-[#C8AA6E]" />
            <span className="text-xs">Registro sin contraseña, solo tu username</span>
          </div>
          <div className="flex items-center gap-2 text-[#7B8FA1] border-l border-white/10 pl-8">
            <Zap className="w-4 h-4 text-[#C8AA6E]" />
            <span className="text-xs">1v1, 5v5 y modos por equipo</span>
          </div>
        </div>
      </div>
    </section>
  );
}