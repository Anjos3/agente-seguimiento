/**
 * =====================================================
 * SCHEMAS DE VALIDACIÓN - CHAT
 * =====================================================
 */

import { z } from 'zod';

// =====================================================
// SEND MESSAGE
// =====================================================

/**
 * Schema para enviar mensaje al chat
 */
export const sendMessageSchema = z.object({
  conversationId: z
    .string()
    .uuid('ID de conversación inválido')
    .optional(),

  content: z
    .string({ required_error: 'El mensaje es requerido' })
    .min(1, 'El mensaje no puede estar vacío')
    .max(4000, 'El mensaje es demasiado largo'),

  isVoice: z
    .boolean()
    .default(false)
    .optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

// =====================================================
// LIST CONVERSATIONS
// =====================================================

/**
 * Schema para query params de listar conversaciones
 */
export const listConversationsSchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export type ListConversationsInput = z.infer<typeof listConversationsSchema>;

// =====================================================
// GET CONVERSATION MESSAGES
// =====================================================

/**
 * Schema para obtener mensajes de una conversación
 */
export const getConversationMessagesSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export type GetConversationMessagesInput = z.infer<typeof getConversationMessagesSchema>;

// =====================================================
// CREATE CONVERSATION
// =====================================================

/**
 * Schema para crear conversación manualmente
 */
export const createConversationSchema = z.object({
  title: z
    .string()
    .max(200, 'El título es demasiado largo')
    .optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
