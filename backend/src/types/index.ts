/**
 * =====================================================
 * TIPOS GLOBALES DEL BACKEND
 * =====================================================
 *
 * Este archivo define las interfaces TypeScript que usamos
 * en todo el backend. Tener tipos bien definidos nos ayuda a:
 * - Autocompletado en el editor
 * - Detectar errores antes de ejecutar
 * - Documentar la estructura de datos
 */

// =====================================================
// USUARIO
// =====================================================

/**
 * Usuario almacenado en la base de datos
 */
export interface User {
  id: string;
  email: string;
  name: string;
  password_hash: string;  // Nunca exponer al cliente
  timezone: string;
  preferences: UserPreferences;
  created_at: Date;
  updated_at: Date;
}

/**
 * Preferencias del usuario (almacenadas como JSONB)
 */
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications_enabled?: boolean;
  daily_checkin_time?: string;  // Formato HH:mm
  language?: string;
}

/**
 * Usuario sin datos sensibles (para enviar al cliente)
 */
export type UserPublic = Omit<User, 'password_hash'>;


// =====================================================
// AUTENTICACIÓN
// =====================================================

/**
 * Payload decodificado del JWT
 */
export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;  // Issued at (timestamp)
  exp: number;  // Expiration (timestamp)
}

/**
 * Request con usuario autenticado
 * Extiende el request de Fastify para incluir el usuario
 */
export interface AuthenticatedRequest {
  user: JWTPayload;
}


// =====================================================
// CONVERSACIONES Y MENSAJES
// =====================================================

/**
 * Conversación (sesión de chat)
 */
export interface Conversation {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Mensaje en una conversación
 */
export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_components: UIComponent[] | null;  // Solo para mensajes del asistente
  is_voice: boolean;  // Si el mensaje vino de voz
  created_at: Date;
}

/**
 * Componente de UI generado por la IA
 * La app móvil renderiza estos componentes dinámicamente
 */
export interface UIComponent {
  type: UIComponentType;
  id: string;
  order: number;  // Orden de aparición
  props: Record<string, unknown>;  // Props específicos del componente
}

/**
 * Tipos de componentes UI disponibles
 */
export type UIComponentType =
  | 'task_timeline'    // Timeline visual del día
  | 'metrics_card'     // KPI con tendencia
  | 'bar_chart'        // Gráfico de barras
  | 'pie_chart'        // Gráfico circular
  | 'progress_ring'    // Anillo de progreso
  | 'task_list'        // Lista de tareas interactiva
  | 'alert_card'       // Alerta o sugerencia
  | 'goal_tracker'     // Tracker de objetivo
  | 'pattern_insight'  // Insight de patrón detectado
  | 'quick_actions';   // Botones de acción rápida


// =====================================================
// TAREAS
// =====================================================

/**
 * Estados posibles de una tarea
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

/**
 * Prioridades de tarea
 */
export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * Tarea almacenada en la base de datos
 */
export interface Task {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  scheduled_date: Date | null;
  estimated_minutes: number | null;
  actual_start: Date | null;
  actual_end: Date | null;
  actual_minutes: number | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Tipos de eventos de tarea (para historial granular)
 */
export type TaskEventType = 'started' | 'paused' | 'resumed' | 'completed' | 'cancelled';

/**
 * Evento de tarea (historial de cambios)
 */
export interface TaskEvent {
  id: string;
  task_id: string;
  event_type: TaskEventType;
  timestamp: Date;
  metadata: Record<string, unknown> | null;
}


// =====================================================
// CATEGORÍAS
// =====================================================

/**
 * Categoría de tareas
 */
export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;  // Formato hex: #FF5733
  icon: string | null;  // Nombre del icono
  created_at: Date;
}


// =====================================================
// METAS (GOALS)
// =====================================================

/**
 * Período de una meta
 */
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

/**
 * Estado de una meta
 */
export type GoalStatus = 'active' | 'completed' | 'failed' | 'paused';

/**
 * Meta del usuario
 */
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;  // Ej: "horas", "tareas", "minutos"
  period: GoalPeriod;
  status: GoalStatus;
  start_date: Date;
  end_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Registro de progreso de una meta
 */
export interface GoalProgress {
  id: string;
  goal_id: string;
  date: Date;
  value: number;
  notes: string | null;
  created_at: Date;
}


// =====================================================
// CHECK-INS
// =====================================================

/**
 * Check-in diario del usuario
 */
export interface CheckIn {
  id: string;
  user_id: string;
  date: Date;
  mood_score: number;      // 1-5
  energy_level: number;    // 1-5
  notes: string | null;
  ai_analysis: AIAnalysis | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Análisis generado por la IA para el check-in
 */
export interface AIAnalysis {
  summary: string;
  highlights: string[];
  areas_for_improvement: string[];
  suggestions: string[];
}


// =====================================================
// RESPUESTA DE LA IA
// =====================================================

/**
 * Estructura de respuesta del agente de IA
 * Esta es la estructura que GPT-5 debe devolver (structured output)
 */
export interface AIResponse {
  text: string;
  ui_components: UIComponent[];
}


// =====================================================
// CONTEXTO PARA LA IA
// =====================================================

/**
 * Contexto que se envía a GPT-5 junto con el mensaje del usuario
 * Esto ayuda a la IA a dar respuestas más relevantes
 */
export interface AIContext {
  user: {
    name: string;
    timezone: string;
  };
  local_time: string;
  local_date: string;
  active_task: Task | null;
  today_tasks: Task[];
  active_goals: Goal[];
  recent_check_in: CheckIn | null;
}


// =====================================================
// CONFIGURACIÓN DE ENTORNO
// =====================================================

/**
 * Variables de entorno tipadas
 */
export interface EnvConfig {
  PORT: number;
  HOST: string;
  NODE_ENV: 'development' | 'production';
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  OPENAI_API_KEY: string;
  OPENAI_MODEL: string;
  DEEPGRAM_API_KEY: string;
  DEEPGRAM_MODEL: string;
  CORS_ORIGIN: string;
}
