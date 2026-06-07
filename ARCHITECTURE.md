# Arquitectura del Sistema — Mundial Predictor

## Diagrama de componentes

```
                        ┌─────────────────────────────────┐
                        │         CLIENTE (Browser)        │
                        │        React SPA - Port 80       │
                        └───────────────┬─────────────────┘
                                        │ HTTP
                        ┌───────────────▼─────────────────┐
                        │         NGINX (Load Balancer)    │
                        │   least_conn · keepalive 32      │
                        │   /api/* → backend_pool          │
                        │   /     → frontend               │
                        └────┬──────────────────┬──────────┘
                             │                  │
               ┌─────────────▼───┐    ┌─────────▼─────────┐
               │  Backend Node.js│    │  Backend Node.js   │
               │  (instancia 1)  │    │  (instancia 2...N) │
               │  Express + JWT  │    │  Express + JWT     │
               └────┬────────────┘    └──────────┬─────────┘
                    │                             │
          ┌─────────▼─────────────────────────────▼────────┐
          │                                                 │
   ┌──────▼──────────┐                      ┌──────────────▼──────┐
   │  PostgreSQL 15  │                      │    Redis 7          │
   │  (persistencia) │                      │  (caché + sesiones) │
   └─────────────────┘                      └─────────────────────┘
```

## Stack tecnológico

| Capa           | Tecnología            | Rol                                        |
|----------------|-----------------------|--------------------------------------------|
| Frontend       | React 18 + React Router | SPA, páginas de predicciones/salas/ranking |
| Reverse Proxy  | Nginx 1.25            | Load balancer, enrutamiento /api → backend |
| Backend        | Node.js 18 + Express  | REST API, lógica de negocio, JWT           |
| Base de datos  | PostgreSQL 15         | Usuarios, partidos, predicciones, salas    |
| Caché          | Redis 7               | Caché de leaderboard (TTL 60s)             |
| Contenedores   | Docker + Compose      | Orquestación local y escalamiento          |
| Stress Testing | k6                    | Pruebas de carga y estrés                  |

## Escalamiento horizontal

El backend es **stateless** (sin estado de sesión en memoria): el JWT viaja en cada request y Redis almacena el estado de sesiones/caché. Esto permite escalar horizontalmente con:

```bash
# Escalar a 3 instancias del backend
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up --scale backend=3
```

Nginx resuelve `backend:3001` a todas las instancias mediante DNS interno de Docker y distribuye con `least_conn` (mínimas conexiones activas).

## Endpoints principales

### Auth
- `POST /api/auth/register` — Registro
- `POST /api/auth/login` — Login (JWT)
- `GET  /api/auth/me` — Perfil del usuario

### Matches
- `GET /api/matches` — Listar partidos (filtrables por status)
- `GET /api/matches/:id` — Detalle de partido

### Predictions
- `GET  /api/predictions/my` — Predicciones del usuario
- `POST /api/predictions` — Crear/actualizar predicción (cierra 10 min antes del partido)

### Rooms
- `GET    /api/rooms/my` — Salas del usuario
- `POST   /api/rooms` — Crear sala (genera código único)
- `POST   /api/rooms/join` — Unirse por código
- `GET    /api/rooms/:id` — Detalle + miembros + tabla
- `DELETE /api/rooms/:id/leave` — Salir de sala

### Leaderboard
- `GET /api/leaderboard` — Top 50 global (cacheado 60s en Redis)
- `GET /api/leaderboard/room/:id` — Tabla de sala
- `GET /api/leaderboard/rank/me` — Posición del usuario

### Admin (requiere rol admin)
- `GET/POST /api/admin/matches` — CRUD partidos
- `PUT      /api/admin/matches/:id` — Actualizar partido/resultado
- `POST     /api/admin/matches/:id/score` — Calcular puntos de predicciones
- `GET      /api/admin/users` — Listar usuarios

## Sistema de puntuación implementado

| Regla | Condición | Puntos |
|-------|-----------|--------|
| 1. Marcador exacto | Predijo exactamente el resultado final | +5 pts |
| 2. Ganador correcto | Acertó el ganador o empate (sin margen exacto) | +3 pts |
| 3. Diferencia de goles | Igual margen pero diferente ganador | +2 pts |
| 4. Racha de 3 | 3 partidos consecutivos con al menos ganador correcto | +2 pts extra |
| 5. Predicción anticipada | Predicción con más de 24h de anticipación | +1 pt extra |

La lógica de reglas 1-3 es **mutuamente excluyente** (se aplica la mejor). Las reglas 4-5 son acumulativas.

Los puntos totales se **recalculan desde cero** cada vez que el admin ejecuta "Calcular pts" para un partido, garantizando consistencia en los bonos de racha.

## Pruebas de estrés

Archivo: `stress-tests/k6-test.js`

### Escenarios definidos

| Escenario | VUs | Duración | Propósito |
|-----------|-----|----------|-----------|
| smoke     | 1   | 30s      | Verificación básica de funcionamiento |
| load      | 0→50| 5min     | Carga normal esperada |
| stress    | 0→200| 10min   | Carga por encima de lo normal |
| spike     | 0→500| 30s     | Pico súbito de tráfico |

### Umbrales (thresholds)

- `p(95) < 500ms` para todas las requests
- `p(99) < 1500ms` para todas las requests
- `http_req_failed < 5%`
- `success_rate > 95%`
- `leaderboard_duration p(95) < 300ms` (gracias al caché Redis)

### Comandos para ejecutar

```bash
# Instalar k6: https://k6.io/docs/get-started/installation/

# Prueba rápida (smoke)
k6 run --vus 1 --duration 30s stress-tests/k6-test.js

# Prueba de carga
k6 run --vus 50 --duration 5m stress-tests/k6-test.js

# Prueba de estrés completa (todos los escenarios)
k6 run stress-tests/k6-test.js

# Con reporte HTML
k6 run --out json=results.json stress-tests/k6-test.js
```

## Cómo levantar el sistema

```bash
# 1. Clonar/acceder al directorio
cd world-cup-predictor

# 2. Instancia única
docker-compose up --build

# 3. Con 3 instancias de backend (escalado horizontal)
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up --build --scale backend=3

# 4. La app queda disponible en http://localhost
# Admin: admin@worldcup.com / admin123
```

## Flujo de uso

1. **Registro/Login** → JWT almacenado en localStorage
2. **Predicciones** → El usuario predice marcadores antes de cada partido (cierre: 10 min antes)
3. **Salas** → Crear sala → compartir código → amigos se unen → tabla privada
4. **Admin** → Carga resultado del partido → ejecuta "Calcular pts" → se recalculan todos los puntos
5. **Leaderboard** → Ranking global y por sala, con caché Redis
