# Arquitectura del Servidor VPS

## 1. Información del Sistema

| Propiedad | Valor |
|-----------|-------|
| **Sistema Operativo** | Linux 6.8.0-88-generic (Ubuntu) |
| **Usuario** | root |
| **Ubicación del proyecto** | `/root/proyectos/agente-seguimiento` |
| **Plataforma** | VPS Hostinger con QEMU Guest Agent |
| **IP Pública** | 72.62.111.235 |
| **Dominio** | agenteapi.itelcore.org |

## 2. Servicios del Sistema

| Servicio | Descripción | Estado |
|----------|-------------|--------|
| docker.service | Docker Engine (Swarm Mode) | ✅ Active |
| containerd.service | Container Runtime | ✅ Active |
| ssh.service | OpenBSD Secure Shell (hardened) | ✅ Active |
| fail2ban.service | Intrusion Prevention | ✅ Active |
| ufw.service | Firewall | ✅ Active |
| monarx-agent.service | Security Scanner | ✅ Active |
| qemu-guest-agent.service | QEMU Guest Agent | ✅ Active |

## 3. Arquitectura de Contenedores (Docker Swarm)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         DOCKER SWARM STACK                               │
│                           (agente)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      TRAEFIK v3.6                                │    │
│  │                   (Reverse Proxy + SSL)                          │    │
│  │                                                                   │    │
│  │  Ports: 80 (→443), 443                                           │    │
│  │  SSL: Cloudflare Origin Certificate                              │    │
│  │  Host: agenteapi.itelcore.org                                    │    │
│  └───────────────────────────┬──────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────┐    ┌─────────────────────┐                     │
│  │      BACKEND        │    │     POSTGRESQL      │                     │
│  │  (Node.js + Fastify)│───▶│    (postgres:16)    │                     │
│  │                     │    │                     │                     │
│  │  Internal: :3000    │    │  Internal: :5432    │                     │
│  │  Replicas: 1        │    │  Replicas: 1        │                     │
│  └─────────────────────┘    └─────────────────────┘                     │
│                                                                          │
│  Network: agente_default (overlay)                                       │
│  Secrets: jwt_secret, openai_api_key, db_password                       │
│  Volume: pgdata (PostgreSQL persistence)                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

### Servicios Docker Swarm

| Servicio | Imagen | Replicas | Acceso |
|----------|--------|----------|--------|
| agente_traefik | traefik:v3.6 | 1 | Puertos 80, 443 |
| agente_backend | agente-seguimiento-backend:latest | 1 | Solo vía Traefik |
| agente_postgres | postgres:16-alpine | 1 | Solo interno |

## 4. Stack Tecnológico

### Backend
- **Runtime**: Node.js 22 (Alpine)
- **Framework**: Fastify 4.28.1
- **Lenguaje**: TypeScript 5.5
- **Base de datos**: PostgreSQL 16

### Reverse Proxy & SSL
- **Proxy**: Traefik v3.6.6
- **SSL**: Cloudflare Origin Certificate (válido hasta 2041)
- **Modo**: Full (strict) - SSL end-to-end

### Dependencias Principales
| Paquete | Versión | Propósito |
|---------|---------|-----------|
| fastify | 4.28.1 | Framework HTTP |
| @fastify/cors | - | Manejo de CORS |
| @fastify/jwt | 8.0 | Autenticación JWT |
| @fastify/websocket | 10 | WebSocket para streaming |
| pg | 8.12 | Cliente PostgreSQL |
| openai | 4.67.1 | Integración con GPT |
| bcrypt | 5.1.1 | Hashing de contraseñas |
| zod | 3.23 | Validación de esquemas |

### Servicios Externos
- **OpenAI API**: GPT para asistente IA
- **Deepgram**: Transcripción de voz (Nova-2)
- **Cloudflare**: DNS + Proxy + SSL
- **Expo Push**: Notificaciones móviles (futuro)

## 5. Estructura del Proyecto

```
/root/proyectos/agente-seguimiento/
├── docker-compose.yml          # Stack Docker Swarm
├── ARQUITECTURA.md             # Diseño de la aplicación
├── CHECKLIST_PROGRESO.md       # Estado de implementación
├── ARQUITECTURA_SERVIDOR.md    # Este archivo
│
├── traefik/
│   ├── traefik.yml             # Configuración estática
│   ├── dynamic.yml             # Configuración dinámica (TLS)
│   └── certs/
│       ├── origin.crt          # Cloudflare Origin Certificate
│       └── origin.key          # Private key (600)
│
└── backend/
    ├── Dockerfile              # Imagen Docker
    ├── docker-entrypoint.sh    # Carga secrets y espera DNS
    ├── package.json            # Dependencias
    ├── tsconfig.json           # TypeScript config
    │
    ├── database/
    │   └── schema.sql          # Esquema PostgreSQL
    │
    └── src/
        ├── server.ts           # Entry point
        ├── app.ts              # Configuración Fastify
        ├── types/              # Interfaces TypeScript
        ├── schemas/            # Validación Zod
        ├── repositories/       # Acceso a datos
        ├── services/           # Lógica de negocio
        ├── routes/             # Endpoints HTTP
        ├── middleware/         # Auth middleware
        └── utils/              # DB, env, OpenAI clients
```

## 6. API Endpoints

**Base URL**: `https://agenteapi.itelcore.org`

### Health Check
```
GET /health → {"status":"ok","timestamp":"...","environment":"development"}
```

### Autenticación (`/api/v1/auth`)
| Método | Ruta | Descripción | Auth | Estado |
|--------|------|-------------|------|--------|
| POST | /register | Registrar usuario | No | ✅ |
| POST | /login | Iniciar sesión | No | ✅ |
| GET | /me | Usuario actual | Sí | ✅ |

### Chat IA (`/api/v1/chat`)
| Método | Ruta | Descripción | Auth | Estado |
|--------|------|-------------|------|--------|
| POST | /message | Enviar mensaje | Sí | ⬚ |
| GET | /conversations | Listar conversaciones | Sí | ⬚ |
| GET | /conversations/:id | Obtener conversación | Sí | ⬚ |

### Tareas (`/api/v1/tasks`)
| Método | Ruta | Descripción | Auth | Estado |
|--------|------|-------------|------|--------|
| GET | / | Listar tareas | Sí | ⬚ |
| POST | / | Crear tarea | Sí | ⬚ |
| POST | /:id/start | Iniciar timer | Sí | ⬚ |
| POST | /:id/pause | Pausar timer | Sí | ⬚ |
| POST | /:id/complete | Completar tarea | Sí | ⬚ |

## 7. Networking

### Diagrama de Red

```
                    ┌─────────────────────┐
                    │     INTERNET        │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     CLOUDFLARE      │
                    │  (Proxy + DDoS)     │
                    │  agenteapi.itelcore │
                    └──────────┬──────────┘
                               │ HTTPS (Cloudflare → Origin)
                               │
┌──────────────────────────────▼──────────────────────────────────────────┐
│                              VPS                                         │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         UFW Firewall                                │ │
│  │  Allow: 22/tcp (SSH), 80/tcp, 443/tcp                              │ │
│  │  Deny: Everything else                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                               │                                          │
│  ┌────────────────────────────▼────────────────────────────────────┐    │
│  │                    TRAEFIK :80, :443                             │    │
│  │              (SSL termination with Origin Cert)                  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│  ┌────────────────────────────▼────────────────────────────────────┐    │
│  │              Docker Overlay Network (agente_default)             │    │
│  │                                                                   │    │
│  │     ┌──────────────┐              ┌──────────────┐               │    │
│  │     │   Backend    │─────────────▶│  PostgreSQL  │               │    │
│  │     │   :3000      │              │    :5432     │               │    │
│  │     └──────────────┘              └──────────────┘               │    │
│  │                                                                   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Puertos
| Puerto | Servicio | Exposición |
|--------|----------|------------|
| 22 | SSH | Público (Fail2ban) |
| 80 | Traefik HTTP | Público (redirige a 443) |
| 443 | Traefik HTTPS | Público |
| 3000 | Backend | Solo Docker interno |
| 5432 | PostgreSQL | Solo Docker interno |

## 8. Seguridad

### SSH (Hardened)
- `PermitRootLogin prohibit-password` (solo SSH keys)
- `PasswordAuthentication no`
- Fail2ban: 3 intentos → ban 24h

### Firewall (UFW)
```
Status: active
To                         Action      From
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

### Secrets (Docker Swarm)
| Secret | Descripción |
|--------|-------------|
| jwt_secret | Clave para firmar JWT |
| openai_api_key | API key de OpenAI |
| db_password | Password de PostgreSQL |

Los secrets se montan en `/run/secrets/` y se cargan mediante `docker-entrypoint.sh`.

### SSL/TLS
- Cloudflare Origin Certificate
- Válido: 2026-01-11 → 2041-01-07 (15 años)
- Modo: Full (strict)

## 9. Base de Datos

### Esquema (10 tablas)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    users     │────▶│ conversations│────▶│   messages   │
└──────────────┘     └──────────────┘     └──────────────┘
       │
       ├────────────▶┌──────────────┐     ┌──────────────┐
       │             │    tasks     │────▶│ task_events  │
       │             └──────────────┘     └──────────────┘
       │                    │
       │             ┌──────────────┐
       │             │  categories  │
       │             └──────────────┘
       │
       ├────────────▶┌──────────────┐     ┌──────────────┐
       │             │    goals     │────▶│goal_progress │
       │             └──────────────┘     └──────────────┘
       │
       ├────────────▶┌──────────────┐
       │             │  check_ins   │
       │             └──────────────┘
       │
       └────────────▶┌──────────────┐
                     │daily_summaries│
                     └──────────────┘
```

## 10. Comandos Útiles

### Docker Swarm
```bash
# Ver servicios
docker service ls

# Logs de un servicio
docker service logs agente_backend --tail 50

# Actualizar stack
docker stack deploy -c docker-compose.yml agente

# Forzar actualización de servicio
docker service update --force agente_backend
```

### Secrets
```bash
# Crear secret
echo "mi-secret" | docker secret create nombre_secret -

# Listar secrets
docker secret ls
```

### SSL
```bash
# Verificar certificado
openssl s_client -connect agenteapi.itelcore.org:443 -servername agenteapi.itelcore.org
```

---

*Última actualización: 2026-01-11*
