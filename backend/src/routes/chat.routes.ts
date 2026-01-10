/**
 * =====================================================
 * RUTAS DE CHAT
 * =====================================================
 *
 * Endpoints:
 * - POST /api/v1/chat/message           - Enviar mensaje (principal)
 * - GET  /api/v1/chat/conversations     - Listar conversaciones
 * - GET  /api/v1/chat/conversations/:id - Obtener conversación con mensajes
 * - POST /api/v1/chat/conversations     - Crear nueva conversación
 *
 * TODAS estas rutas requieren autenticación
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';

/**
 * Plugin de rutas de chat
 * Se registra en app.ts con prefix '/api/v1/chat'
 */
async function chatRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
): Promise<void> {
  // Todas las rutas de chat requieren autenticación
  app.addHook('preHandler', app.authenticate);

  /**
   * POST /api/v1/chat/message
   * Envía un mensaje al asistente de IA y recibe respuesta
   *
   * Este es el endpoint PRINCIPAL de la aplicación.
   *
   * Body: {
   *   conversation_id?: string,  // Si no se envía, crea nueva conversación
   *   content: string,           // Texto del mensaje
   *   is_voice?: boolean         // Si viene de entrada de voz
   * }
   *
   * Response: {
   *   success: true,
   *   data: {
   *     message: {
   *       id: string,
   *       role: 'assistant',
   *       content: string,
   *       ui_components: UIComponent[]
   *     },
   *     conversation_id: string
   *   }
   * }
   */
  app.post('/message', async (request, reply) => {
    // TODO: Implementar en el paso 5
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * GET /api/v1/chat/conversations
   * Lista todas las conversaciones del usuario
   *
   * Query: { limit?: number, offset?: number }
   * Response: { success, data: { conversations: Conversation[] } }
   */
  app.get('/conversations', async (request, reply) => {
    // TODO: Implementar en el paso 5
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * GET /api/v1/chat/conversations/:id
   * Obtiene una conversación con todos sus mensajes
   *
   * Params: { id: string }
   * Response: { success, data: { conversation, messages: Message[] } }
   */
  app.get('/conversations/:id', async (request, reply) => {
    // TODO: Implementar en el paso 5
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });

  /**
   * POST /api/v1/chat/conversations
   * Crea una nueva conversación
   *
   * Body: { title?: string }
   * Response: { success, data: { conversation: Conversation } }
   */
  app.post('/conversations', async (request, reply) => {
    // TODO: Implementar en el paso 5
    return reply.status(501).send({
      success: false,
      error: 'Endpoint no implementado aún',
      code: 'NOT_IMPLEMENTED',
    });
  });
}

export default chatRoutes;
