# Arquitectura del VPS - Agente de Seguimiento de Tareas

## Información del Sistema

| Componente | Valor |
|------------|-------|
| **Proveedor** | Hostinger VPS |
| **Sistema Operativo** | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPUs |
| **RAM** | 8 GB |
| **Almacenamiento** | 100 GB NVMe |
| **IP Pública** | 154.53.42.177 |
| **Dominio** | agenteapi.itelcore.org |

---

## Diagrama de Arquitectura

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                         INTERNET                            │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
                                                              ▼
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                     CLOUDFLARE                              │
                                    │  ┌─────────────────────────────────────────────────────┐   │
                                    │  │  DNS: agenteapi.itelcore.org → 154.53.42.177       │   │
                                    │  │  Proxy: Enabled (Orange Cloud)                      │   │
                                    │  │  SSL Mode: Full (Strict)                            │   │
                                    │  │  DDoS Protection: Activo                            │   │
                                    │  └─────────────────────────────────────────────────────┘   │
                                    └─────────────────────────────────────────────────────────────┘
                                                              │
                                                              │ HTTPS (443)
                                                              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            VPS (Ubuntu 24.04)                                               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                          CAPA DE SEGURIDAD                                            │  │
│  │  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────────────────────────┐   │  │
│  │  │       UFW           │  │     FAIL2BAN        │  │              SSH HARDENING                  │   │  │
│  │  │  ───────────────    │  │  ───────────────    │  │  ─────────────────────────────────────────  │   │  │
│  │  │  22/tcp  ✓ SSH      │  │  Jail: sshd         │  │  PasswordAuthentication: no                 │   │  │
│  │  │  80/tcp  ✓ HTTP     │  │  MaxRetry: 5        │  │  PermitRootLogin: prohibit-password         │   │  │
│  │  │  443/tcp ✓ HTTPS    │  │  BanTime: 10m       │  │  PubkeyAuthentication: yes                  │   │  │
│  │  │  *       ✗ DENY     │  │  FindTime: 10m      │  │  Protocol: 2                                │   │  │
│  │  └─────────────────────┘  └─────────────────────┘  └─────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                              │                                              │
│                                                              ▼                                              │
│  ┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                         DOCKER SWARM                                                  │  │
│  │                                     Stack: "agente"                                                   │  │
│  │                                                                                                       │  │
│  │  ┌────────────────────────────────── Network: agente_default (overlay) ───────────────────────────┐  │  │
│  │  │                                                                                                 │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │                              TRAEFIK v3.6.6                                             │   │  │  │
│  │  │  │                          (Reverse Proxy + SSL)                                          │   │  │  │
│  │  │  │  ─────────────────────────────────────────────────────────────────────────────────────  │   │  │  │
│  │  │  │  Ports:                                                                                 │   │  │  │
│  │  │  │    - 80:80   (HTTP → redirect HTTPS)                                                    │   │  │  │
│  │  │  │    - 443:443 (HTTPS)                                                                    │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  SSL Certificate:                                                                       │   │  │  │
│  │  │  │    - Tipo: Cloudflare Origin Certificate                                                │   │  │  │
│  │  │  │    - Validez: 2026-01-10 → 2041-01-06 (15 años)                                         │   │  │  │
│  │  │  │    - Archivos: /etc/traefik/certs/origin.pem + origin-key.pem                           │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Features:                                                                              │   │  │  │
│  │  │  │    - Dashboard: Deshabilitado (seguridad)                                               │   │  │  │
│  │  │  │    - Docker Provider: Swarm Mode                                                        │   │  │  │
│  │  │  │    - Auto-discovery de servicios                                                        │   │  │  │
│  │  │  └─────────────────────────────────────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                              │                                                  │  │  │
│  │  │                                              │ HTTP (3000)                                      │  │  │
│  │  │                                              ▼                                                  │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │                              BACKEND (Fastify)                                          │   │  │  │
│  │  │  │                           Node.js + TypeScript                                          │   │  │  │
│  │  │  │  ─────────────────────────────────────────────────────────────────────────────────────  │   │  │  │
│  │  │  │  Image: ghcr.io/[usuario]/agente-backend:latest                                         │   │  │  │
│  │  │  │  Port: 3000 (interno)                                                                   │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Seguridad:                                                                             │   │  │  │
│  │  │  │    - Rate Limiting: 100 req/min por IP                                                  │   │  │  │
│  │  │  │    - JWT Auth: 7 días expiración                                                        │   │  │  │
│  │  │  │    - CORS: * (mobile app)                                                               │   │  │  │
│  │  │  │    - Bcrypt: 12 rounds                                                                  │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Labels Traefik:                                                                        │   │  │  │
│  │  │  │    - Host: agenteapi.itelcore.org                                                       │   │  │  │
│  │  │  │    - TLS: true                                                                          │   │  │  │
│  │  │  │    - Service Port: 3000                                                                 │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Environment (desde Docker Secrets):                                                    │   │  │  │
│  │  │  │    - JWT_SECRET: /run/secrets/jwt_secret                                                │   │  │  │
│  │  │  │    - DB_PASSWORD: /run/secrets/db_password                                              │   │  │  │
│  │  │  │    - OPENAI_API_KEY: /run/secrets/openai_api_key                                        │   │  │  │
│  │  │  └─────────────────────────────────────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                              │                                                  │  │  │
│  │  │                                              │ PostgreSQL (5432)                                │  │  │
│  │  │                                              ▼                                                  │  │  │
│  │  │  ┌─────────────────────────────────────────────────────────────────────────────────────────┐   │  │  │
│  │  │  │                              POSTGRESQL 16                                              │   │  │  │
│  │  │  │                             (Base de Datos)                                             │   │  │  │
│  │  │  │  ─────────────────────────────────────────────────────────────────────────────────────  │   │  │  │
│  │  │  │  Image: postgres:16-alpine                                                              │   │  │  │
│  │  │  │  Port: 5432 (solo red interna)                                                          │   │  │  │
│  │  │  │  Database: task_tracker_ai                                                              │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Volumen:                                                                               │   │  │  │
│  │  │  │    - postgres_data:/var/lib/postgresql/data                                             │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Credenciales:                                                                          │   │  │  │
│  │  │  │    - User: postgres                                                                     │   │  │  │
│  │  │  │    - Password: Docker Secret (db_password)                                              │   │  │  │
│  │  │  │                                                                                         │   │  │  │
│  │  │  │  Acceso: Solo desde red overlay (no expuesto)                                           │   │  │  │
│  │  │  └─────────────────────────────────────────────────────────────────────────────────────────┘   │  │  │
│  │  │                                                                                                 │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                      DOCKER SECRETS                                             │  │  │
│  │  │  ───────────────────────────────────────────────────────────────────────────────────────────    │  │  │
│  │  │  jwt_secret      │ Secreto para firmar JWT tokens                                               │  │  │
│  │  │  db_password     │ Contraseña de PostgreSQL                                                     │  │  │
│  │  │  openai_api_key  │ API Key de OpenAI (GPT-4)                                                    │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  │                                                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐  │  │
│  │  │                                      DOCKER VOLUMES                                             │  │  │
│  │  │  ───────────────────────────────────────────────────────────────────────────────────────────    │  │  │
│  │  │  postgres_data   │ Datos persistentes de PostgreSQL                                             │  │  │
│  │  │  traefik_certs   │ Certificados SSL de Cloudflare Origin                                        │  │  │
│  │  └─────────────────────────────────────────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Flujo de Request

```
┌──────────────┐    HTTPS     ┌────────────┐    HTTPS     ┌─────────────┐    HTTP      ┌─────────────┐
│   Cliente    │ ──────────►  │ Cloudflare │ ──────────►  │   Traefik   │ ──────────►  │   Backend   │
│ (Mobile App) │              │  (Proxy)   │              │ (SSL Term)  │              │  (Fastify)  │
└──────────────┘              └────────────┘              └─────────────┘              └─────────────┘
                                    │                           │                             │
                              ┌─────┴─────┐               ┌─────┴─────┐                 ┌─────┴─────┐
                              │ - DDoS    │               │ - Routing │                 │ - Auth    │
                              │ - Cache   │               │ - SSL     │                 │ - Rate    │
                              │ - WAF     │               │ - Headers │                 │   Limit   │
                              └───────────┘               └───────────┘                 └───────────┘
```

---

## Endpoints de la API

### Base URL
```
https://agenteapi.itelcore.org/api/v1
```

### Autenticación
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar nuevo usuario |
| POST | `/auth/login` | Iniciar sesión |
| GET | `/auth/me` | Obtener usuario actual (requiere JWT) |

### Chat (IA)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/chat/message` | Enviar mensaje al asistente IA |
| GET | `/chat/conversations` | Listar conversaciones |
| GET | `/chat/conversations/:id` | Obtener conversación específica |

### Tareas
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tasks` | Listar tareas del usuario |
| POST | `/tasks` | Crear nueva tarea |
| GET | `/tasks/:id` | Obtener tarea específica |
| PUT | `/tasks/:id` | Actualizar tarea |
| DELETE | `/tasks/:id` | Eliminar tarea |
| POST | `/tasks/:id/start` | Iniciar timer de tarea |
| POST | `/tasks/:id/pause` | Pausar timer de tarea |
| POST | `/tasks/:id/complete` | Completar tarea |

### Health Check
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del servidor |

---

## Capas de Seguridad

### 1. Nivel Cloudflare
- **DDoS Protection**: Mitigación automática
- **WAF**: Reglas de firewall de aplicación
- **SSL/TLS**: Encriptación extremo a extremo (Full Strict)
- **Rate Limiting**: Disponible si se necesita
- **Bot Protection**: Detección de bots maliciosos

### 2. Nivel Sistema Operativo (VPS)
- **UFW Firewall**: Solo puertos 22, 80, 443
- **Fail2ban**: Protección contra brute force SSH
- **SSH Hardening**:
  - Solo autenticación por llave pública
  - Root login solo con llave
  - Protocolo SSH v2

### 3. Nivel Docker
- **Network Isolation**: Red overlay aislada
- **Secrets Management**: Credenciales en Docker Secrets
- **No Root**: Contenedores sin privilegios elevados
- **PostgreSQL**: No expuesto a internet

### 4. Nivel Aplicación
- **Rate Limiting**: 100 requests/minuto por IP
- **JWT Authentication**: Tokens con expiración de 7 días
- **Bcrypt**: Hash de contraseñas (12 rounds)
- **Input Validation**: Zod schemas
- **CORS**: Configurado para app móvil

---

## Archivos de Configuración

### Ubicaciones Principales
```
/root/proyectos/agente-seguimiento/
├── docker-compose.yml          # Stack de Docker Swarm
├── traefik/
│   ├── traefik.yml             # Configuración de Traefik
│   └── certs/
│       ├── origin.pem          # Certificado Cloudflare
│       └── origin-key.pem      # Llave privada
├── backend/
│   ├── Dockerfile              # Build del backend
│   ├── docker-entrypoint.sh    # Script de inicio
│   └── src/                    # Código fuente
└── database/
    └── schema.sql              # Esquema PostgreSQL
```

### Docker Compose (Resumen)
```yaml
version: '3.8'
services:
  traefik:
    image: traefik:v3.2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik:/etc/traefik

  backend:
    image: ghcr.io/.../agente-backend:latest
    secrets:
      - jwt_secret
      - db_password
      - openai_api_key
    labels:
      - traefik.http.routers.backend.rule=Host(`agenteapi.itelcore.org`)
      - traefik.http.routers.backend.tls=true

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
  openai_api_key:
    external: true
```

---

## Comandos Útiles

### Gestión del Stack
```bash
# Ver estado de servicios
docker stack services agente

# Ver logs del backend
docker service logs -f agente_backend

# Actualizar servicio (redeploy)
docker service update --force agente_backend

# Escalar servicio
docker service scale agente_backend=2
```

### Gestión de Secrets
```bash
# Listar secrets
docker secret ls

# Crear nuevo secret
echo "nuevo_valor" | docker secret create nombre_secret -

# Rotar secret (crear nuevo y actualizar servicio)
echo "nuevo_valor" | docker secret create nombre_secret_v2 -
docker service update --secret-rm nombre_secret --secret-add nombre_secret_v2 agente_backend
```

### Firewall
```bash
# Ver reglas
ufw status verbose

# Agregar regla
ufw allow 8080/tcp comment 'Descripcion'

# Eliminar regla
ufw delete allow 8080/tcp
```

### SSL/Certificados
```bash
# Verificar certificado actual
openssl x509 -in /root/proyectos/agente-seguimiento/traefik/certs/origin.pem -text -noout

# Verificar conexión HTTPS
curl -vI https://agenteapi.itelcore.org/health
```

---

## Monitoreo

### Health Checks
```bash
# Backend
curl https://agenteapi.itelcore.org/health

# Traefik (desde el VPS)
curl http://localhost:8080/ping  # Si está habilitado
```

### Logs
```bash
# Backend en tiempo real
docker service logs -f agente_backend

# PostgreSQL
docker service logs -f agente_postgres

# Traefik
docker service logs -f agente_traefik

# Fail2ban
tail -f /var/log/fail2ban.log

# Auth (SSH)
tail -f /var/log/auth.log
```

---

## Backup y Recuperación

### Base de Datos
```bash
# Backup
docker exec $(docker ps -q -f name=postgres) pg_dump -U postgres task_tracker_ai > backup.sql

# Restore
cat backup.sql | docker exec -i $(docker ps -q -f name=postgres) psql -U postgres task_tracker_ai
```

### Volúmenes Docker
```bash
# Backup de volumen
docker run --rm -v agente_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_data.tar.gz /data

# Restore
docker run --rm -v agente_postgres_data:/data -v $(pwd):/backup alpine tar xzf /backup/postgres_data.tar.gz -C /
```

---

## Notas de Seguridad

1. **Nunca exponer PostgreSQL** a internet (puerto 5432 solo interno)
2. **Rotar JWT_SECRET** periódicamente y después de cualquier compromiso
3. **Mantener actualizados** los contenedores Docker
4. **Revisar logs** de Fail2ban regularmente
5. **Backup diario** de la base de datos
6. **Certificado SSL** válido hasta 2041, pero revisar anualmente

---

*Documento generado: 2026-01-11*
*Última actualización: 2026-01-11*
