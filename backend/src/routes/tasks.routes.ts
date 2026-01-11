/**
 * =====================================================
 * RUTAS DE TAREAS
 * =====================================================
 *
 * Endpoints:
 * - GET    /api/v1/tasks              - Listar tareas (con filtros)
 * - POST   /api/v1/tasks              - Crear tarea
 * - GET    /api/v1/tasks/active       - Obtener tarea activa
 * - GET    /api/v1/tasks/today        - Obtener tareas de hoy
 * - GET    /api/v1/tasks/:id          - Obtener tarea por ID
 * - PUT    /api/v1/tasks/:id          - Actualizar tarea
 * - DELETE /api/v1/tasks/:id          - Eliminar tarea
 * - POST   /api/v1/tasks/:id/start    - Iniciar timer
 * - POST   /api/v1/tasks/:id/pause    - Pausar timer
 * - POST   /api/v1/tasks/:id/complete - Completar tarea
 *
 * TODAS estas rutas requieren autenticación
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksSchema,
  taskIdSchema,
} from '../schemas/tasks.schema.js';
import { validateSchema, formatZodErrors } from '../schemas/auth.schema.js';
import * as tasksService from '../services/tasks/tasks.service.js';
import * as tasksRepo from '../repositories/tasks.repository.js';

/**
 * Plugin de rutas de tareas
 */
async function taskRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // Todas las rutas de tareas requieren autenticación
  app.addHook('preHandler', app.authenticate);

  /**
   * GET /api/v1/tasks
   * Lista tareas del usuario con filtros opcionales
   */
  app.get('/', async (request, reply) => {
    const userId = request.user!.userId;

    const validation = validateSchema(listTasksSchema, request.query);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Parámetros inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const { status, date, categoryId, priority, limit, offset } = validation.data;

    const tasks = await tasksRepo.list({
      user_id: userId,
      status,
      date,
      category_id: categoryId,
      priority,
      limit,
      offset,
    });

    return reply.send({
      success: true,
      data: { tasks },
    });
  });

  /**
   * GET /api/v1/tasks/active
   * Obtiene la tarea actualmente en progreso
   */
  app.get('/active', async (request, reply) => {
    const userId = request.user!.userId;

    const task = await tasksService.getActiveTask(userId);

    return reply.send({
      success: true,
      data: { task },
    });
  });

  /**
   * GET /api/v1/tasks/today
   * Obtiene las tareas de hoy con estadísticas
   */
  app.get('/today', async (request, reply) => {
    const userId = request.user!.userId;

    const tasks = await tasksService.getTodayTasks(userId);
    const stats = await tasksService.getStats(userId);

    return reply.send({
      success: true,
      data: {
        tasks,
        stats: {
          completed: stats.counts.completed,
          pending: stats.counts.pending,
          in_progress: stats.counts.in_progress,
          total_minutes: stats.totalMinutesToday,
        },
      },
    });
  });

  /**
   * POST /api/v1/tasks
   * Crea una nueva tarea
   */
  app.post('/', async (request, reply) => {
    const userId = request.user!.userId;

    const validation = validateSchema(createTaskSchema, request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const result = await tasksService.createTask(userId, validation.data);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.status(201).send({
      success: true,
      data: { task: result.data },
    });
  });

  /**
   * GET /api/v1/tasks/:id
   * Obtiene una tarea por su ID con historial de eventos
   */
  app.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const validation = validateSchema(taskIdSchema, { id });

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'ID de tarea inválido',
        code: 'VALIDATION_ERROR',
      });
    }

    const result = await tasksService.getTask(userId, id);

    if (!result.success) {
      return reply.status(404).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    // Obtener eventos de la tarea
    const events = await tasksRepo.getEvents(id);

    return reply.send({
      success: true,
      data: {
        task: result.data,
        events,
      },
    });
  });

  /**
   * PUT /api/v1/tasks/:id
   * Actualiza una tarea
   */
  app.put<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const idValidation = validateSchema(taskIdSchema, { id });
    if (!idValidation.success) {
      return reply.status(400).send({
        success: false,
        error: 'ID de tarea inválido',
        code: 'VALIDATION_ERROR',
      });
    }

    const bodyValidation = validateSchema(updateTaskSchema, request.body);
    if (!bodyValidation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(bodyValidation.errors),
      });
    }

    const result = await tasksService.updateTask(userId, id, bodyValidation.data);

    if (!result.success) {
      const statusCode = result.error.code === 'TASK_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: { task: result.data },
    });
  });

  /**
   * DELETE /api/v1/tasks/:id
   * Elimina una tarea
   */
  app.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await tasksService.deleteTask(userId, id);

    if (!result.success) {
      const statusCode = result.error.code === 'TASK_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      message: 'Tarea eliminada',
    });
  });

  /**
   * POST /api/v1/tasks/:id/start
   * Inicia el timer de una tarea
   */
  app.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await tasksService.startTask(userId, id);

    if (!result.success) {
      const statusCode = result.error.code === 'TASK_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: { task: result.data },
      message: 'Timer iniciado',
    });
  });

  /**
   * POST /api/v1/tasks/:id/pause
   * Pausa el timer de una tarea
   */
  app.post<{ Params: { id: string } }>('/:id/pause', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await tasksService.pauseTask(userId, id);

    if (!result.success) {
      const statusCode = result.error.code === 'TASK_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: { task: result.data },
      message: 'Timer pausado',
    });
  });

  /**
   * POST /api/v1/tasks/:id/complete
   * Marca una tarea como completada
   */
  app.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
    const userId = request.user!.userId;
    const { id } = request.params;

    const result = await tasksService.completeTask(userId, id);

    if (!result.success) {
      const statusCode = result.error.code === 'TASK_NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: { task: result.data },
      message: 'Tarea completada',
    });
  });

  /**
   * POST /api/v1/tasks/complete-active
   * Completa la tarea activa (sin necesidad de ID)
   */
  app.post('/complete-active', async (request, reply) => {
    const userId = request.user!.userId;

    const result = await tasksService.completeTask(userId);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: { task: result.data },
      message: 'Tarea completada',
    });
  });
}

export default taskRoutes;
