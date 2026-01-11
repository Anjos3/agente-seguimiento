/**
 * =====================================================
 * SERVICIO DE TAREAS
 * =====================================================
 *
 * Lógica de negocio para tareas:
 * - CRUD con validaciones
 * - Sistema de timer (start/pause/complete)
 * - Cálculo de tiempo trabajado
 */

import * as tasksRepo from '../../repositories/tasks.repository.js';
import { Task, TaskStatus } from '../../types/index.js';
import { CreateTaskInput, UpdateTaskInput } from '../../schemas/tasks.schema.js';

// =====================================================
// TIPOS
// =====================================================

interface ServiceResult<T> {
  success: true;
  data: T;
}

interface ServiceError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

type Result<T> = ServiceResult<T> | ServiceError;

// =====================================================
// CRUD BÁSICO
// =====================================================

/**
 * Crea una nueva tarea
 * Opcionalmente inicia el timer inmediatamente
 */
export async function createTask(
  userId: string,
  input: CreateTaskInput
): Promise<Result<Task>> {
  // Crear la tarea
  let task = await tasksRepo.create({
    user_id: userId,
    name: input.name,
    description: input.description,
    category_id: input.categoryId,
    priority: input.priority,
    scheduled_date: input.scheduledDate,
    estimated_minutes: input.estimatedMinutes,
  });

  // Si se solicita iniciar inmediatamente
  if (input.startNow) {
    const startResult = await startTask(userId, task.id);
    if (startResult.success) {
      task = startResult.data;
    }
  }

  return { success: true, data: task };
}

/**
 * Obtiene una tarea por ID
 */
export async function getTask(
  userId: string,
  taskId: string
): Promise<Result<Task>> {
  const task = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  return { success: true, data: task };
}

/**
 * Actualiza una tarea
 */
export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<Result<Task>> {
  // Verificar que existe y pertenece al usuario
  const existing = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!existing) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  // No permitir modificar tareas completadas o canceladas
  if (existing.status === 'completed' || existing.status === 'cancelled') {
    return {
      success: false,
      error: {
        code: 'TASK_CLOSED',
        message: 'No se puede modificar una tarea cerrada',
      },
    };
  }

  const updated = await tasksRepo.update(taskId, {
    name: input.name,
    description: input.description,
    category_id: input.categoryId,
    priority: input.priority,
    scheduled_date: input.scheduledDate,
    estimated_minutes: input.estimatedMinutes,
  });

  return { success: true, data: updated! };
}

/**
 * Elimina una tarea
 */
export async function deleteTask(
  userId: string,
  taskId: string
): Promise<Result<{ deleted: boolean }>> {
  const existing = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!existing) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  // No permitir eliminar tareas en progreso
  if (existing.status === 'in_progress') {
    return {
      success: false,
      error: {
        code: 'TASK_IN_PROGRESS',
        message: 'Pausa o completa la tarea antes de eliminarla',
      },
    };
  }

  await tasksRepo.remove(taskId);

  return { success: true, data: { deleted: true } };
}

// =====================================================
// SISTEMA DE TIMER
// =====================================================

/**
 * Inicia el timer de una tarea
 */
export async function startTask(
  userId: string,
  taskId: string
): Promise<Result<Task>> {
  // Verificar que la tarea existe
  const task = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  // Verificar que no esté ya en progreso, completada o cancelada
  if (task.status === 'in_progress') {
    return {
      success: false,
      error: {
        code: 'ALREADY_IN_PROGRESS',
        message: 'La tarea ya está en progreso',
      },
    };
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    return {
      success: false,
      error: {
        code: 'TASK_CLOSED',
        message: 'No se puede iniciar una tarea cerrada',
      },
    };
  }

  // Verificar que no haya otra tarea en progreso
  const activeTask = await tasksRepo.getActiveTask(userId);

  if (activeTask && activeTask.id !== taskId) {
    return {
      success: false,
      error: {
        code: 'ANOTHER_TASK_ACTIVE',
        message: `Ya tienes una tarea activa: "${activeTask.name}"`,
      },
    };
  }

  // Determinar tipo de evento
  const isResume = task.actual_start !== null;
  const eventType = isResume ? 'resumed' : 'started';

  // Crear evento
  await tasksRepo.createEvent(taskId, eventType);

  // Actualizar tarea
  const now = new Date();
  const updated = await tasksRepo.update(taskId, {
    status: 'in_progress',
    actual_start: task.actual_start || now,
  });

  return { success: true, data: updated! };
}

/**
 * Pausa el timer de una tarea
 */
export async function pauseTask(
  userId: string,
  taskId: string
): Promise<Result<Task>> {
  const task = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  if (task.status !== 'in_progress') {
    return {
      success: false,
      error: {
        code: 'NOT_IN_PROGRESS',
        message: 'La tarea no está en progreso',
      },
    };
  }

  // Crear evento de pausa
  await tasksRepo.createEvent(taskId, 'paused');

  // Calcular tiempo total hasta ahora
  const totalMinutes = await tasksRepo.calculateTotalMinutes(taskId);

  // Actualizar tarea
  const updated = await tasksRepo.update(taskId, {
    status: 'pending',
    actual_minutes: totalMinutes,
  });

  return { success: true, data: updated! };
}

/**
 * Completa una tarea
 */
export async function completeTask(
  userId: string,
  taskId?: string
): Promise<Result<Task>> {
  // Si no se proporciona ID, buscar la tarea activa
  let task: Task | null;

  if (taskId) {
    task = await tasksRepo.findByIdAndUser(taskId, userId);
  } else {
    task = await tasksRepo.getActiveTask(userId);
  }

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: taskId
          ? 'Tarea no encontrada'
          : 'No hay ninguna tarea activa',
      },
    };
  }

  if (task.status === 'completed') {
    return {
      success: false,
      error: {
        code: 'ALREADY_COMPLETED',
        message: 'La tarea ya está completada',
      },
    };
  }

  if (task.status === 'cancelled') {
    return {
      success: false,
      error: {
        code: 'TASK_CANCELLED',
        message: 'No se puede completar una tarea cancelada',
      },
    };
  }

  // Crear evento de completado
  await tasksRepo.createEvent(task.id, 'completed');

  // Calcular tiempo total
  const totalMinutes = await tasksRepo.calculateTotalMinutes(task.id);

  // Actualizar tarea
  const updated = await tasksRepo.update(task.id, {
    status: 'completed',
    actual_end: new Date(),
    actual_minutes: totalMinutes,
  });

  return { success: true, data: updated! };
}

/**
 * Cancela una tarea
 */
export async function cancelTask(
  userId: string,
  taskId: string
): Promise<Result<Task>> {
  const task = await tasksRepo.findByIdAndUser(taskId, userId);

  if (!task) {
    return {
      success: false,
      error: {
        code: 'TASK_NOT_FOUND',
        message: 'Tarea no encontrada',
      },
    };
  }

  if (task.status === 'completed' || task.status === 'cancelled') {
    return {
      success: false,
      error: {
        code: 'TASK_CLOSED',
        message: 'La tarea ya está cerrada',
      },
    };
  }

  // Crear evento
  await tasksRepo.createEvent(taskId, 'cancelled');

  // Calcular tiempo si había trabajo
  const totalMinutes = task.actual_start
    ? await tasksRepo.calculateTotalMinutes(taskId)
    : 0;

  // Actualizar tarea
  const updated = await tasksRepo.update(taskId, {
    status: 'cancelled',
    actual_end: new Date(),
    actual_minutes: totalMinutes,
  });

  return { success: true, data: updated! };
}

// =====================================================
// CONSULTAS
// =====================================================

/**
 * Obtiene la tarea activa del usuario
 */
export async function getActiveTask(userId: string): Promise<Task | null> {
  return tasksRepo.getActiveTask(userId);
}

/**
 * Obtiene las tareas de hoy
 */
export async function getTodayTasks(userId: string): Promise<Task[]> {
  return tasksRepo.getTodayTasks(userId);
}

/**
 * Obtiene estadísticas de tareas
 */
export async function getStats(
  userId: string,
  date?: string
): Promise<{
  counts: Record<TaskStatus, number>;
  totalMinutesToday: number;
}> {
  const counts = await tasksRepo.countByStatus(userId, date);

  // Calcular tiempo total del día
  const todayTasks = await tasksRepo.getTodayTasks(userId);
  const totalMinutesToday = todayTasks.reduce(
    (acc, task) => acc + (task.actual_minutes || 0),
    0
  );

  return { counts, totalMinutesToday };
}
