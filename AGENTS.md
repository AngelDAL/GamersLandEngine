# AGENTS.md — GamersLand Engine

Contrato obligatorio para todo agente que trabaje en este repositorio. Léelo antes de tocar nada.

## Qué es

Plataforma de torneos de esports (GamersLand): jugadores se inscriben, el organizador aprueba,
genera llaves (brackets), marca resultados y entrega premios. En producción: `https://gamersland.tabtap.dev`.

## Stack y mapa

- Next.js 16 (app router) + React 19 + Tailwind 4. API routes en `src/app/api/**/route.ts`.
- Prisma 7 + MariaDB (adapter `@prisma/adapter-mariadb`). Cliente: `src/lib/prisma.ts` → `import { prisma } from "@/lib/prisma"`.
- next-auth v5 (credentials, JWT). Sesión: `import { auth } from "@/lib/auth"` → `session.user = { id, username, role, avatarUrl }`.
- Socket.io: servidor `src/socket/server.ts` (se inicia desde `server.ts`), cliente `src/hooks/useSocket.ts`.
- Validación: `zod` (ya instalado). Formularios: `react-hook-form` + `@hookform/resolvers`.
- Toasts: `sonner`. Iconos: `lucide-react`. NUNCA `alert`/`confirm`/`prompt` nativos.
- El servidor de desarrollo: `PORT=30XX npx tsx --tsconfig tsconfig.json server.ts` (producción usa 3010 — NO la toques).

## Reglas del dueño (Ángel) — se corrigen una vez y no se vuelven a romper

1. **Nunca emojis** en la UI ni en configuración. Cero.
2. **Nada de rótulos técnicos visibles**: no estados en inglés (`OPEN_REGISTRATION`, `WON`, `BYE`),
   no palabras como "En vivo" como etiqueta decorativa, no "Win Rate", no UUIDs mostrados al usuario.
   Estados en español con etiqueta humana: `ABIERTO`, `EN CURSO`, `FINALIZADO`, `CANCELADO`;
   `Victoria`/`Derrota`; `Sin rival (pasa de ronda)`.
3. **Nada de texto que describa la pantalla** ni instrucciones visibles ("Aquí puedes…"). La ayuda va
   en iconos con tooltip (`title` o `group-hover`).
4. **Botones tipo toggle (segmentados) en lugar de `<select>`** para opciones cortas (2-5).
5. **No crear páginas nuevas para subsecciones** de un módulo existente: usa pestañas/secciones dentro de la página.
6. **Acciones que se confunden** (aprobar/rechazar, entrar/salir) llevan nombre propio, color propio e icono propio.
7. **Listas largas**: alto máximo con scroll (`max-h-… overflow-y-auto`).
8. **Móvil primero**: área táctil ≥ 40 px, **nada que dependa de hover** para funcionar (si algo solo
   aparece en hover, en táctil no existe), modales compactos con tarjetas.
9. **WebSocket sobre polling**: tiempo real por socket; el polling solo como respaldo y con intervalo ≥ 60 s.
10. **Español con acentos** en todo texto visible y en mensajes de error de API.

## Reglas de código

- **Toda ruta API**: primero `const session = await auth();` → 401 `{ error: "No autorizado" }` si no hay
  sesión; después el chequeo de rol/propiedad concreto. Los endpoints públicos deben decirlo en el brief.
- **Valida el body con zod** en toda ruta POST/PATCH que toques y devuelve 400 con mensaje en español.
- **Operaciones multi-paso** (crear equipo + miembro, borrar rondas + matches, avance de ronda):
  envuélvelas en `prisma.$transaction`. Todas las FK relevantes ya son `onDelete: Cascade` — si necesitas
  una columna/cascade más, **no toques `prisma/schema.prisma`**: repórtalo y lo hace el orquestador.
- **No uses `any`** donde el tipo ya exista; los `catch` no pueden quedar vacíos sin al menos loguear.
- Escribe comentarios que expliquen el PORQUÉ, no el QUÉ.
- Vocabulario de dominio: inscripción (registration), llave/bracket, ronda, cruce/partido, premio, cuota.

## Límites del agente (NO hacer, jamás)

- **No hagas `git commit`, `git push`, `git checkout`, `git merge`, `git stash`** — el orquestador commitea.
- **No toques `prisma/schema.prisma`** ni ejecutes `prisma db push/migrate/generate`.
- **No toques `.env`**, no instales dependencias (`npm install`), no reinicies servicios systemd ni
  contenedores, no toques nada fuera de `/opt/GamersLandEngine`.
- **No toques archivos fuera de tu lista** — hay otros agentes trabajando en paralelo en este mismo
  repositorio. Si necesitas un cambio en un archivo ajeno, repórtalo en tu informe final.
- **Puerto asignado para tus pruebas**: usa solo el tuyo (te lo dice tu brief). El 3010 es producción viva.
- **Base de datos**: puedes leer y crear datos de prueba con nombres `[TEST]`…; no borres datos que no
  hayas creado tú y no cambies esquema.

## Verificación que debes correr y reportar (salida literal)

```bash
npx tsc --noEmit            # al FINAL de tu trabajo
npx eslint <tus archivos>   # solo tus archivos
```

Si `tsc` marca errores en archivos **que no son tuyos**, ignóralos (son de otro agente en curso) y
repórtalos como ajenos. Si los hay en TUS archivos, corrígelos antes de terminar.

## Formato de tu informe final

1. Archivos tocados + resumen de cada cambio.
2. Salida literal de `tsc` y `eslint`.
3. Nuevos ids, helpers, eventos o endpoints con sus firmas (para verificarlos).
4. Lo que NO pudiste probar y los cambios que pediste en archivos ajenos.
