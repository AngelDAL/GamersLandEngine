# 🏆 FASE 1 — Auto-registro + Check-in + Horarios

## Diagnóstico actual

**El problema:** Hoy el registro funciona así:
1. El jugador llega a la página → ve "CREAR CUENTA" → se registra
2. **Pero la API rechaza a los PLAYER** (requiere ADMIN/ORGANIZER)
3. El jugador tiene que **generar un QR** y que el organizador se lo escanee para registrarlo manualmente
4. No hay concepto de "check-in" — el organizador no sabe quién llegó
5. Los horarios ya existen en DB (`Match.scheduledAt`) pero se muestran pequeños

## Lo que vamos a cambiar

### 🟢 1. Auto-registro (sin aprobación del organizador)

**Antes:** `POST /api/tournaments/[id]/registrations` requiere rol `ADMIN` o `ORGANIZER`
**Después:** Cualquier usuario autenticado puede registrarse solo. Status `CONFIRMED` automático.

**Archivos a modificar:**
- `src/app/api/tournaments/[id]/registrations/route.ts` — quitar restricción de rol, auto-confirm
- `src/app/tournaments/[id]/TournamentDetailClient.tsx` — quitar flujo QR, mostrar registro directo
- `src/app/tournaments/[id]/_components/RegisterModal.tsx` — simplificar, quitar step de QR

### 🟢 2. Check-in online

**Nuevo campo en schema:** `TournamentRegistration.checkedInAt: DateTime?` (null = no ha llegado)

**Nuevas APIs:**
- `POST /api/tournaments/[id]/check-in` — el jugador se checkea solo
- `GET /api/tournaments/[id]/registrations` — listar con status de check-in (para organizers)
- `PATCH /api/tournaments/[id]/registrations/[id]/check-in` — el organizer checkea manualmente

**UI:**
- Botón "✅ Check-in" en la página del torneo (solo si el evento es hoy)
- En `ManageTournamentClient.tsx`: columna de check-in, badge verde/gris
- En `TournamentDetailClient.tsx`: estado de check-in visible

### 🟢 3. Horarios fijos (más visibles)

Ya tenemos `Match.scheduledAt` en DB y se muestra. Vamos a:
- Agregar **cuenta regresiva** estilo "Comienza en 2h 15m" 
- Mostrar **calendario semanal** de partidos
- Agregar timer más grande en el card del próximo partido

**Archivos a modificar:**
- `src/components/notifications/MatchCountdown.tsx` — mejorar diseño (más grande, más visible)
- `src/app/tournaments/[id]/TournamentDetailClient.tsx` — destacar scheduledAt con más espacio

## Orden de implementación

1. ✅ **Prisma migration** — agregar `checkedInAt` a `TournamentRegistration`  
   *El campo `paid` ya existe ©*

2. ✅ **API: auto-registro** — modificar POST /registrations para aceptar PLAYERs  
   *Sin body o body vacío → se registra a sí mismo → CONFIRMED automático*

3. ✅ **API: check-in** — nuevo `POST /api/tournaments/[id]/check-in`  
   *Jugador se checkea solo. Valida que esté registrado y el evento sea hoy*

4. ✅ **API: payment + check-in (organizer)** — nuevo `PATCH /api/tournaments/[id]/registrations/[regId]`  
   *Organizer marca como pagado (`{ paid: true }`) o check-in manual*

5. ✅ **UI: TournamentDetail** — botón de check-in + registro directo sin QR  
   *Muestra si ya pagó, si ya hizo check-in, timer de próximo partido*

6. ✅ **UI: RegisterModal** — simplificar flujo (quitar QR, registro directo)

7. ✅ **UI: Manage** — tabla de registrados con columnas: Pago (✅/❌ + toggle), Check-in (✅/❌ + toggle)

8. ✅ **UI: Horarios** — mejorar visibilidad del schedule + countdown

## Archivos afectados (totales)

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | +1 campo `checkedInAt` en TournamentRegistration |
| `src/app/api/tournaments/[id]/registrations/route.ts` | Quitar restricción ADMIN, auto-confirm |
| `prisma/migrations/*/migration.sql` | NUEVA migración |
| `src/app/api/tournaments/[id]/check-in/route.ts` | NUEVO |
| `src/app/api/tournaments/[id]/registrations/[regId]/route.ts` | NUEVO (PATCH para organizer) |
| `src/app/tournaments/[id]/page.tsx` | Pasar paid + checkedInAt al client |
| `src/app/tournaments/[id]/TournamentDetailClient.tsx` | Botón check-in, registro sin QR, estado pago |
| `src/app/tournaments/[id]/_components/RegisterModal.tsx` | Simplificar flujo |
| `src/app/tournaments/[id]/manage/page.tsx` | Pasar registrations con paid + checkedInAt |
| `src/app/tournaments/[id]/manage/ManageTournamentClient.tsx` | Columnas pago + check-in |
| `src/components/notifications/MatchCountdown.tsx` | Mejorar diseño |
