/**
 * =====================================================
 * RUTAS DE TAREAS
 * =====================================================
 *
 * Endpoints:
 * - GET    /api/v1/tasks            - Listar tareas (con filtros)
 * - POST   /api/v1/tasks            - Crear tarea
 * - GET    /api/v1/tasks/:id        - Obtener tarea por ID
 * - PUT    /api/v1/tasks/:id        - Actualizar tarea
 * - DELETE /api/v1/tasks/:id        - Eliminar tarea
 * - POST   /api/v1/tasks/:id/start  - Iniciar timer
 * - POST   /api/v1/tasks/:id/pause  - Pausar timer
 * - POST   /api/v1/tasks/:id/complete - Completar tarea
 *
 * TODAS estas rutas requieren autenticación
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Plugin de rutas de tareas
 * Se registra en app.ts con prefix '/api/v1/tasks'
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
   *
   * Query: {
   *   status?: 'pending' | 'in_progress' | 'completed' | 'cancelled',
   *   date?: string (YYYY-MM-DD),
   *   category_id?: string,
   *   limit?: number,
   *   offset?: number
   * }
   *
   * Response: { success, data: { tasks: Task[], total: number } }
   */
  app.get('/', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/tasks
   * Crea una nueva tarea
   *
   * Body: {
   *   name: string,
   *   description?: string,
   *   category_id?: string,
   *   priority?: 'low' | 'medium' | 'high',
   *   scheduled_date?: string,
   *   estimated_minutes?: number,
   *   start_now?: boolean  // Si true, inicia el timer inmediatamente
   * }
   *
   * Response: { success, data: { task: Task } }
   */
  app.post('/', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * GET /api/v1/tasks/:id
   * Obtiene una tarea por su ID
   *
   * Params: { id: string }
   * Response: { success, data: { task: Task, events: TaskEvent[] } }
   */
  app.get('/:id', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/tasks/:id/start
   * Inicia el timer de una tarea
   *
   * Params: { id: string }
   * Response: { success, data: { task: Task, event: TaskEvent } }
   */
  app.post('/:id/start', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/tasks/:id/pause
   * Pausa el timer de una tarea
   *
   * Params: { id: string }
   * Response: { success, data: { task: Task, event: TaskEvent } }
   */
  app.post('/:id/pause', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/tasks/:id/complete
   * Marca una tarea como completada y detiene el timer
   *
   * Params: { id: string }
   * Body: { notes?: string }
   * Response: { success, data: { task: Task, event: TaskEvent } }
   */
  app.post('/:id/complete', async (request, reply) => {
    // TODO: Implementar después del schema de DB
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });
}

export default taskRoutes;
