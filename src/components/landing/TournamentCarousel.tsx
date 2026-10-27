"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  UserPlus, Users, ClipboardList, Swords, Trophy,
  ChevronLeft, ChevronRight, Gamepad2, LogIn, Search
} from "lucide-react";

type Slide = {
  icon: typeof UserPlus;
  title: string;
  desc: string;
  points: string[];
  btnLabel: string;
  btnHref: string;
  btnIcon: typeof Gamepad2;
  accentColor: string;
};

const SLIDES: Slide[] = [
  {
    icon: UserPlus,
    title: "1. Crea tu cuenta",
    desc: "Solo necesitas un nombre de usuario único. Sin correos, sin contraseñas — entras y ya estás listo para competir.",
    points: ["Ingresa tu nombre de usuario en la pantalla de inicio", "Tu perfil se crea al instante", "Personaliza tu avatar desde tu panel"],
    btnLabel: "CREAR CUENTA",
    btnHref: "/auth/login",
    btnIcon: LogIn,
    accentColor: "from-cyan-500/20 via-cyan-500/5 to-transparent",
  },
  {
    icon: Users,
    title: "2. Forma tu equipo",
    desc: "Invita a tus amigos usando un código QR o buscando su nombre de usuario. Designa un capitán y entren juntos.",
    points: ["Crea un equipo desde tu panel de jugador", "Invita miembros por nombre de usuario", "El capitán confirma a los integrantes"],
    btnLabel: "VER EQUIPOS",
    btnHref: "/teams",
    btnIcon: Search,
    accentColor: "from-purple-500/20 via-purple-500/5 to-transparent",
  },
  {
    icon: ClipboardList,
    title: "3. Elige un torneo",
    desc: "Explora los torneos abiertos, filtra por juego, revisa premios y fechas. Inscribe a tu equipo con un solo clic.",
    points: ["Mira los torneos activos en la página principal", "Revisa fecha, sede y premio mayor", "Confirma tu inscripción al instante"],
    btnLabel: "VER TORNEOS",
    btnHref: "/tournaments",
    btnIcon: Trophy,
    accentColor: "from-amber-500/20 via-amber-500/5 to-transparent",
  },
  {
    icon: Swords,
    title: "4. Juega tus partidas",
    desc: "El bracket se genera automáticamente. Recibe notificaciones de tus partidos, chatea con los rivales y reporta resultados.",
    points: ["Cuenta regresiva automática para cada match", "Chat en vivo con tu oponente", "Los organizadores validan cada resultado"],
    btnLabel: "MIS PARTIDOS",
    btnHref: "/tournaments",
    btnIcon: Swords,
    accentColor: "from-red-500/20 via-red-500/5 to-transparent",
  },
  {
    icon: Trophy,
    title: "5. Gana premios",
    desc: "Conforme avanzas, desbloqueas premios por posición. Los sponsors pueden entregar premios directamente vía código QR.",
    points: ["Premios por puesto y por participación", "Sponsors reparten premios con QR", "Celebración automática para el campeón"],
    btnLabel: "VER PREMIOS",
    btnHref: "/prizes",
    btnIcon: Trophy,
    accentColor: "from-gold/25 via-gold/5 to-transparent",
  },
];

const AUTOPLAY_MS = 5500;

export function TournamentCarousel() {
  const [active, setActive] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((idx: number, dir: 1 | -1 = 1) => {
    setDirection(dir);
    setActive(((idx % SLIDES.length) + SLIDES.length) % SLIDES.length);
  }, []);

  const next = useCallback(() => goTo(active + 1, 1), [active, goTo]);
  const prev = useCallback(() => goTo(active - 1, -1), [active, goTo]);

  // Auto-advance
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDirection(1);
      setActive((a) => (a + 1) % SLIDES.length);
    }, AUTOPLAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [active]);

  const slide = SLIDES[active];
  const Icon = slide.icon;
  const BtnIcon = slide.btnIcon;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-surface mb-10">
      {/* Header */}
      <div className="px-5 sm:px-8 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <Gamepad2 className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">
              ¿Cómo funciona un torneo?
            </h2>
            <p className="text-[10px] sm:text-xs text-muted">Sigue estos pasos para participar</p>
          </div>
        </div>
      </div>

      {/* Slides */}
      <div className="relative min-h-[300px] sm:min-h-[280px]">
        {/* Background gradient */}
        <div
          key={`bg-${active}`}
          className={`absolute inset-0 bg-gradient-to-br ${slide.accentColor} transition-opacity duration-700`}
        />

        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gold/10 rounded-full blur-3xl opacity-40" />

        {/* Slide content */}
        <div className="relative px-5 sm:px-8 lg:px-10 py-6 sm:py-8 flex flex-col sm:flex-row items-start gap-5 sm:gap-8">
          {/* Icon */}
          <div className="shrink-0 flex sm:flex-col items-center sm:items-start gap-4 sm:gap-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 border border-gold/30 flex items-center justify-center shadow-xl shadow-black/30">
              <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-gold" />
            </div>
            <span className="sm:mt-2 text-[10px] font-bold text-gold uppercase tracking-widest text-center sm:text-left">
              {active + 1}/{SLIDES.length}
            </span>
          </div>

          {/* Text + button */}
          <div className="flex-1 min-w-0">
            <h3 className="text-xl sm:text-2xl font-black text-foreground mb-2">{slide.title}</h3>
            <p className="text-xs sm:text-sm text-muted leading-relaxed mb-4 max-w-xl">{slide.desc}</p>

            <ul className="space-y-1.5 mb-5">
              {slide.points.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/80">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>

            <Link
              href={slide.btnHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold hover:bg-gold-hover text-background font-bold rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-gold/20"
            >
              <BtnIcon className="w-4 h-4" />
              {slide.btnLabel}
            </Link>
          </div>
        </div>

        {/* Arrows */}
        <button
          onClick={prev}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border backdrop-blur text-foreground hover:text-gold hover:border-gold/40 transition-all flex items-center justify-center shadow-lg"
          aria-label="Anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={next}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border backdrop-blur text-foreground hover:text-gold hover:border-gold/40 transition-all flex items-center justify-center shadow-lg"
          aria-label="Siguiente"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dots */}
      <div className="px-5 sm:px-8 py-3.5 border-t border-border/60 flex items-center justify-center gap-2">
        {SLIDES.map((_, i) => {
          const isActive = i === active;
          return (
            <button
              key={i}
              onClick={() => goTo(i, i > active ? 1 : -1)}
              className={`rounded-full transition-all duration-300 ${
                isActive ? "bg-gold w-6 h-2" : "bg-border w-2 h-2 hover:bg-muted"
              }`}
              aria-label={`Ir al paso ${i + 1}`}
            />
          );
        })}
      </div>
    </section>
  );
}
