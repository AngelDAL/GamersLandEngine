# PLAN: Integración Riot Tournament API en GamersLandEngine

## Objetivo
Integrar el Riot Tournament Stub API (y eventualmente el real) en GamersLandEngine para que los organizadores puedan generar códigos de torneo de League of Legends directamente desde la plataforma, y recibir resultados automáticos cuando terminen las partidas.

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    GamersLandEngine                          │
│                                                             │
│  ┌─────────────┐   ┌──────────────────┐   ┌──────────────┐ │
│  │  UI/Pages   │──▶│  Riot API Routes │──▶│ Riot Service │ │
│  │  (React)    │   │  (Next.js API)   │   │  (lib/)      │ │
│  └─────────────┘   └──────────────────┘   └──────┬───────┘ │
│                                                   │         │
│  ┌──────────────────┐                            │         │
│  │ Riot Callback    │◀───────────────────────────┘         │
│  │ /api/riot/       │                                      │
│  │ callback         │     ┌──────────────────────────┐     │
│  └──────────────────┘     │  Riot Tournament Stub    │     │
│                           │  /lol/tournament-stub/   │     │
│  ┌──────────────────┐     └───────────┬──────────────┘     │
│  │ Prisma Schema    │                 │                    │
│  │ (ya existente)   │           Llamadas HTTP              │
│  └──────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
```

## Fases

### FASE 0: Análisis y Setup ✅ (COMPLETADO)
- [x] Verificar que Tournament Stub API funciona con API key actual
- [x] Probar endpoints: providers, tournaments, codes, lobby-events
- [x] Confirmar que responde HTTP 200 y regresa datos válidos
- [x] Verificar estructura del proyecto GamersLandEngine
- [x] Confirmar git y GitHub setup

### FASE 1: Riot Service Layer (Servicio Central)
**Archivos a crear:**
- `src/lib/riot-service.ts` — Servicio central para todas las llamadas a Riot API

**Funcionalidad:**
- `createProvider(region, callbackUrl)` → Crea provider en Riot
- `createTournament(providerId, name)` → Crea torneo en Riot
- `generateCodes(tournamentId, count, config)` → Genera códigos de partida
- `getCodeInfo(code)` → Obtiene info del código
- `getLobbyEvents(code)` → Obtiene eventos del lobby
- Soporte para modo STUB y PRODUCCIÓN (switch automático)

### FASE 2: API Routes (Backend Endpoints)
**Archivos a crear:**
- `src/app/api/riot/provider/route.ts` — POST para crear provider
- `src/app/api/riot/tournament/route.ts` — POST para crear torneo en Riot
- `src/app/api/riot/codes/route.ts` — POST para generar códigos
- `src/app/api/riot/codes/[code]/route.ts` — GET info del código
- `src/app/api/riot/callback/route.ts` — POST para recibir callbacks de Riot

### FASE 3: Integración con Torneos Existentes
**Archivos a modificar:**
- `prisma/schema.prisma` — Agregar campo `riotProviderId` y `riotTournamentId` al modelo Tournament
- `src/app/api/tournaments/route.ts` — Agregar creación de provider/tournament en Riot al crear torneo
- `src/app/api/tournaments/[id]/route.ts` — Agregar info de Riot al GET

### FASE 4: UI para Organizadores
**Archivos a crear:**
- `src/app/tournaments/[id]/manage/RiotCodePanel.tsx` — Panel para generar y gestionar códigos Riot

**Archivos a modificar:**
- `src/app/tournaments/[id]/manage/ManageTournamentClient.tsx` — Agregar tab de "Riot Codes"

### FASE 5: Callback Handler & Match Results
**Funcionalidad:**
- Recibir callback POST de Riot cuando termine una partida
- Parsear el payload y actualizar el match en la DB
- Crear resultados y avanzar bracket automáticamente

### FASE 6: Pruebas
- Probar ciclo completo: Provider → Tournament → Codes → Lobby Events
- Probar callback handler (simulado)
- Probar UI de gestión de códigos
- Verificar que todo el flujo funciona con STUB

## Detalle Técnico - Riot Service

```typescript
// src/lib/riot-service.ts
const RIOT_BASE = {
  STUB: 'https://americas.api.riotgames.com/lol/tournament-stub/v5',
  PROD: 'https://americas.api.riotgames.com/lol/tournament/v5',
};

interface RiotCodeConfig {
  mapType: 'SUMMONERS_RIFT' | 'HOWLING_ABYSS';
  pickType: 'TOURNAMENT_DRAFT' | 'ALL_RANDOM' | 'BLIND_PICK';
  spectatorType: 'NONE' | 'LOBBY_ONLY' | 'ALL';
  teamSize: number;
  allowedPUUIDs?: string[];
}

// Provider → Tournament → Codes → Callback
```

## Decisiones de Arquitectura

1. **Modo STUB por defecto** — Mientras llega la Production Key, todo funciona con stub
2. **RIOT_API_KEY en .env** — No hardcodear, usar variable de entorno
3. **Provider se crea una vez** — No crear provider por cada torneo, usar el mismo o permitir configuración
4. **Los códigos se generan bajo demanda** — Cuando el organizador los necesita, no todos al inicio
5. **Callback URL apunta a GamersLand** — Cuando esté en producción con dominio real

## Variables de Entorno a Agregar
```
RIOT_API_KEY=RGAPI-xxxxx
RIOT_MODE=stub            # stub | production
RIOT_CALLBACK_URL=https://gamersland.xyz/api/riot/callback
```

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Rate limiting (429) | Implementar backoff exponencial en el service |
| Stub no cubre todo | El stub tiene los mismos endpoints, solo que no crea partidas reales |
| Callback no llega | Tiene retry automático de Riot, máximo 5 min |
| API key expira | Las RGAPI keys son temporales, rotar cuando sea necesario |
