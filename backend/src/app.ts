/**
 * =====================================================
 * CONFIGURACIÓN DE LA APLICACIÓN FASTIFY
 * =====================================================
 *
 * Este archivo configura el servidor Fastify con todos sus plugins:
 * - CORS: Permite requests desde la app móvil
 * - JWT: Autenticación con tokens
 * - WebSocket: Para streaming de voz
 * - Routes: Rutas de la API
 *
 * Fastify es como Express pero:
 * - ~2x más rápido
 * - Mejor soporte para async/await
 * - Validación de schemas integrada
 * - Mejor manejo de errores
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { env } from './utils/env.js';
import { JWTPayload } from './types/index.js';

// Importar rutas (las crearemos después)
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import taskRoutes from './routes/tasks.routes.js';

/**
 * Crea y configura la instancia de Fastify
 *
 * @returns Instancia de Fastify configurada
 */
export async function buildApp(): Promise<FastifyInstance> {
  // Crear instancia de Fastify
  const app = Fastify({
    // Logger: muestra requests en consola
    logger: {
      level: env.isDevelopment ? 'info' : 'warn',
      transport: env.isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // =====================================================
  // PLUGIN: CORS
  // =====================================================
  // Permite que la app móvil haga requests al servidor
  // Sin esto, el navegador/app bloquearía las requests
  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // =====================================================
  // PLUGIN: JWT
  // =====================================================
  // Maneja autenticación con JSON Web Tokens
  await app.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  // =====================================================
  // PLUGIN: WEBSOCKET
  // =====================================================
  // Para streaming de voz en tiempo real
  await app.register(websocket, {
    options: {
      maxPayload: 1048576, // 1MB max por mensaje
    },
  });

  // =====================================================
  // DECORADORES
  // =====================================================
  // Añadimos métodos útiles a request/reply

  /**
   * Decorador: authenticate
   * Middleware que verifica el JWT y añade el usuario al request
   *
   * Uso en rutas:
   * ```typescript
   * app.get('/protected', { preHandler: [app.authenticate] }, handler)
   * ```
   */
  app.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        // Verifica el token y decodifica el payload
        const decoded = await request.jwtVerify<JWTPayload>();
        // El payload queda disponible en request.user
        request.user = decoded;
      } catch (err) {
        reply.status(401).send({
          success: false,
          error: 'Token inválido o expirado',
          code: 'UNAUTHORIZED',
        });
      }
    }
  );

  // =====================================================
  // HOOKS GLOBALES
  // =====================================================

  /**
   * Hook: onRequest
   * Se ejecuta en cada request (útil para logging)
   */
  app.addHook('onRequest', async (request) => {
    // Añadir timestamp para medir duración
    request.startTime = Date.now();
  });

  /**
   * Hook: onResponse
   * Se ejecuta después de enviar la respuesta
   */
  app.addHook('onResponse', async (request, reply) => {
    const duration = Date.now() - (request.startTime || Date.now());
    if (env.isDevelopment) {
      console.log(
        `📨 ${request.method} ${request.url} → ${reply.statusCode} (${duration}ms)`
      );
    }
  });

  // =====================================================
  // MANEJO DE ERRORES GLOBAL
  // =====================================================
  app.setErrorHandler((error, request, reply) => {
    console.error('❌ Error:', {
      message: error.message,
      url: request.url,
      method: request.method,
      stack: env.isDevelopment ? error.stack : undefined,
    });

    // Errores de validación de Fastify
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: error.validation,
      });
    }

    // Error genérico
    return reply.status(error.statusCode || 500).send({
      success: false,
      error: env.isProduction ? 'Error interno del servidor' : error.message,
      code: error.code || 'INTERNAL_ERROR',
    });
  });

  // =====================================================
  // RUTAS
  // =====================================================

  // Ruta de salud (health check)
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  }));

  // Registrar rutas de la API
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(chatRoutes, { prefix: '/api/v1/chat' });
  await app.register(taskRoutes, { prefix: '/api/v1/tasks' });

  return app;
}

// =====================================================
// TIPOS EXTENDIDOS
// =====================================================
// Extendemos los tipos de Fastify para incluir nuestros decoradores

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    startTime?: number;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string };
    user: { userId: string; email: string };
  }
}
