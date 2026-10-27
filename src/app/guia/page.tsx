import Link from "next/link";
import {
  LogIn, Users, Trophy, ClipboardCheck, CalendarCheck, ArrowRight,
  Swords, Gamepad2, HelpCircle, Lightbulb, Medal,
} from "lucide-react";

const steps = [
  {
    n: "1",
    icon: LogIn,
    title: "Entra con tu username",
    body: "No necesitas contraseña ni email. En la página de entrada escribe tu nombre de jugador; si no existe, tu cuenta se crea sola. Así quedas registrado en el sistema.",
    cta: { href: "/auth/login", label: "Entrar" },
  },
  {
    n: "2",
    icon: Users,
    title: "Arma tu equipo (si el torneo es por equipo)",
    body: "La mayoría de torneos son en equipo (5v5, squad, etc.). Crea tu team y agrega a tus compas, o únete a un equipo existente. Para los torneos 1v1 este paso no hace falta.",
    cta: { href: "/teams/create", label: "Crear equipo" },
  },
  {
    n: "3",
    icon: Trophy,
    title: "Elige tu torneo",
    body: "Entra a Torneos y abre uno con estado “Abierto”. Revisa la modalidad (equipo o 1v1), el juego, fecha, cupo (X equipos máximo) y los premios. ¡Cupos limitados!",
    cta: { href: "/tournaments", label: "Ver torneos" },
  },
  {
    n: "4",
    icon: ClipboardCheck,
    title: "Regístrate",
    body: "En la página del torneo pulsa el botón de registro. Si es por equipo, elige tu team; si es individual, se registra tu cuenta. El registro queda pendiente hasta que confirmen.",
  },
  {
    n: "5",
    icon: CalendarCheck,
    title: "Confirma tu lugar y agenda",
    body: "Si el torneo tiene inscripción ($), confirma el pago con el organizador. Tu registro debe quedar “Confirmado” y lo verás en Mis torneos y en tu Dashboard.",
  },
  {
    n: "6",
    icon: Medal,
    title: "Juega y sigue el bracket",
    body: "Cuando arranque, tu horario y rivales aparecen en tiempo real. Llega puntual; el organizador registrará los resultados. ¡A celebrar en la entrega de premios!",
  },
];

const faq = [
  {
    q: "¿Y si no tengo equipo?",
    a: "Para torneos 1v1 puedes inscribirte directo. Para los de equipo, crea uno o únete a uno que esté reclutando en la sección de Equipos (o en Detalles del torneo).",
  },
  {
    q: "¿La registración es gratis?",
    a: "Depende del torneo. Cada uno indica su inscripción ($) y su premio. Los torneos de prueba/demo suelen ser gratis.",
  },
  {
    q: "¿Cómo sé mi horario de partido?",
    a: "En la página del torneo (pestaña Bracket) y en tus torneos del Dashboard verás tu próximo partido con hora y rival en tiempo real.",
  },
  {
    q: "¿Puedo registrarme a varios torneos?",
    a: "Sí. Cada torneo es independiente. Solo asegúrate de cumplir los horarios si juegas en más de uno.",
  },
];

export const metadata = {
  title: "Cómo registrarte | GamersLand",
  description: "Guía paso a paso para registrarte a un torneo en GamersLand.",
};

export default function GuiaPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Head */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 text-gold text-xs sm:text-sm font-bold uppercase tracking-[0.2em] mb-3">
          <Swords className="w-4 h-4" /> Guía rápida
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          Cómo registrarte a un torneo
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-muted sm:text-lg">
          Registrar tu equipo (o tu name) en un torneo toma menos de un minuto.
          Sigue estos pasos y en un rato estás en el bracket.
        </p>
      </div>

      {/* Steps */}
      <ol className="grid gap-5 md:grid-cols-2">
        {steps.map((s) => (
          <li
            key={s.n}
            className="relative bg-surface border border-border rounded-2xl p-6 flex gap-4 hover:border-gold/40 transition-colors"
          >
            <div className="shrink-0 flex flex-col items-center">
              <div className="w-11 h-11 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold">
                <s.icon className="w-5 h-5" />
              </div>
              <span className="mt-2 text-[10px] font-bold text-muted">PASO</span>
              <span className="text-2xl font-black text-gold leading-none">{s.n}</span>
            </div>
            <div>
              <h2 className="font-bold text-foreground mb-1.5">{s.title}</h2>
              <p className="text-sm text-muted leading-relaxed">{s.body}</p>
              {s.cta && (
                <Link
                  href={s.cta.href}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm text-gold hover:underline"
                >
                  {s.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* FAQ */}
      <section className="mt-14">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 mb-5">
          <HelpCircle className="w-5 h-5 text-gold" /> Dudas frecuentes
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {faq.map((f) => (
            <div key={f.q} className="bg-surface border border-border rounded-xl p-5">
              <h3 className="font-semibold text-foreground mb-1.5 flex items-center gap-2">
                <Gamepad2 className="w-4 h-4 text-gold shrink-0" /> {f.q}
              </h3>
              <p className="text-sm text-muted leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tip */}
      <aside className="mt-10 bg-gold/[0.04] border border-gold/20 rounded-2xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center text-gold shrink-0">
          <Lightbulb className="w-5 h-5" />
        </div>
        <p className="text-sm text-muted leading-relaxed">
          <span className="font-bold text-foreground">Tip:</span> los torneos con
          estado <span className="text-green-400 font-semibold">“Abierto”</span> aceptan
          registros en este momento. Los de <span className="text-muted">“Planeación”</span>{" "}
          están por abrir. Mira la pestaña <span className="text-foreground font-semibold">Mis
          torneos</span> en la portada para seguir el estado de lo que ya registraste.
        </p>
      </aside>

      {/* CTA */}
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gold hover:bg-gold-hover text-background font-bold rounded-full text-sm sm:text-base transition-all shadow-lg shadow-gold/20"
        >
          <Trophy className="w-4 h-4" /> Ver torneos abiertos
        </Link>
        <Link
          href="/teams"
          className="inline-flex items-center gap-2 px-6 py-4 border border-border hover:border-gold/50 text-muted hover:text-gold font-semibold rounded-full text-sm transition-all"
        >
          <Users className="w-4 h-4" /> Explorar equipos
        </Link>
      </div>
    </div>
  );
}