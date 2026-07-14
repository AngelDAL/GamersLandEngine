"use client";

import { UserPlus, Users, ClipboardList, Shuffle, Swords, Trophy, Sparkles } from "lucide-react";

type Step = {
  icon: typeof UserPlus;
  step: string;
  title: string;
  description: string;
  gradient: string;
  badge: string;
};

const STEPS: Step[] = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crea tu cuenta",
    description: "Solo necesitas un nombre de usuario. Sin emails ni contraseñas complicadas.",
    gradient: "from-blue-accent/80 via-blue-accent/40 to-transparent",
    badge: "Registro",
  },
  {
    icon: Users,
    step: "02",
    title: "Forma tu equipo",
    description: "Arma tu escuadrón. Invita amigos por QR o username y asigna un capitán.",
    gradient: "from-purple-500/80 via-purple-500/40 to-transparent",
    badge: "Equipo",
  },
  {
    icon: ClipboardList,
    step: "03",
    title: "Inscríbete al torneo",
    description: "Explora torneos activos, revisa reglas y premios. Un click y quedas registrado.",
    gradient: "from-amber-500/80 via-amber-500/40 to-transparent",
    badge: "Inscripción",
  },
  {
    icon: Shuffle,
    step: "04",
    title: "Se genera el bracket",
    description: "Al cerrar inscripciones, el bracket se arma automáticamente según el formato.",
    gradient: "from-cyan-500/80 via-cyan-500/40 to-transparent",
    badge: "Bracket",
  },
  {
    icon: Swords,
    step: "05",
    title: "Juega tus partidas",
    description: "Cada partido tiene cuenta regresiva, chat y reporte de resultados en vivo.",
    gradient: "from-red-500/80 via-red-500/40 to-transparent",
    badge: "Partidas",
  },
  {
    icon: Trophy,
    step: "06",
    title: "Gana premios",
    description: "Avanzas en el bracket, los sponsors reparten premios y el campeón se corona.",
    gradient: "from-gold/80 via-gold/40 to-transparent",
    badge: "Premios",
  },
];

export function TournamentHowItWorks() {
  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">
            ¿Cómo se juega un torneo?
          </h2>
          <p className="text-xs text-muted">
            Paso a paso — de la inscripción al trofeo
          </p>
        </div>
      </div>

      {/* Grid de tarjetas — mismo estilo que TournamentCard */}
      <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.step}
              className="bg-surface border border-border rounded-xl overflow-hidden hover:border-gold/50 hover:shadow-xl hover:shadow-gold/5 transition-all duration-200 h-full flex flex-col group"
            >
              {/* Banner — mismo estilo que TournamentCard */}
              <div className="relative h-28 overflow-hidden">
                <div className={`absolute inset-0 bg-gradient-to-br ${step.gradient}`} />
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0xaDEyek0zNiAyNHYySDI0di0xaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                <div className="relative h-full flex items-end p-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-black/40 backdrop-blur flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-white font-bold text-sm drop-shadow-lg">
                      {step.badge}
                    </span>
                  </div>
                </div>
              </div>

              {/* Content — mismo padding y tipografía que TournamentCard */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-foreground group-hover:text-gold transition-colors text-sm">
                    {step.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border shrink-0 text-gold bg-gold/10 border-gold/30">
                    {step.step}
                  </span>
                </div>
                <p className="text-xs text-muted leading-relaxed flex-1">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
