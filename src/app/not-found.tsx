import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-7 h-7 text-gold" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          No encontramos esa página
        </h2>
        <p className="text-sm text-muted mb-6">
          Puede que el enlace esté viejo o que la página ya no exista.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gold text-background font-bold rounded-xl text-sm hover:bg-gold-hover transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
