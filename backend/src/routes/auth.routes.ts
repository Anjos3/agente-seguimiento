/**
 * =====================================================
 * RUTAS DE AUTENTICACIÓN
 * =====================================================
 *
 * Endpoints:
 * - POST /api/v1/auth/register - Registrar nuevo usuario
 * - POST /api/v1/auth/login    - Iniciar sesión
 * - GET  /api/v1/auth/me       - Obtener usuario actual
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import {
  registerSchema,
  loginSchema,
  validateSchema,
  formatZodErrors,
} from '../schemas/auth.schema.js';
import * as authService from '../services/auth/auth.service.js';

/**
 * Plugin de rutas de autenticación
 */
async function authRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  /**
   * POST /api/v1/auth/register
   * Registra un nuevo usuario
   */
  app.post('/register', async (request, reply) => {
    // Validar input
    const validation = validateSchema(registerSchema, request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    // Registrar usuario
    const result = await authService.register(app, validation.data);

    if (!result.success) {
      const statusCode = result.error.code === 'EMAIL_EXISTS' ? 409 : 400;
      return reply.status(statusCode).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
        field: result.error.field,
      });
    }

    return reply.status(201).send({
      success: true,
      data: result.data,
      message: 'Usuario registrado exitosamente',
    });
  });

  /**
   * POST /api/v1/auth/login
   * Inicia sesión y retorna un JWT
   */
  app.post('/login', async (request, reply) => {
    // Validar input
    const validation = validateSchema(loginSchema, request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    // Intentar login
    const result = await authService.login(app, validation.data);

    if (!result.success) {
      return reply.status(401).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: result.data,
      message: 'Sesión iniciada exitosamente',
    });
  });

  /**
   * GET /api/v1/auth/me
   * Retorna el usuario autenticado actual
   */
  app.get(
    '/me',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const user = await authService.getCurrentUser(userId);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND',
        });
      }

      return reply.send({
        success: true,
        data: { user },
      });
    }
  );
}

export default authRoutes;
