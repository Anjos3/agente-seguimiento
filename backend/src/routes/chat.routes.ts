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
import {
  sendMessageSchema,
  listConversationsSchema,
  getConversationMessagesSchema,
  createConversationSchema,
} from '../schemas/chat.schema.js';
import { validateSchema, formatZodErrors } from '../schemas/auth.schema.js';
import * as messagesRepo from '../repositories/messages.repository.js';
import * as aiService from '../services/ai/ai.service.js';

/**
 * Plugin de rutas de chat
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
   */
  app.post('/message', async (request, reply) => {
    const userId = request.user!.userId;

    // Validar input
    const validation = validateSchema(sendMessageSchema, request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const { conversationId, content, isVoice } = validation.data;

    // Obtener o crear conversación
    let convId = conversationId;

    if (!convId) {
      const conversation = await messagesRepo.getOrCreateActiveConversation(userId);
      convId = conversation.id;
    } else {
      // Verificar que la conversación pertenece al usuario
      const belongs = await messagesRepo.conversationBelongsToUser(convId, userId);
      if (!belongs) {
        return reply.status(404).send({
          success: false,
          error: 'Conversación no encontrada',
          code: 'CONVERSATION_NOT_FOUND',
        });
      }
    }

    // Procesar mensaje con IA
    const result = await aiService.processMessage({
      userId,
      conversationId: convId,
      content,
      isVoice,
    });

    if (!result.success) {
      return reply.status(500).send({
        success: false,
        error: result.error.message,
        code: result.error.code,
      });
    }

    return reply.send({
      success: true,
      data: {
        message: {
          id: result.data.assistantMessage.id,
          role: 'assistant',
          content: result.data.response.text,
          ui_components: result.data.response.ui_components,
          created_at: result.data.assistantMessage.created_at,
        },
        conversation_id: convId,
      },
    });
  });

  /**
   * GET /api/v1/chat/conversations
   * Lista todas las conversaciones del usuario
   */
  app.get('/conversations', async (request, reply) => {
    const userId = request.user!.userId;

    // Validar query params
    const validation = validateSchema(listConversationsSchema, request.query);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Parámetros inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const { limit, offset } = validation.data;

    const conversations = await messagesRepo.listConversationsByUser(
      userId,
      limit,
      offset
    );

    return reply.send({
      success: true,
      data: { conversations },
    });
  });

  /**
   * GET /api/v1/chat/conversations/:id
   * Obtiene una conversación con todos sus mensajes
   */
  app.get<{ Params: { id: string } }>('/conversations/:id', async (request, reply) => {
    const userId = request.user!.userId;
    const conversationId = request.params.id;

    // Verificar ownership
    const belongs = await messagesRepo.conversationBelongsToUser(conversationId, userId);
    if (!belongs) {
      return reply.status(404).send({
        success: false,
        error: 'Conversación no encontrada',
        code: 'CONVERSATION_NOT_FOUND',
      });
    }

    // Validar query params
    const validation = validateSchema(getConversationMessagesSchema, request.query);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Parámetros inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const { limit, offset } = validation.data;

    // Obtener conversación y mensajes
    const conversation = await messagesRepo.findConversationById(conversationId);
    const messages = await messagesRepo.listMessagesByConversation(
      conversationId,
      limit,
      offset
    );

    return reply.send({
      success: true,
      data: {
        conversation,
        messages,
      },
    });
  });

  /**
   * POST /api/v1/chat/conversations
   * Crea una nueva conversación
   */
  app.post('/conversations', async (request, reply) => {
    const userId = request.user!.userId;

    // Validar input
    const validation = validateSchema(createConversationSchema, request.body);

    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: 'Datos de entrada inválidos',
        code: 'VALIDATION_ERROR',
        details: formatZodErrors(validation.errors),
      });
    }

    const { title } = validation.data;

    const conversation = await messagesRepo.createConversation({
      user_id: userId,
      title: title || `Conversación ${new Date().toLocaleDateString('es-MX')}`,
    });

    return reply.status(201).send({
      success: true,
      data: { conversation },
    });
  });
}

export default chatRoutes;
