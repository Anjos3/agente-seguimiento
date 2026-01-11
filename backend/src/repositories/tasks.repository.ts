/**
 * =====================================================
 * REPOSITORY DE TAREAS
 * =====================================================
 *
 * Acceso a datos para:
 * - Tareas (CRUD + filtros)
 * - Eventos de tareas (historial de timer)
 */

import { query } from '../utils/db.js';
import { Task, TaskEvent, TaskStatus, TaskPriority, TaskEventType } from '../types/index.js';

// =====================================================
// TIPOS INTERNOS
// =====================================================

interface CreateTaskData {
  user_id: string;
  name: string;
  description?: string;
  category_id?: string;
  priority?: TaskPriority;
  scheduled_date?: string;
  estimated_minutes?: number;
}

interface UpdateTaskData {
  name?: string;
  description?: string | null;
  category_id?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  scheduled_date?: string | null;
  estimated_minutes?: number | null;
  actual_start?: Date | null;
  actual_end?: Date | null;
  actual_minutes?: number | null;
}

interface ListTasksFilters {
  user_id: string;
  status?: TaskStatus;
  date?: string;
  category_id?: string;
  priority?: TaskPriority;
  limit?: number;
  offset?: number;
}

// =====================================================
// TAREAS - CRUD
// =====================================================

/**
 * Crea una nueva tarea
 */
export async function create(data: CreateTaskData): Promise<Task> {
  const result = await query<Task>(
    `INSERT INTO tasks (user_id, name, description, category_id, priority, scheduled_date, estimated_minutes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.user_id,
      data.name,
      data.description || null,
      data.category_id || null,
      data.priority || 'medium',
      data.scheduled_date || null,
      data.estimated_minutes || null,
    ]
  );

  return result.rows[0];
}

/**
 * Busca una tarea por ID
 */
export async function findById(id: string): Promise<Task | null> {
  const result = await query<Task>(
    `SELECT * FROM tasks WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Busca una tarea por ID verificando que pertenezca al usuario
 */
export async function findByIdAndUser(
  id: string,
  userId: string
): Promise<Task | null> {
  const result = await query<Task>(
    `SELECT * FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rows[0] || null;
}

/**
 * Actualiza una tarea
 */
export async function update(
  id: string,
  data: UpdateTaskData
): Promise<Task | null> {
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.category_id !== undefined) {
    updates.push(`category_id = $${paramCount++}`);
    values.push(data.category_id);
  }
  if (data.priority !== undefined) {
    updates.push(`priority = $${paramCount++}`);
    values.push(data.priority);
  }
  if (data.status !== undefined) {
    updates.push(`status = $${paramCount++}`);
    values.push(data.status);
  }
  if (data.scheduled_date !== undefined) {
    updates.push(`scheduled_date = $${paramCount++}`);
    values.push(data.scheduled_date);
  }
  if (data.estimated_minutes !== undefined) {
    updates.push(`estimated_minutes = $${paramCount++}`);
    values.push(data.estimated_minutes);
  }
  if (data.actual_start !== undefined) {
    updates.push(`actual_start = $${paramCount++}`);
    values.push(data.actual_start);
  }
  if (data.actual_end !== undefined) {
    updates.push(`actual_end = $${paramCount++}`);
    values.push(data.actual_end);
  }
  if (data.actual_minutes !== undefined) {
    updates.push(`actual_minutes = $${paramCount++}`);
    values.push(data.actual_minutes);
  }

  if (updates.length === 0) {
    return findById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<Task>(
    `UPDATE tasks
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Elimina una tarea
 */
export async function remove(id: string): Promise<boolean> {
  const result = await query(
    `DELETE FROM tasks WHERE id = $1`,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

/**
 * Lista tareas con filtros
 */
export async function list(filters: ListTasksFilters): Promise<Task[]> {
  const conditions: string[] = ['user_id = $1'];
  const values: unknown[] = [filters.user_id];
  let paramCount = 2;

  if (filters.status) {
    conditions.push(`status = $${paramCount++}`);
    values.push(filters.status);
  }
  if (filters.date) {
    conditions.push(`scheduled_date = $${paramCount++}`);
    values.push(filters.date);
  }
  if (filters.category_id) {
    conditions.push(`category_id = $${paramCount++}`);
    values.push(filters.category_id);
  }
  if (filters.priority) {
    conditions.push(`priority = $${paramCount++}`);
    values.push(filters.priority);
  }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE ${conditions.join(' AND ')}
     ORDER BY
       CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
       scheduled_date ASC NULLS LAST,
       created_at DESC
     LIMIT $${paramCount++} OFFSET $${paramCount}`,
    [...values, limit, offset]
  );

  return result.rows;
}

// =====================================================
// TAREAS - CONSULTAS ESPECIALES
// =====================================================

/**
 * Obtiene la tarea activa (en progreso) del usuario
 */
export async function getActiveTask(userId: string): Promise<Task | null> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE user_id = $1 AND status = 'in_progress'
     ORDER BY actual_start DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Obtiene las tareas de hoy
 */
export async function getTodayTasks(userId: string): Promise<Task[]> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE user_id = $1
       AND (
         scheduled_date = CURRENT_DATE
         OR (actual_start IS NOT NULL AND DATE(actual_start) = CURRENT_DATE)
         OR status = 'in_progress'
       )
     ORDER BY
       CASE WHEN status = 'in_progress' THEN 0 ELSE 1 END,
       actual_start DESC NULLS LAST,
       created_at DESC`,
    [userId]
  );

  return result.rows;
}

/**
 * Cuenta tareas por estado para un usuario
 */
export async function countByStatus(
  userId: string,
  date?: string
): Promise<Record<TaskStatus, number>> {
  const dateCondition = date
    ? `AND (scheduled_date = $2 OR DATE(actual_start) = $2)`
    : '';

  const params = date ? [userId, date] : [userId];

  const result = await query<{ status: TaskStatus; count: string }>(
    `SELECT status, COUNT(*) as count
     FROM tasks
     WHERE user_id = $1 ${dateCondition}
     GROUP BY status`,
    params
  );

  const counts: Record<TaskStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of result.rows) {
    counts[row.status] = parseInt(row.count, 10);
  }

  return counts;
}

// =====================================================
// EVENTOS DE TAREAS
// =====================================================

/**
 * Crea un evento de tarea
 */
export async function createEvent(
  taskId: string,
  eventType: TaskEventType,
  metadata?: Record<string, unknown>
): Promise<TaskEvent> {
  const result = await query<TaskEvent>(
    `INSERT INTO task_events (task_id, event_type, metadata)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [taskId, eventType, metadata ? JSON.stringify(metadata) : null]
  );

  return result.rows[0];
}

/**
 * Obtiene eventos de una tarea
 */
export async function getEvents(taskId: string): Promise<TaskEvent[]> {
  const result = await query<TaskEvent>(
    `SELECT * FROM task_events
     WHERE task_id = $1
     ORDER BY timestamp ASC`,
    [taskId]
  );

  return result.rows;
}

/**
 * Obtiene el último evento de una tarea
 */
export async function getLastEvent(taskId: string): Promise<TaskEvent | null> {
  const result = await query<TaskEvent>(
    `SELECT * FROM task_events
     WHERE task_id = $1
     ORDER BY timestamp DESC
     LIMIT 1`,
    [taskId]
  );

  return result.rows[0] || null;
}

/**
 * Busca tareas pendientes por nombre (búsqueda parcial)
 */
export async function findPendingByName(
  userId: string,
  name: string
): Promise<Task | null> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE user_id = $1
       AND status = 'pending'
       AND LOWER(name) LIKE LOWER($2)
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, `%${name}%`]
  );

  return result.rows[0] || null;
}

/**
 * Obtiene la última tarea pendiente del usuario
 */
export async function getLastPendingTask(userId: string): Promise<Task | null> {
  const result = await query<Task>(
    `SELECT * FROM tasks
     WHERE user_id = $1 AND status = 'pending'
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

/**
 * Calcula el tiempo total trabajado en una tarea
 * Suma los intervalos entre started/resumed y paused/completed
 */
export async function calculateTotalMinutes(taskId: string): Promise<number> {
  const events = await getEvents(taskId);

  let totalMs = 0;
  let lastStart: Date | null = null;

  for (const event of events) {
    if (event.event_type === 'started' || event.event_type === 'resumed') {
      lastStart = new Date(event.timestamp);
    } else if (
      (event.event_type === 'paused' || event.event_type === 'completed') &&
      lastStart
    ) {
      const end = new Date(event.timestamp);
      totalMs += end.getTime() - lastStart.getTime();
      lastStart = null;
    }
  }

  // Si hay un start sin cierre, contar hasta ahora
  if (lastStart) {
    totalMs += Date.now() - lastStart.getTime();
  }

  return Math.round(totalMs / 60000); // Convertir a minutos
}
