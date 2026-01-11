/**
 * =====================================================
 * EJECUTOR DE TOOLS
 * =====================================================
 *
 * Cuando OpenAI decide usar un tool, retorna:
 * {
 *   tool_calls: [{
 *     id: "call_abc123",
 *     function: { name: "create_task", arguments: '{"name":"Reunión"}' }
 *   }]
 * }
 *
 * Este módulo:
 * 1. Recibe el tool_call de OpenAI
 * 2. Parsea los argumentos (JSON string → objeto)
 * 3. Ejecuta la función correspondiente (llama al servicio real)
 * 4. Retorna el resultado para que OpenAI genere la respuesta final
 */

import { ToolName, ToolArguments } from './tools.js';
import * as tasksService from '../tasks/tasks.service.js';
import * as tasksRepo from '../../repositories/tasks.repository.js';

// =====================================================
// TIPOS
// =====================================================

/**
 * Resultado de ejecutar un tool
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * Contexto necesario para ejecutar tools
 */
export interface ToolContext {
  userId: string;
}

// =====================================================
// EJECUTOR PRINCIPAL
// =====================================================

/**
 * Ejecuta un tool y retorna el resultado
 *
 * @param toolName - Nombre del tool a ejecutar
 * @param args - Argumentos parseados del tool
 * @param context - Contexto con userId
 * @returns Resultado de la ejecución
 */
export async function executeTool(
  toolName: ToolName,
  args: unknown,
  context: ToolContext
): Promise<ToolResult> {
  const { userId } = context;

  try {
    switch (toolName) {
      // =================================================
      // CREAR TAREA
      // =================================================
      case 'create_task': {
        const { name, description, estimatedMinutes, priority, startNow } =
          args as ToolArguments['create_task'];

        const result = await tasksService.createTask(userId, {
          name,
          description,
          estimatedMinutes,
          priority,
          startNow,
        });

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return {
          success: true,
          data: {
            task: result.data,
            message: startNow
              ? `Tarea "${name}" creada y timer iniciado`
              : `Tarea "${name}" creada`,
          },
        };
      }

      // =================================================
      // COMPLETAR TAREA
      // =================================================
      case 'complete_task': {
        const { taskId } = args as ToolArguments['complete_task'];

        const result = await tasksService.completeTask(userId, taskId);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        const task = result.data;
        const minutes = task.actual_minutes || 0;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        return {
          success: true,
          data: {
            task,
            duration: { hours, minutes: mins, totalMinutes: minutes },
            message: `Tarea "${task.name}" completada en ${hours > 0 ? `${hours}h ` : ''}${mins}min`,
          },
        };
      }

      // =================================================
      // PAUSAR TAREA
      // =================================================
      case 'pause_task': {
        const { taskId } = args as ToolArguments['pause_task'];

        // Si no hay taskId, buscar la activa
        let targetId = taskId;
        if (!targetId) {
          const activeTask = await tasksService.getActiveTask(userId);
          if (!activeTask) {
            return { success: false, error: 'No hay tarea activa para pausar' };
          }
          targetId = activeTask.id;
        }

        const result = await tasksService.pauseTask(userId, targetId);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return {
          success: true,
          data: {
            task: result.data,
            message: `Timer pausado para "${result.data.name}"`,
          },
        };
      }

      // =================================================
      // INICIAR TAREA
      // =================================================
      case 'start_task': {
        const { taskId } = args as ToolArguments['start_task'];

        const result = await tasksService.startTask(userId, taskId);

        if (!result.success) {
          return { success: false, error: result.error.message };
        }

        return {
          success: true,
          data: {
            task: result.data,
            message: `Timer iniciado para "${result.data.name}"`,
          },
        };
      }

      // =================================================
      // OBTENER TAREAS DE HOY
      // =================================================
      case 'get_today_tasks': {
        const tasks = await tasksService.getTodayTasks(userId);
        const stats = await tasksService.getStats(userId);

        const completed = tasks.filter((t) => t.status === 'completed');
        const pending = tasks.filter((t) => t.status === 'pending');
        const inProgress = tasks.filter((t) => t.status === 'in_progress');

        return {
          success: true,
          data: {
            tasks,
            summary: {
              total: tasks.length,
              completed: completed.length,
              pending: pending.length,
              inProgress: inProgress.length,
              totalMinutes: stats.totalMinutesToday,
            },
          },
        };
      }

      // =================================================
      // OBTENER TAREA ACTIVA
      // =================================================
      case 'get_active_task': {
        const task = await tasksService.getActiveTask(userId);

        if (!task) {
          return {
            success: true,
            data: {
              task: null,
              message: 'No hay ninguna tarea activa en este momento',
            },
          };
        }

        // Calcular tiempo transcurrido
        const currentMinutes = await tasksRepo.calculateTotalMinutes(task.id);

        return {
          success: true,
          data: {
            task,
            currentMinutes,
            message: `Estás trabajando en "${task.name}" (${currentMinutes} min)`,
          },
        };
      }

      // =================================================
      // OBTENER ESTADÍSTICAS
      // =================================================
      case 'get_time_stats': {
        const { date } = args as ToolArguments['get_time_stats'];

        const stats = await tasksService.getStats(userId, date);

        const hours = Math.floor(stats.totalMinutesToday / 60);
        const mins = stats.totalMinutesToday % 60;

        return {
          success: true,
          data: {
            stats: {
              ...stats,
              formattedTime: `${hours}h ${mins}min`,
            },
            message: `Hoy trabajaste ${hours}h ${mins}min con ${stats.counts.completed} tareas completadas`,
          },
        };
      }

      // =================================================
      // TOOL NO RECONOCIDO
      // =================================================
      default:
        return {
          success: false,
          error: `Tool "${toolName}" no reconocido`,
        };
    }
  } catch (error) {
    console.error(`❌ Error ejecutando tool ${toolName}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    };
  }
}

/**
 * Parsea los argumentos de un tool call de OpenAI
 */
export function parseToolArguments(argsString: string): unknown {
  try {
    return JSON.parse(argsString);
  } catch {
    return {};
  }
}
