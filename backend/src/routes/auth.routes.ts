/**
 * =====================================================
 * RUTAS DE AUTENTICACIÓN
 * =====================================================
 *
 * Endpoints:
 * - POST /api/v1/auth/register - Registrar nuevo usuario
 * - POST /api/v1/auth/login    - Iniciar sesión
 * - POST /api/v1/auth/refresh  - Renovar token
 * - GET  /api/v1/auth/me       - Obtener usuario actual
 *
 * Estas rutas NO requieren autenticación (excepto /me)
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Plugin de rutas de autenticación
 * Se registra en app.ts con prefix '/api/v1/auth'
 */
async function authRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/auth/register
   * Registra un nuevo usuario
   *
   * Body: { email, password, name }
   * Response: { success, data: { user, token } }
   */
  app.post('/register', async (request, reply) => {
    // TODO: Implementar en el paso 4
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/auth/login
   * Inicia sesión y retorna un JWT
   *
   * Body: { email, password }
   * Response: { success, data: { user, token } }
   */
  app.post('/login', async (request, reply) => {
    // TODO: Implementar en el paso 4
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * GET /api/v1/auth/me
   * Retorna el usuario autenticado actual
   *
   * Headers: Authorization: Bearer <token>
   * Response: { success, data: { user } }
   */
  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      // TODO: Implementar en el paso 4
      return reply.status(501).send({
        success: false,
        error: 'Endpoint no implementado aún',
        code: 'NOT_IMPLEMENTED',
      });
    }
  );
}

export default authRoutes;
