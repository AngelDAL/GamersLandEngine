# Plan: Sistema de Equipos + Invites + Free Agents

## Estado actual
✅ Ya existe: crear equipo, invitar miembros (por username), aceptar/rechazar, free agents page separada

## Lo que falta

### 1. Registro de equipo a torneo 🏆
**Cuando un user se registra en torneo por equipos:**
- Modal de registro: botón "CREAR EQUIPO Y REGISTRARME" o "UNIRME A UN EQUIPO"
- Si ya tiene equipo: registra el equipo automáticamente al torneo (crea `TournamentTeam`)
- Si no tiene: primero crea equipo, luego registra equipo al torneo

### 2. Enlaces de invitación 🔗
**Cada equipo tiene un link único:** `/teams/[id]/join?code=XYZ`
- El capitán copia el link desde la página del equipo
- Alguien que no tiene cuenta llega al link → ve página con: "Únete a [Team Name]"
- Crea su cuenta ahí mismo → automáticamente se une al equipo como miembro ACCEPTED
- Si ya tiene cuenta y está loggeado → se une al equipo directamente

**¿Cómo implementar los códigos?**
- Campo `inviteCode` en `Team` (UUID generado al crear)
- O usar el `id` del equipo directamente si es UUID (ya es seguro)
- Ruta pública: `/teams/[id]/join?code=inviteCode` que valida el código

### 3. Búsqueda de free agents desde el equipo 🔍
**En la página del equipo (TeamClient), el capitán ve:**
- Campo de búsqueda: "Buscar agentes libres..."
- Muestra resultados de usuarios SIN equipo en el torneo
- Botón "Invitar" al lado de cada free agent
- El free agent recibe notificación (socket) y ve la invitación

### 4. Solicitudes de free agents a equipos ✋
**En la página de Free Agents, cada agente ve:**
- Lista de equipos registrados en torneos
- Botón "Solicitar unirme" a cada equipo
- El capitán recibe la solicitud y puede aceptar/rechazar
- Ya existe `TeamMember` con `status: PENDING` y `message` — se reusa

## Orden de implementación

| # | Que | Archivos | Tamaño |
|---|---|---|---|
| 1 | Enlaces de invitación (más impactante, desbloquea el flujo nuevo) | schema + page + API | ⭐⭐ |
| 2 | Búsqueda de free agents + invitar desde el equipo | TeamClient + API | ⭐⭐ |
| 3 | Solicitudes de free agents a equipos | FreeAgents page + API | ⭐ |
| 4 | Registro de equipo al torneo en el flujo de registro | RegisterModal + API | ⭐⭐ |

## Resumen

El flujo completo sería:

1. **Jugador sin cuenta** llega al torneo → clic "CREAR CUENTA" → modal crea cuenta + muestra opciones
2. **Ya con cuenta** en torneo por equipos → "CREAR EQUIPO" o "BUSCAR EQUIPO"
3. **Capitán** en página del equipo → busca free agents, los invita, copia link de invitación
4. **Free agent** busca equipos → solicita unirse
5. **Todos** registrados en el equipo → el capitán registra el equipo al torneo → listos pa' jugar

¿Te late este plan o ajustamos algo antes de codearle?
