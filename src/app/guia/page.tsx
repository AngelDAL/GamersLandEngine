import Link from "next/link";
import {
  LogIn, Users, Trophy, ClipboardCheck, CalendarCheck, ArrowRight,
  Swords, Gamepad2, HelpCircle, Lightbulb, Medal, UserSearch, Gift,
} from "lucide-react";

const steps = [
  {
    n: "1",
    icon: LogIn,
    title: "Entra con tu nombre de jugador",
    body: "No necesitas contraseña ni correo. Escribe tu nombre de jugador en la pantalla de inicio; si no existe, tu cuenta se crea sola.",
    cta: { href: "/auth/login", label: "Entrar" },
  },
  {
    n: "2",
    icon: Users,
    title: "Arma tu equipo (si el torneo es por equipo)",
    body: "Crea tu equipo y agrega a tus compañeros por nombre o código QR, o únete a uno existente desde la sección de Agentes libres. En los torneos 1v1 este paso no hace falta.",
    cta: { href: "/free-agents", label: "Ver agentes libres" },
  },
  {
    n: "3",
    icon: Trophy,
    title: "Elige tu torneo",
    body: "Entra a Torneos y abre uno con estado “Abierto”. Revisa la modalidad (equipo o 1v1), el juego, la fecha, el cupo y los premios. Los cupos son limitados.",
    cta: { href: "/tournaments", label: "Ver torneos" },
  },
  {
    n: "4",
    icon: ClipboardCheck,
    title: "Manda tu solicitud de inscripción",
    body: "En la página del torneo pulsa el botón de registro. Si es por equipo, elige tu equipo; si es individual, se registra tu cuenta. Tu solicitud queda “Pendiente” hasta que el organizador la revise.",
  },
  {
    n: "5",
    icon: CalendarCheck,
    title: "Espera la aprobación y confirma tu lugar",
    body: "El organizador aprueba las inscripciones y las marca como “Confirmadas”. Si el torneo tiene cuota, confirma el pago con el organizador. Verás el estado en Mis torneos y en tu panel.",
  },
  {
    n: "6",
    icon: Swords,
    title: "Juega y sigue tu llave",
    body: "Cuando arranque, tu horario y tus rivales aparecen en la llave, en tiempo real. Llega puntual; si el organizador usa registro con código QR, muéstralo desde tu perfil. El organizador marca los resultados.",
  },
  {
    n: "7",
    icon: Medal,
    title: "Gana y reclama tu premio",
    body: "Al finalizar el torneo, tus premios aparecen en la sección de Premios. Preséntate con el organizador o el patrocinador para recibirlos.",
    cta: { href: "/prizes", label: "Ver premios" },
  },
];

const faq = [
  {
    q: "¿Y si no tengo equipo?",
    a: "Para torneos 1v1 puedes inscribirte directo. Para los de equipo, crea uno nuevo o busca quienes reclutan en la sección de Agentes libres.",
  },
  {
    q: "¿El registro es gratis?",
    a: "Depende del torneo. Cada uno indica su cuota y sus premios. Los torneos de práctica suelen ser gratis.",
  },
  {
    q: "¿Cómo sé mi horario de partido?",
    a: "En la página del torneo, en la llave, y en tu panel de jugador verás tu próximo partido con hora y rival, en tiempo real.",
  },
  {
    q: "¿Puedo inscribirme a varios torneos?",
    a: "Sí. Cada torneo es independiente. Solo asegúrate de cumplir los horarios si juegas en más de uno.",
  },
  {
    q: "¿Necesito código QR?",
    a: "Solo si el organizador del torneo lo usa para registro o entrega de premios. Lo encuentras en el menú de tu cuenta, en “Mi código QR”.",
  },
  {
    q: "¿Cómo consigo equipo?",
    a: "Publica tu perfil en Agentes libres: los capitanes te encuentran ahí y te pueden invitar directo a su equipo.",
  },
];

export const metadata = {
  title: "Cómo participar | GamersLand",
  description: "Guía paso a paso para participar en un torneo de GamersLand.",
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
          Cómo participar en un torneo
        </h1>
        <p className="mt-4 max-w-2xl mx-auto text-muted sm:text-lg">
          Inscribirte (a ti o a tu equipo) toma menos de un minuto.
          Sigue estos pasos y en un rato estás jugando tu primer partido.
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
          inscripciones en este momento. Los de <span className="text-muted">“Planeación”</span>{" "}
          están por abrir. Revisa <span className="text-foreground font-semibold">Mis
          torneos</span> en tu panel para seguir el estado de lo que ya registraste.
        </p>
      </aside>

      {/* CTA */}
      <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 px-8 py-4 min-h-12 bg-gold hover:bg-gold-hover text-background font-bold rounded-full text-sm sm:text-base transition-all shadow-lg shadow-gold/20"
        >
          <Trophy className="w-4 h-4" /> Ver torneos abiertos
        </Link>
        <Link
          href="/teams"
          className="inline-flex items-center gap-2 px-6 py-4 min-h-12 border border-border hover:border-gold/50 text-muted hover:text-gold font-semibold rounded-full text-sm transition-all"
        >
          <Users className="w-4 h-4" /> Explorar equipos
        </Link>
        <Link
          href="/free-agents"
          className="inline-flex items-center gap-2 px-6 py-4 min-h-12 border border-border hover:border-gold/50 text-muted hover:text-gold font-semibold rounded-full text-sm transition-all"
        >
          <UserSearch className="w-4 h-4" /> Agentes libres
        </Link>
        <Link
          href="/prizes"
          className="inline-flex items-center gap-2 px-6 py-4 min-h-12 border border-border hover:border-gold/50 text-muted hover:text-gold font-semibold rounded-full text-sm transition-all"
        >
          <Gift className="w-4 h-4" /> Premios
        </Link>
      </div>
    </div>
  );
}
