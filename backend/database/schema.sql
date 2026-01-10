-- =====================================================
-- SCHEMA DE BASE DE DATOS: Task Tracker AI
-- =====================================================
--
-- Este archivo define la estructura completa de la base de datos.
--
-- Para ejecutar:
--   1. Crear la base de datos: CREATE DATABASE task_tracker_ai;
--   2. Conectar a la base de datos: \c task_tracker_ai
--   3. Ejecutar este archivo: \i schema.sql
--
-- Orden de tablas (por dependencias):
--   1. users (independiente)
--   2. categories (depende de users)
--   3. conversations (depende de users)
--   4. messages (depende de conversations)
--   5. tasks (depende de users, categories)
--   6. task_events (depende de tasks)
--   7. goals (depende de users)
--   8. goal_progress (depende de goals)
--   9. check_ins (depende de users)
--   10. daily_summaries (depende de users)
-- =====================================================


-- =====================================================
-- EXTENSIONES
-- =====================================================
-- uuid-ossp: Genera UUIDs para IDs de registros
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- =====================================================
-- TABLA: users
-- =====================================================
-- Almacena los usuarios del sistema.
-- Cada usuario tiene un email único y preferencias personalizables.
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    -- ID único usando UUID (más seguro que auto-increment)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Email único (usado para login)
    email VARCHAR(255) UNIQUE NOT NULL,

    -- Nombre del usuario (para personalización)
    name VARCHAR(255) NOT NULL,

    -- Contraseña hasheada con bcrypt (NUNCA guardar en texto plano)
    password_hash VARCHAR(255) NOT NULL,

    -- Zona horaria del usuario (para mostrar horas correctas)
    -- Formato: 'America/Mexico_City', 'Europe/Madrid', etc.
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/Mexico_City',

    -- Preferencias del usuario (almacenadas como JSON)
    -- Ejemplo: { "theme": "dark", "notifications_enabled": true }
    preferences JSONB NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para búsqueda por email (usado en login)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);


-- =====================================================
-- TABLA: categories
-- =====================================================
-- Categorías personalizables para organizar tareas.
-- Cada usuario puede crear sus propias categorías.
-- Ejemplos: "Trabajo", "Personal", "Ejercicio", "Estudio"
-- =====================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario dueño de la categoría
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Nombre de la categoría
    name VARCHAR(100) NOT NULL,

    -- Color en formato hex para la UI (ej: '#FF5733')
    color VARCHAR(7) NOT NULL DEFAULT '#6366F1',

    -- Icono opcional (nombre del icono de la librería)
    icon VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un usuario no puede tener dos categorías con el mismo nombre
    UNIQUE(user_id, name)
);

-- Índice para listar categorías de un usuario
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);


-- =====================================================
-- TABLA: conversations
-- =====================================================
-- Sesiones de chat entre el usuario y la IA.
-- Cada vez que el usuario abre el chat, puede ser una nueva conversación
-- o continuar una existente.
-- =====================================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario dueño de la conversación
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Título de la conversación (puede generarlo la IA)
    title VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para listar conversaciones de un usuario (ordenadas por fecha)
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at DESC);


-- =====================================================
-- TABLA: messages
-- =====================================================
-- Mensajes dentro de una conversación.
-- Puede ser del usuario ('user') o del asistente ('assistant').
-- Los mensajes del asistente pueden incluir UI components.
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Conversación a la que pertenece
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,

    -- Quién envió el mensaje
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),

    -- Contenido de texto del mensaje
    content TEXT NOT NULL,

    -- Componentes de UI generados por la IA (solo para 'assistant')
    -- Ejemplo: [{ "type": "task_timeline", "props": {...} }]
    ui_components JSONB,

    -- Si el mensaje del usuario vino de entrada de voz
    is_voice BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para obtener mensajes de una conversación (ordenados)
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);


-- =====================================================
-- TABLA: tasks
-- =====================================================
-- Tareas del usuario con tracking de tiempo.
-- Guarda tanto el tiempo estimado como el tiempo real.
-- =====================================================
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario dueño de la tarea
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Categoría opcional
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,

    -- Nombre de la tarea (lo que el usuario dijo)
    name VARCHAR(500) NOT NULL,

    -- Descripción opcional
    description TEXT,

    -- Estado actual de la tarea
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

    -- Prioridad
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),

    -- Fecha programada (opcional, para tareas planificadas)
    scheduled_date DATE,

    -- Tiempo estimado en minutos (opcional)
    estimated_minutes INTEGER,

    -- Timestamps de ejecución real
    actual_start TIMESTAMPTZ,  -- Cuándo empezó realmente
    actual_end TIMESTAMPTZ,    -- Cuándo terminó realmente

    -- Minutos reales trabajados (calculado de los eventos)
    actual_minutes INTEGER,

    -- Timestamps de creación
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para listar tareas de un usuario por fecha
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, scheduled_date DESC);

-- Índice para buscar tareas por estado
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);

-- Índice para buscar la tarea activa (in_progress)
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(user_id, status) WHERE status = 'in_progress';


-- =====================================================
-- TABLA: task_events
-- =====================================================
-- Historial granular de eventos de cada tarea.
-- Permite reconstruir exactamente qué pasó con una tarea.
-- Útil para calcular tiempo real trabajado (con pausas).
-- =====================================================
CREATE TABLE IF NOT EXISTS task_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Tarea a la que pertenece el evento
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,

    -- Tipo de evento
    event_type VARCHAR(20) NOT NULL
        CHECK (event_type IN ('started', 'paused', 'resumed', 'completed', 'cancelled')),

    -- Momento exacto del evento
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Metadata adicional (ej: notas al completar)
    metadata JSONB
);

-- Índice para obtener eventos de una tarea (ordenados)
CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id, timestamp ASC);


-- =====================================================
-- TABLA: goals
-- =====================================================
-- Metas del usuario (diarias, semanales, mensuales).
-- Ejemplo: "4 horas de trabajo profundo al día"
-- =====================================================
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario dueño de la meta
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Título de la meta
    title VARCHAR(255) NOT NULL,

    -- Descripción opcional
    description TEXT,

    -- Valor objetivo (ej: 4 horas = 240 minutos)
    target_value NUMERIC(10, 2) NOT NULL,

    -- Valor actual (progreso)
    current_value NUMERIC(10, 2) NOT NULL DEFAULT 0,

    -- Unidad de medida (para mostrar en UI)
    unit VARCHAR(50) NOT NULL DEFAULT 'minutos',

    -- Período de la meta
    period VARCHAR(20) NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),

    -- Estado de la meta
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'failed', 'paused')),

    -- Fecha de inicio
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Fecha de fin (opcional, para metas con deadline)
    end_date DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para listar metas activas de un usuario
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON goals(user_id, status) WHERE status = 'active';


-- =====================================================
-- TABLA: goal_progress
-- =====================================================
-- Registro histórico del progreso de cada meta.
-- Permite ver cómo ha evolucionado el progreso día a día.
-- =====================================================
CREATE TABLE IF NOT EXISTS goal_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Meta a la que pertenece
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,

    -- Fecha del registro
    date DATE NOT NULL,

    -- Valor de ese día
    value NUMERIC(10, 2) NOT NULL,

    -- Notas opcionales
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un registro por día por meta
    UNIQUE(goal_id, date)
);

-- Índice para obtener progreso histórico
CREATE INDEX IF NOT EXISTS idx_goal_progress_goal ON goal_progress(goal_id, date DESC);


-- =====================================================
-- TABLA: check_ins
-- =====================================================
-- Check-in diario del usuario.
-- Al final del día, el usuario responde cómo le fue.
-- La IA genera un análisis basado en las tareas del día.
-- =====================================================
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Fecha del check-in
    date DATE NOT NULL,

    -- Puntuación de estado de ánimo (1-5)
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),

    -- Nivel de energía (1-5)
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),

    -- Notas del usuario
    notes TEXT,

    -- Análisis generado por la IA
    -- Ejemplo: { "summary": "...", "highlights": [...], "suggestions": [...] }
    ai_analysis JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un check-in por día por usuario
    UNIQUE(user_id, date)
);

-- Índice para obtener check-ins recientes
CREATE INDEX IF NOT EXISTS idx_check_ins_user ON check_ins(user_id, date DESC);


-- =====================================================
-- TABLA: daily_summaries
-- =====================================================
-- Resúmenes diarios generados por la IA.
-- Se generan automáticamente al final del día.
-- =====================================================
CREATE TABLE IF NOT EXISTS daily_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Usuario
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Fecha del resumen
    date DATE NOT NULL,

    -- Resumen generado por la IA
    -- Incluye: estadísticas, patrones, sugerencias
    summary JSONB NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un resumen por día por usuario
    UNIQUE(user_id, date)
);

-- Índice para obtener resúmenes recientes
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user ON daily_summaries(user_id, date DESC);


-- =====================================================
-- FUNCIÓN: update_updated_at
-- =====================================================
-- Función que actualiza automáticamente el campo updated_at
-- cuando se modifica un registro.
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =====================================================
-- TRIGGERS: Auto-actualizar updated_at
-- =====================================================
-- Aplicamos el trigger a todas las tablas con updated_at

CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_goals_updated_at
    BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_check_ins_updated_at
    BEFORE UPDATE ON check_ins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =====================================================
-- DATOS INICIALES: Categorías por defecto
-- =====================================================
-- Estas categorías se crean para cada nuevo usuario
-- (esto se hace en el código al registrar, no aquí)
-- Solo documentamos cuáles serán:
--
-- 1. Trabajo      (#3B82F6) - Azul
-- 2. Personal     (#10B981) - Verde
-- 3. Estudio      (#8B5CF6) - Violeta
-- 4. Ejercicio    (#F59E0B) - Naranja
-- 5. Reuniones    (#EF4444) - Rojo
-- =====================================================


-- =====================================================
-- COMENTARIOS EN TABLAS (para documentación)
-- =====================================================
COMMENT ON TABLE users IS 'Usuarios del sistema con sus preferencias';
COMMENT ON TABLE categories IS 'Categorías personalizables para organizar tareas';
COMMENT ON TABLE conversations IS 'Sesiones de chat entre usuario y la IA';
COMMENT ON TABLE messages IS 'Mensajes de chat con posibles componentes UI';
COMMENT ON TABLE tasks IS 'Tareas con tracking de tiempo estimado vs real';
COMMENT ON TABLE task_events IS 'Historial de eventos de cada tarea';
COMMENT ON TABLE goals IS 'Metas del usuario (diarias, semanales, mensuales)';
COMMENT ON TABLE goal_progress IS 'Registro histórico del progreso de metas';
COMMENT ON TABLE check_ins IS 'Check-in diario con análisis de la IA';
COMMENT ON TABLE daily_summaries IS 'Resúmenes diarios generados por la IA';


-- =====================================================
-- FIN DEL SCHEMA
-- =====================================================
-- Para verificar que todo se creó correctamente:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- =====================================================
