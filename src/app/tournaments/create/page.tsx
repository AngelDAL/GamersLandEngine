"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Upload, Camera, Loader2, Gamepad2 } from "lucide-react";

const BRACKET_TYPES = [
  { value: "SINGLE_ELIMINATION", label: "Eliminación Simple" },
  { value: "DOUBLE_ELIMINATION", label: "Doble Eliminación" },
  { value: "ROUND_ROBIN", label: "Round Robin" },
  { value: "SWISS", label: "Suizo" },
] as const;

export default function CreateTournamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [banners, setBanners] = useState<{ url: string; label: string }[]>([]);
  const [uploadedBanners, setUploadedBanners] = useState<{ url: string; label: string }[]>([]);
  const [showGallery, setShowGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    game: "",
    description: "",
    entryFee: "",
    maxTeams: "8",
    minTeams: "4",
    teamSize: "5",
    isTeamBased: true,
    bracketType: "SINGLE_ELIMINATION",
    imageUrl: "/banners/default.svg",
    eventDate: "",
    registrationDeadline: "",
    location: "",
    rules: "",
  });

  useEffect(() => {
    fetch("/api/upload/banner")
      .then((r) => r.json())
      .then((data) => {
        setBanners(data.defaultBanners || []);
        setUploadedBanners(data.uploaded || []);
      })
      .catch(() => {});
  }, []);

  const update = (field: string, value: string) =>
    setForm((prev) => ({
      ...prev,
      [field]: field === "isTeamBased" ? value === "true" : value,
    }));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("banner", file);
    const res = await fetch("/api/upload/banner", { method: "POST", body: formData });
    if (res.ok) {
      const data = await res.json();
      setForm((prev) => ({ ...prev, imageUrl: data.imageUrl }));
      const galleryRes = await fetch("/api/upload/banner");
      const galleryData = await galleryRes.json();
      setUploadedBanners(galleryData.uploaded || []);
    } else {
      const data = await res.json();
      setError(data.error || "Error al subir imagen");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!form.name || !form.eventDate) {
      setError("Nombre y fecha del evento son requeridos");
      setLoading(false);
      return;
    }

    const payload: any = {
      name: form.name,
      game: form.game || "General",
      description: form.description || undefined,
      entryFee: form.entryFee ? parseFloat(form.entryFee) : undefined,
      maxTeams: parseInt(form.maxTeams),
      minTeams: parseInt(form.minTeams),
      teamSize: parseInt(form.teamSize),
      isTeamBased: form.isTeamBased,
      bracketType: form.bracketType,
      imageUrl: form.imageUrl || undefined,
      eventDate: form.eventDate,
      registrationDeadline: form.registrationDeadline || undefined,
      location: form.location || undefined,
      rules: form.rules || undefined,
    };

    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al crear torneo");
      setLoading(false);
      return;
    }

    const tournament = await res.json();
    router.push(`/tournaments/${tournament.id}/manage`);
  };

  const allBanners = [...banners, ...uploadedBanners];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gold mb-2">Crear Torneo</h1>
      <p className="text-muted text-sm mb-8">Define los detalles del nuevo torneo</p>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-5 p-6">
          {/* Banner selector */}
          <div>
            <label className="block text-sm text-muted mb-2">Imagen del torneo</label>

            {/* Preview with image background + gradient overlay */}
            <div className="relative h-40 rounded-xl overflow-hidden mb-3">
              <img src={form.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/30 to-transparent" />
              <div className="relative h-full flex items-end p-5">
                <div className="flex items-center gap-3">
                  <Gamepad2 className="w-8 h-8 text-gold drop-shadow-lg" />
                  <div>
                    <p className="text-white font-bold text-xl drop-shadow-lg">{form.name || "Nombre del torneo"}</p>
                    <p className="text-white/70 text-sm drop-shadow">{form.game || "Juego"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowGallery(!showGallery)}
                className="flex items-center gap-1.5 px-4 py-2 bg-gold/10 border border-gold/30 text-gold rounded-xl text-xs font-bold hover:bg-gold/20 transition-colors">
                <Camera className="w-3.5 h-3.5" />
                {showGallery ? "Cerrar" : "Seleccionar imagen"}
              </button>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-2 bg-background border border-border rounded-xl text-xs font-bold hover:border-gold/30 transition-colors disabled:opacity-50">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Subiendo..." : "Subir imagen"}
              </button>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" onChange={handleFileUpload} className="hidden" />
            </div>

            {showGallery && (
              <div className="mt-3 p-3 bg-background border border-border rounded-xl max-h-[200px] overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                  {allBanners.map((b) => (
                    <button key={b.url} type="button" onClick={() => { setForm((p) => ({ ...p, imageUrl: b.url })); setShowGallery(false); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        form.imageUrl === b.url ? "border-gold bg-gold/10 text-gold" : "border-border text-muted hover:border-gold/30"
                      }`}>
                      <div className="w-6 h-6 rounded bg-black/10 flex items-center justify-center overflow-hidden">
                        <img src={b.url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <span>{b.label}</span>
                      {form.imageUrl === b.url && <Check className="w-3 h-3 text-gold" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Form fields */}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Nombre del torneo *</label>
              <input value={form.name} onChange={(e) => update("name", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" placeholder="Ej: Copa GamersLand" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Juego</label>
              <input value={form.game} onChange={(e) => update("game", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" placeholder="Ej: League of Legends, Valorant, Fortnite, Super Smash Bros..." />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Tipo de torneo</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => update("isTeamBased", "true")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${form.isTeamBased === true ? "bg-gold text-background" : "bg-background border border-border text-muted"}`}>
                  Por equipos
                </button>
                <button type="button" onClick={() => update("isTeamBased", "false")}
                  className={`flex-1 px-4 py-3 rounded-lg text-sm font-bold transition-all ${form.isTeamBased === false ? "bg-gold text-background" : "bg-background border border-border text-muted"}`}>
                  Individual
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Tipo de bracket</label>
              <select value={form.bracketType} onChange={(e) => update("bracketType", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold">
                {BRACKET_TYPES.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
              </select>
            </div>

            {form.isTeamBased && (
              <div>
                <label className="block text-sm text-muted mb-1">Tamaño del equipo</label>
                <input type="number" value={form.teamSize} onChange={(e) => update("teamSize", e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" min={2} max={50} />
              </div>
            )}

            <div>
              <label className="block text-sm text-muted mb-1">{form.isTeamBased ? "Cupo máximo de equipos" : "Cupo máximo de jugadores"}</label>
              <input type="number" value={form.maxTeams} onChange={(e) => update("maxTeams", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" min={2} max={128} />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">{form.isTeamBased ? "Cupo mínimo de equipos" : "Cupo mínimo de jugadores"}</label>
              <input type="number" value={form.minTeams} onChange={(e) => update("minTeams", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" min={2} />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Cuota de entrada ($)</label>
              <input type="number" value={form.entryFee} onChange={(e) => update("entryFee", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" placeholder="0 = gratuito" />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Ubicación (física)</label>
              <input value={form.location} onChange={(e) => update("location", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" placeholder="Ej: Sala principal" />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Fecha del evento *</label>
              <input type="datetime-local" value={form.eventDate} onChange={(e) => update("eventDate", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" />
            </div>

            <div>
              <label className="block text-sm text-muted mb-1">Fecha límite de registro</label>
              <input type="datetime-local" value={form.registrationDeadline} onChange={(e) => update("registrationDeadline", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-muted mb-1">Descripción</label>
              <textarea value={form.description} onChange={(e) => update("description", e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded text-foreground focus:outline-none focus:border-gold min-h-[80px]" placeholder="Reglas, premios, detalles..." />
            </div>
          </div>

          {error && <p className="text-red text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Creando..." : "CREAR TORNEO"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
