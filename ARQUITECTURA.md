# ARQUITECTURA: Agente de IA para Seguimiento de Tareas

## Visión del Producto

App móvil con asistente de IA que permite:
- Registrar tareas por voz ("empiezo reunión", "termino reunión")
- Seguimiento de tiempo automático
- Check-in diario al final del día
- Análisis inteligente de productividad
- **Interfaz dinámica**: La IA genera componentes visuales (gráficos, timelines, métricas) como parte de sus respuestas

---

## Stack Tecnológico (Decisiones Finales)

| Capa | Tecnología | Justificación |
|------|------------|---------------|
| **Frontend** | React Native + Expo | TypeScript end-to-end, Expo simplifica audio/notificaciones |
| **Backend** | Node.js + Fastify | ~2x más rápido que Express, WebSocket nativo |
| **Base de Datos** | PostgreSQL | Relacional + JSONB para flexibilidad |
| **IA** | OpenAI GPT-5-mini (API directa) | Balance costo/calidad, NO usar LangChain/LangGraph |
| **Voice-to-Text** | Deepgram Nova-3 | Streaming real-time, mejor español latinoamericano |
| **Estado** | Zustand + TanStack Query | Simple y eficiente |
| **Gráficos** | Victory Native | Charts nativos para React Native |

### Por qué NO LangChain/LangGraph
- El flujo es lineal: usuario habla → IA procesa → responde
- GPT-5 tiene function calling y structured outputs nativos
- LangChain añade abstracciones innecesarias para este caso
- LangGraph es para workflows con branching complejo y persistencia entre sesiones

---

## Vista General del Sistema

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENTE MÓVIL                                 │
│                         (React Native + Expo)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │   Voice     │  │    Chat     │  │  Dynamic    │  │    Local      │   │
│  │   Input     │  │  Interface  │  │  UI Render  │  │    State      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───────────────┘   │
│         │                │                │                              │
└─────────┼────────────────┼────────────────┼──────────────────────────────┘
          │                │                │
          │    WebSocket   │     HTTPS      │
          └────────────────┼────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Tu Servidor)                           │
│                          Node.js + Fastify                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                      API GATEWAY                                 │    │
│  │              /api/v1/* (REST + WebSocket)                        │    │
│  └─────────────────────────────┬───────────────────────────────────┘    │
│                                │                                         │
│  ┌──────────┬──────────┬───────┴───────┬──────────┬──────────────┐      │
│  │          │          │               │          │              │      │
│  ▼          ▼          ▼               ▼          ▼              ▼      │
│ ┌────┐   ┌──────┐   ┌──────┐      ┌────────┐  ┌───────┐    ┌────────┐  │
│ │Auth│   │Tasks │   │Goals │      │   AI   │  │Voice  │    │Insights│  │
│ │Svc │   │ Svc  │   │ Svc  │      │  Svc   │  │ Svc   │    │  Svc   │  │
│ └──┬─┘   └──┬───┘   └──┬───┘      └───┬────┘  └───┬───┘    └────┬───┘  │
│    │        │          │              │           │             │       │
│    └────────┴──────────┴──────────────┼───────────┴─────────────┘       │
│                                       │                                  │
│                        ┌──────────────┴──────────────┐                  │
│                        │                             │                  │
│                        ▼                             ▼                  │
│                 ┌─────────────┐              ┌─────────────┐            │
│                 │ PostgreSQL  │              │  Servicios  │            │
│                 │             │              │  Externos   │            │
│                 └─────────────┘              └──────┬──────┘            │
│                                                     │                   │
└─────────────────────────────────────────────────────┼───────────────────┘
                                                      │
                          ┌───────────────────────────┼───────────────┐
                          │                           │               │
                          ▼                           ▼               ▼
                   ┌─────────────┐            ┌─────────────┐  ┌───────────┐
                   │   OpenAI    │            │  Deepgram   │  │   Push    │
                   │   GPT-5     │            │  Nova-3     │  │  (Expo)   │
                   └─────────────┘            └─────────────┘  └───────────┘
```

---

## Arquitectura del Agente de IA (El Cerebro)

### Qué es un "Agente" en este contexto

Un agente es simplemente: **LLM + Tools + Loop de decisión**

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DEL AGENTE                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                     SYSTEM PROMPT                           │ │
│  │  - Personalidad: Asistente de productividad amigable       │ │
│  │  - Contexto: Hora local, tareas activas, metas del usuario │ │
│  │  - Instrucciones: Cuándo usar cada tool, formato respuesta │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                      GPT-5-mini                             │ │
│  │                                                             │ │
│  │   Recibe:                                                   │ │
│  │   - System prompt + contexto                                │ │
│  │   - Mensaje del usuario                                     │ │
│  │   - Lista de tools disponibles (con descripciones)         │ │
│  │   - Schema de respuesta (structured output)                │ │
│  │                                                             │ │
│  │   Decide:                                                   │ │
│  │   - ¿Necesito usar un tool? → tool_call                    │ │
│  │   - ¿Solo respondo texto? → respuesta directa              │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                    ┌─────────┴─────────┐                        │
│                    ▼                   ▼                        │
│            ┌─────────────┐      ┌─────────────┐                 │
│            │  Tool Call  │      │  Respuesta  │                 │
│            │  Detected   │      │   Directa   │                 │
│            └──────┬──────┘      └─────────────┘                 │
│                   │                                              │
│                   ▼                                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              EJECUTOR DE TOOLS (Backend)                    │ │
│  │                                                             │ │
│  │  Ejemplo: create_task llamado con argumentos:               │ │
│  │  → Inserta en PostgreSQL                                    │ │
│  │  → Retorna resultado al LLM                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                   │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │           SEGUNDA LLAMADA A GPT-5 (si hubo tool)           │ │
│  │                                                             │ │
│  │  - Recibe resultado del tool                               │ │
│  │  - Genera respuesta final con texto + uiComponents         │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Cómo Decide el LLM Cuándo Usar Tools

El LLM decide basándose en:

1. **Descripción del tool**: Cada tool tiene una descripción que explica cuándo usarlo
2. **System prompt**: Instrucciones explícitas sobre comportamiento
3. **Contexto del usuario**: Tareas activas, metas, hora local
4. **Intención del mensaje**: El LLM interpreta qué quiere el usuario

**Ejemplo de descripción de tool:**
```
Tool: create_task
Descripción: "Usar cuando el usuario quiere crear una nueva tarea o
             dice que va a empezar algo. Si dice 'empiezo X', crear
             la tarea con startNow=true para iniciar el timer."
Parámetros: name, category, startNow, estimatedMinutes
```

**Flujo de decisión:**
```
Usuario: "Empiezo reunión con cliente"
                    │
                    ▼
    ┌───────────────────────────────────┐
    │   GPT-5 analiza el mensaje        │
    │   + contexto + tools disponibles  │
    └───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │   "empiezo" → intención de crear  │
    │   tarea con timer activo          │
    │                                   │
    │   Tool más adecuado: create_task  │
    │   con startNow = true             │
    └───────────────────────────────────┘
                    │
                    ▼
    ┌───────────────────────────────────┐
    │   Ejecuta tool → DB insert        │
    │   Resultado → Segunda llamada     │
    │   Respuesta final con UI          │
    └───────────────────────────────────┘
```

### Tools Disponibles para el Agente

| Tool | Cuándo se usa | Parámetros principales |
|------|---------------|----------------------|
| `create_task` | Usuario dice "empiezo X", "voy a hacer X", "nueva tarea" | name, category, startNow, estimatedMinutes |
| `complete_task` | "Terminé", "listo", "completé X" | taskId (opcional, si no se da usa la activa) |
| `pause_task` | "Pauso", "un momento", "descanso" | taskId (opcional) |
| `get_today_tasks` | "Qué hice hoy", "mi día", "resumen" | ninguno |
| `get_time_analysis` | "Cuánto tiempo", "distribución", "analytics" | period (day/week/month) |
| `get_goals_progress` | "Mis metas", "cómo voy", "objetivos" | ninguno |
| `create_goal` | "Quiero lograr X", "mi meta es" | title, targetValue, period |
| `analyze_patterns` | "Patrones", "tendencias", "por qué no cumplo" | ninguno |
| `start_daily_checkin` | "Check-in", "cómo me fue", "fin del día" | ninguno |

### Estructura de Respuesta del Agente (Structured Output)

El agente SIEMPRE responde con esta estructura:

```
{
  "text": "Mensaje de texto para el usuario",
  "uiComponents": [
    {
      "type": "nombre_componente",
      "id": "único",
      "order": 1,
      "props": { ... datos específicos del componente ... }
    }
  ]
}
```

El schema se define en la llamada a OpenAI como `response_format` con `type: "json_schema"`.

---

## Flujo de Voz (Servidor como Proxy)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO COMPLETO DE VOZ                        │
└─────────────────────────────────────────────────────────────────┘

PASO 1: Usuario presiona botón de voz en la app

PASO 2: App abre WebSocket a tu servidor
        wss://tu-servidor.com/api/v1/voice/stream

PASO 3: App envía chunks de audio (PCM 16kHz) mientras habla

PASO 4: Tu servidor reenvía chunks a Deepgram (WebSocket)

PASO 5: Deepgram devuelve transcripciones parciales en tiempo real

PASO 6: Servidor reenvía texto parcial a la app (usuario ve mientras habla)

PASO 7: Usuario suelta botón → transcripción final

PASO 8: App envía texto final a POST /api/v1/chat/message

┌─────────┐         ┌─────────────┐         ┌─────────┐
│   App   │ ──────▶ │ Tu Servidor │ ──────▶ │Deepgram │
│         │  audio  │   (proxy)   │  audio  │         │
│         │ ◀────── │             │ ◀────── │         │
└─────────┘  texto  └─────────────┘  texto  └─────────┘
```

**Ventajas del proxy:**
- API key de Deepgram nunca expuesta en el cliente
- Control de rate-limiting y logging
- Fácil cambiar de proveedor STT sin actualizar la app

**Latencia adicional:** ~50-100ms (generalmente imperceptible)

---

## Flujo de Chat con IA (7 Pasos)

```
┌─────────────────────────────────────────────────────────────────┐
│                     FLUJO COMPLETO DE CHAT                       │
└─────────────────────────────────────────────────────────────────┘

PASO 1: App envía mensaje
        POST /api/v1/chat/message
        Body: { conversationId, content: "Empiezo reunión", isVoice: true }

PASO 2: AI Service construye contexto
        Consulta PostgreSQL:
        - Datos del usuario (nombre, timezone)
        - Hora local actual
        - Tarea activa (si hay)
        - Tareas de hoy (completadas y pendientes)
        - Metas activas y su progreso

PASO 3: Primera llamada a GPT-5
        - System prompt + contexto construido
        - Mensaje del usuario
        - Lista de tools con descripciones
        - Schema de respuesta (structured output)

PASO 4: GPT-5 decide usar tool (o responde directo)
        Respuesta: tool_call "create_task" con argumentos

PASO 5: Backend ejecuta el tool
        - Inserta tarea en PostgreSQL
        - Inicia timer (actual_start = NOW)
        - Retorna resultado: { taskId, name, startedAt }

PASO 6: Segunda llamada a GPT-5
        - Incluye resultado del tool
        - GPT-5 genera respuesta final con texto + uiComponents

PASO 7: App renderiza respuesta
        - Muestra texto del asistente
        - DynamicUIRenderer renderiza los componentes
```

---

## Sistema de UI Dinámica

### Concepto Central

La IA no solo responde texto. Genera **componentes visuales** que la app renderiza dinámicamente. Esto crea una experiencia "estilo película" donde la interfaz se adapta al contexto.

### Componentes Predefinidos (10 iniciales)

| Componente | Propósito | Props principales |
|------------|-----------|-------------------|
| `task_timeline` | Visualizar día con bloques de tiempo | date, tasks[] (con horarios) |
| `metrics_card` | KPI individual con tendencia | title, value, trend, comparison |
| `bar_chart` | Comparar categorías/días | data[] ({label, value}), title |
| `pie_chart` | Distribución porcentual | data[] ({label, value, color}) |
| `progress_ring` | Progreso circular de meta | current, target, label, color |
| `task_list` | Lista interactiva de tareas | tasks[], showActions |
| `alert_card` | Alertas y sugerencias | severity, title, message, action |
| `goal_tracker` | Estado detallado de objetivo | goal, history[], projectedEnd |
| `pattern_insight` | Patrón detectado | pattern, evidence[], suggestion |
| `quick_actions` | Botones de acción sugeridos | actions[] ({label, action, icon}) |

### Cómo Funciona el Render

1. **Registro**: La app tiene un diccionario de componentes disponibles
2. **Respuesta IA**: Incluye array de uiComponents con type, id, order, props
3. **DynamicUIRenderer**: Itera el array, busca el componente por type, pasa props
4. **Ordenamiento**: Los componentes se ordenan por el campo "order"
5. **Animación**: Cada componente aparece con animación de entrada

### Ejemplo de Respuesta con UI

```
Usuario: "¿Cómo me fue hoy?"

Respuesta IA:
{
  "text": "Tuviste un día productivo con 4.5 horas de trabajo enfocado.",
  "uiComponents": [
    {
      "type": "task_timeline",
      "id": "tl_001",
      "order": 1,
      "props": {
        "date": "2026-01-08",
        "tasks": [
          { "name": "Emails", "start": "08:00", "end": "08:30", "status": "completed" },
          { "name": "Reunión cliente", "start": "09:00", "end": "10:30", "status": "completed" },
          { "name": "Desarrollo", "start": "11:00", "end": "14:00", "status": "completed" }
        ]
      }
    },
    {
      "type": "pie_chart",
      "id": "pc_001",
      "order": 2,
      "props": {
        "title": "Distribución del tiempo",
        "data": [
          { "label": "Reuniones", "value": 90, "color": "#FF6B6B" },
          { "label": "Desarrollo", "value": 180, "color": "#4ECDC4" },
          { "label": "Admin", "value": 30, "color": "#95A5A6" }
        ]
      }
    },
    {
      "type": "progress_ring",
      "id": "pr_001",
      "order": 3,
      "props": {
        "label": "Meta: 4h trabajo profundo",
        "current": 4.5,
        "target": 4,
        "color": "#2ECC71"
      }
    }
  ]
}
```

---

## Modelo de Datos (PostgreSQL)

### Diagrama de Relaciones

```
┌──────────────┐       ┌─────────────────┐       ┌──────────────────┐
│    users     │       │  conversations  │       │    messages      │
├──────────────┤       ├─────────────────┤       ├──────────────────┤
│ id (PK)      │──┐    │ id (PK)         │──┐    │ id (PK)          │
│ email        │  │    │ user_id (FK)    │  │    │ conversation_id  │
│ name         │  │    │ title           │  │    │ role             │
│ timezone     │  │    │ created_at      │  │    │ content          │
│ preferences  │  │    └─────────────────┘  │    │ ui_components    │◀─ JSONB
│ created_at   │  │                         │    │ created_at       │
└──────────────┘  │                         │    └──────────────────┘
                  │                         │
                  │    ┌─────────────────┐  │
                  │    │     tasks       │  │    ┌──────────────────┐
                  └───▶├─────────────────┤  │    │   task_events    │
                       │ id (PK)         │  │    ├──────────────────┤
                       │ user_id (FK)    │  │    │ id (PK)          │
                       │ category_id     │──┼───▶│ task_id (FK)     │
                       │ name            │  │    │ event_type       │
                       │ status          │  │    │ timestamp        │
                       │ actual_start    │  │    └──────────────────┘
                       │ actual_end      │  │
                       │ estimated_min   │  │    ┌──────────────────┐
                       │ actual_min      │  │    │     goals        │
                       └─────────────────┘  │    ├──────────────────┤
                                            └───▶│ id (PK)          │
┌──────────────────┐   ┌─────────────────┐       │ user_id (FK)     │
│   categories     │   │   check_ins     │       │ title            │
├──────────────────┤   ├─────────────────┤       │ target_value     │
│ id (PK)          │   │ id (PK)         │       │ current_value    │
│ user_id (FK)     │   │ user_id (FK)    │       │ period           │
│ name             │   │ date            │       │ status           │
│ color            │   │ mood_score      │       └──────────────────┘
└──────────────────┘   │ energy_level    │
                       │ ai_analysis     │◀─ JSONB
                       └─────────────────┘
```

### Tablas Principales

**users** - Usuarios del sistema
- id, email, name, password_hash, timezone, preferences (JSONB), created_at

**conversations** - Sesiones de chat
- id, user_id, title, created_at

**messages** - Mensajes con UI components
- id, conversation_id, role ('user'|'assistant'), content, ui_components (JSONB), created_at

**tasks** - Tareas con tracking de tiempo
- id, user_id, category_id, name, status, priority, scheduled_date
- estimated_minutes, actual_start, actual_end, actual_minutes, created_at

**task_events** - Historial granular de eventos
- id, task_id, event_type ('started'|'paused'|'resumed'|'completed'), timestamp

**categories** - Categorías personalizables
- id, user_id, name, color, created_at

**goals** - Metas con tracking
- id, user_id, title, target_value, current_value, period ('daily'|'weekly'|'monthly'), status, created_at

**goal_progress** - Historial de progreso
- id, goal_id, date, value, created_at

**check_ins** - Check-in diario
- id, user_id, date (UNIQUE con user_id), mood_score (1-5), energy_level (1-5), ai_analysis (JSONB)

**daily_summaries** - Resúmenes generados por IA
- id, user_id, date, summary (JSONB), created_at

---

## APIs del Backend

### Endpoints por Servicio

**Auth Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Registro de usuario |
| POST | `/api/v1/auth/login` | Login → retorna JWT |
| POST | `/api/v1/auth/refresh` | Renovar token |

**Voice Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| WS | `/api/v1/voice/stream` | WebSocket para streaming de audio |

**Chat Service (Principal)**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/chat/message` | Enviar mensaje → respuesta IA |
| GET | `/api/v1/chat/conversations` | Listar conversaciones |
| GET | `/api/v1/chat/conversations/:id/messages` | Historial de mensajes |

**Tasks Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/tasks` | Listar tareas (con filtros) |
| POST | `/api/v1/tasks` | Crear tarea |
| POST | `/api/v1/tasks/:id/start` | Iniciar timer |
| POST | `/api/v1/tasks/:id/pause` | Pausar timer |
| POST | `/api/v1/tasks/:id/complete` | Completar tarea |

**Categories Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/categories` | Listar categorías del usuario |
| POST | `/api/v1/categories` | Crear categoría |
| PUT | `/api/v1/categories/:id` | Actualizar categoría |

**Goals Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/goals` | Listar metas activas |
| POST | `/api/v1/goals` | Crear meta |
| GET | `/api/v1/goals/:id/progress` | Historial de progreso |

**Check-in Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/check-ins/today` | Check-in de hoy (si existe) |
| POST | `/api/v1/check-ins` | Crear/actualizar check-in |

**Insights Service**
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/v1/insights/daily/:date` | Resumen del día |
| GET | `/api/v1/insights/weekly` | Resumen semanal |
| GET | `/api/v1/insights/patterns` | Patrones detectados |

---

## Estructura de Carpetas

### Frontend (React Native + Expo)

```
src/
├── app/                          # Navegación (Expo Router o React Navigation)
│   ├── (auth)/                   # Screens de autenticación
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (main)/                   # Screens principales (requiere auth)
│   │   ├── chat.tsx              # Pantalla principal de chat
│   │   ├── insights.tsx          # Dashboard de analytics
│   │   └── settings.tsx
│   └── _layout.tsx
│
├── features/
│   ├── voice-input/              # Feature de entrada por voz
│   │   ├── components/
│   │   │   └── VoiceButton.tsx
│   │   ├── hooks/
│   │   │   └── useDeepgramStream.ts
│   │   └── services/
│   │       └── voiceWebSocket.ts
│   │
│   ├── chat/                     # Feature de chat
│   │   ├── components/
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── InputBar.tsx
│   │   ├── hooks/
│   │   │   └── useChat.ts
│   │   └── types/
│   │       └── message.types.ts
│   │
│   ├── dynamic-ui/               # Sistema de UI dinámica
│   │   ├── DynamicUIRenderer.tsx
│   │   ├── componentRegistry.ts
│   │   └── ui-components/
│   │       ├── TaskTimeline.tsx
│   │       ├── MetricsCard.tsx
│   │       ├── BarChart.tsx
│   │       ├── PieChart.tsx
│   │       ├── ProgressRing.tsx
│   │       ├── TaskList.tsx
│   │       ├── AlertCard.tsx
│   │       ├── GoalTracker.tsx
│   │       ├── PatternInsight.tsx
│   │       └── QuickActions.tsx
│   │
│   ├── tasks/                    # Feature de tareas
│   │   ├── components/
│   │   ├── hooks/
│   │   └── types/
│   │
│   ├── check-in/                 # Feature de check-in diario
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── goals/                    # Feature de metas
│   │   ├── components/
│   │   └── hooks/
│   │
│   ├── insights/                 # Feature de analytics
│   │   ├── components/
│   │   └── hooks/
│   │
│   └── auth/                     # Feature de autenticación
│       ├── components/
│       ├── hooks/
│       └── services/
│
├── shared/
│   ├── components/ui/            # Componentes base reutilizables
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── hooks/                    # Hooks compartidos
│   │   └── useAuth.ts
│   ├── services/api/             # Cliente HTTP + WebSocket
│   │   ├── apiClient.ts
│   │   └── wsClient.ts
│   ├── store/                    # Zustand stores
│   │   ├── authStore.ts
│   │   └── chatStore.ts
│   ├── types/                    # Tipos globales
│   │   └── api.types.ts
│   └── utils/                    # Utilidades
│       └── date.ts
│
└── assets/                       # Imágenes, fuentes, etc.
```

### Backend (Node.js + Fastify)

```
backend/
├── src/
│   ├── app.ts                    # Setup de Fastify
│   ├── server.ts                 # Entry point
│   │
│   ├── routes/                   # Definición de rutas
│   │   ├── auth.routes.ts
│   │   ├── chat.routes.ts
│   │   ├── voice.routes.ts
│   │   ├── tasks.routes.ts
│   │   ├── goals.routes.ts
│   │   ├── check-ins.routes.ts
│   │   └── insights.routes.ts
│   │
│   ├── services/                 # Lógica de negocio
│   │   ├── auth/
│   │   │   └── auth.service.ts
│   │   ├── ai/
│   │   │   ├── ai.service.ts
│   │   │   ├── tools.ts          # Definición de tools
│   │   │   ├── toolExecutor.ts   # Ejecuta los tools
│   │   │   └── systemPrompt.ts   # Personalidad del asistente
│   │   ├── voice/
│   │   │   └── deepgram.service.ts
│   │   ├── tasks/
│   │   │   └── tasks.service.ts
│   │   ├── goals/
│   │   │   └── goals.service.ts
│   │   ├── check-ins/
│   │   │   └── check-ins.service.ts
│   │   └── insights/
│   │       └── insights.service.ts
│   │
│   ├── repositories/             # Acceso a datos
│   │   ├── users.repository.ts
│   │   ├── tasks.repository.ts
│   │   ├── messages.repository.ts
│   │   └── ...
│   │
│   ├── middleware/
│   │   └── auth.middleware.ts    # Verificación JWT
│   │
│   ├── schemas/                  # Validación Zod/JSON Schema
│   │   ├── auth.schema.ts
│   │   ├── chat.schema.ts
│   │   └── ...
│   │
│   ├── types/                    # Tipos TypeScript
│   │   └── index.ts
│   │
│   └── utils/
│       ├── db.ts                 # Conexión PostgreSQL
│       └── openai.ts             # Cliente OpenAI
│
├── database/
│   ├── schema.sql                # Schema completo
│   └── migrations/               # Migraciones
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Plan de Implementación por Fases

### Fase 1: Fundamentos (Core funcional)
- Setup React Native + Expo con navegación básica
- Setup Backend Node.js + Fastify
- Setup PostgreSQL con schema inicial (users, conversations, messages, tasks)
- Autenticación JWT (register, login, middleware)
- Chat básico con GPT-5 (sin tools, solo texto)
- Integración Deepgram (voz → texto streaming)

### Fase 2: Tools y UI Dinámica
- Implementar tools: create_task, complete_task, pause_task
- Sistema de timer (task_events para start/pause/resume/complete)
- DynamicUIRenderer en frontend
- Componentes: TaskTimeline, TaskList, MetricsCard
- Structured outputs para respuestas con uiComponents
- Animaciones de entrada para componentes

### Fase 3: Categorías y Metas
- CRUD de categorías
- CRUD de goals + goal_progress
- Tools: create_goal, get_goals_progress
- Componentes: GoalTracker, ProgressRing

### Fase 4: Check-in y Analytics
- Flow de check-in diario
- Tabla daily_summaries
- Tools: get_time_analysis, start_daily_checkin
- Componentes: PieChart, BarChart
- Push notifications (Expo Notifications) para recordatorio de check-in

### Fase 5: Diagnóstico Inteligente
- Algoritmo de detección de patrones (en insights.service)
- Tool: analyze_patterns
- Análisis de incumplimiento de metas
- Componentes: PatternInsight, AlertCard
- Sugerencias proactivas de la IA

### Fase 6: Pulido
- Onboarding (primera vez)
- Dark/Light mode
- Animaciones Lottie
- Testing
- Optimización de performance

---

## Verificación End-to-End

Para validar que el sistema funciona correctamente:

1. **Voice Input**: Grabar "empiezo reunión" → ver transcripción en tiempo real en la app
2. **Task Creation**: La IA debe crear la tarea automáticamente con timer activo
3. **Dynamic UI**: Ver TaskTimeline actualizado mostrando la tarea activa
4. **Complete Task**: Decir "terminé" → IA completa y muestra resumen con métricas
5. **Check-in**: Al final del día, pedir "cómo me fue" → ver gráficos y análisis
6. **Insights**: Pedir "cómo me fue esta semana" → ver comparaciones y patrones

---

## Costos Estimados (por Usuario Activo/Mes)

| Servicio | Uso Estimado | Costo Aproximado |
|----------|--------------|------------------|
| GPT-5-mini | ~50 mensajes/día | ~$2-4 |
| Deepgram | ~10 min voz/día | ~$1.5 |
| **Total** | | **~$3-6/usuario/mes** |

---

## Decisiones de Diseño Clave (Resumen)

1. **API Directa sobre LangChain** - Flujo simple, menos dependencias, más control
2. **Deepgram sobre Whisper** - Streaming real-time, mejor español latinoamericano
3. **GPT-5-mini** - Balance costo/calidad para interacciones frecuentes
4. **Servidor como Proxy de Voz** - Seguridad, control, flexibilidad
5. **Structured Outputs** - UI dinámica type-safe, no strings parseados
6. **Componentes Predefinidos** - Control de UX, consistencia visual
7. **Feature-based Structure** - Mejor escalabilidad y mantenibilidad
8. **PostgreSQL con JSONB** - Flexibilidad para campos como ui_components

---

## Archivos Críticos para Comenzar

1. `backend/database/schema.sql` - Schema PostgreSQL completo
2. `backend/src/services/ai/tools.ts` - Definición de tools para GPT-5
3. `backend/src/services/ai/systemPrompt.ts` - Personalidad del asistente
4. `backend/src/services/ai/toolExecutor.ts` - Lógica de ejecución de tools
5. `src/features/dynamic-ui/DynamicUIRenderer.tsx` - Core de UI dinámica
6. `src/features/voice-input/hooks/useDeepgramStream.ts` - Streaming de voz
