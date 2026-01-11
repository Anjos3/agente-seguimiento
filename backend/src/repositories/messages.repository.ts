/**
 * =====================================================
 * REPOSITORY DE MENSAJES Y CONVERSACIONES
 * =====================================================
 *
 * Maneja el acceso a datos de:
 * - Conversaciones (sesiones de chat)
 * - Mensajes (dentro de cada conversación)
 */

import { query, transaction } from '../utils/db.js';
import { Conversation, Message, UIComponent } from '../types/index.js';

// =====================================================
// TIPOS INTERNOS
// =====================================================

interface CreateConversationData {
  user_id: string;
  title?: string;
}

interface CreateMessageData {
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  ui_components?: UIComponent[];
  is_voice?: boolean;
}

// =====================================================
// CONVERSACIONES
// =====================================================

/**
 * Crea una nueva conversación
 */
export async function createConversation(
  data: CreateConversationData
): Promise<Conversation> {
  const result = await query<Conversation>(
    `INSERT INTO conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [data.user_id, data.title || null]
  );

  return result.rows[0];
}

/**
 * Busca una conversación por ID
 */
export async function findConversationById(
  id: string
): Promise<Conversation | null> {
  const result = await query<Conversation>(
    `SELECT * FROM conversations WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Lista conversaciones de un usuario (más recientes primero)
 */
export async function listConversationsByUser(
  userId: string,
  limit = 20,
  offset = 0
): Promise<Conversation[]> {
  const result = await query<Conversation>(
    `SELECT * FROM conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );

  return result.rows;
}

/**
 * Actualiza el título de una conversación
 */
export async function updateConversationTitle(
  id: string,
  title: string
): Promise<Conversation | null> {
  const result = await query<Conversation>(
    `UPDATE conversations
     SET title = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [title, id]
  );

  return result.rows[0] || null;
}

/**
 * Verifica si una conversación pertenece a un usuario
 */
export async function conversationBelongsToUser(
  conversationId: string,
  userId: string
): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(
      SELECT 1 FROM conversations
      WHERE id = $1 AND user_id = $2
    ) as exists`,
    [conversationId, userId]
  );

  return result.rows[0].exists;
}

// =====================================================
// MENSAJES
// =====================================================

/**
 * Crea un nuevo mensaje
 */
export async function createMessage(data: CreateMessageData): Promise<Message> {
  const result = await query<Message>(
    `INSERT INTO messages (conversation_id, role, content, ui_components, is_voice)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.conversation_id,
      data.role,
      data.content,
      data.ui_components ? JSON.stringify(data.ui_components) : null,
      data.is_voice || false,
    ]
  );

  // Actualizar timestamp de la conversación
  await query(
    `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
    [data.conversation_id]
  );

  return result.rows[0];
}

/**
 * Lista mensajes de una conversación
 */
export async function listMessagesByConversation(
  conversationId: string,
  limit = 50,
  offset = 0
): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2 OFFSET $3`,
    [conversationId, limit, offset]
  );

  return result.rows;
}

/**
 * Obtiene los últimos N mensajes de una conversación
 * (útil para contexto de la IA)
 */
export async function getRecentMessages(
  conversationId: string,
  limit = 10
): Promise<Message[]> {
  const result = await query<Message>(
    `SELECT * FROM (
      SELECT * FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    ) sub
    ORDER BY created_at ASC`,
    [conversationId, limit]
  );

  return result.rows;
}

/**
 * Cuenta mensajes en una conversación
 */
export async function countMessages(conversationId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1`,
    [conversationId]
  );

  return parseInt(result.rows[0].count, 10);
}

/**
 * Crea mensaje del usuario y respuesta del asistente en una transacción
 */
export async function createMessagePair(
  userMessage: CreateMessageData,
  assistantMessage: CreateMessageData
): Promise<{ userMessage: Message; assistantMessage: Message }> {
  return transaction(async (client) => {
    // Insertar mensaje del usuario
    const userResult = await client.query<Message>(
      `INSERT INTO messages (conversation_id, role, content, ui_components, is_voice)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userMessage.conversation_id,
        userMessage.role,
        userMessage.content,
        userMessage.ui_components
          ? JSON.stringify(userMessage.ui_components)
          : null,
        userMessage.is_voice || false,
      ]
    );

    // Insertar mensaje del asistente
    const assistantResult = await client.query<Message>(
      `INSERT INTO messages (conversation_id, role, content, ui_components, is_voice)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        assistantMessage.conversation_id,
        assistantMessage.role,
        assistantMessage.content,
        assistantMessage.ui_components
          ? JSON.stringify(assistantMessage.ui_components)
          : null,
        false,
      ]
    );

    // Actualizar conversación
    await client.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [userMessage.conversation_id]
    );

    return {
      userMessage: userResult.rows[0],
      assistantMessage: assistantResult.rows[0],
    };
  });
}

/**
 * Obtiene o crea la conversación activa del usuario
 * (la más reciente o una nueva si no hay ninguna del día)
 */
export async function getOrCreateActiveConversation(
  userId: string
): Promise<Conversation> {
  // Buscar conversación activa del día
  const result = await query<Conversation>(
    `SELECT * FROM conversations
     WHERE user_id = $1
       AND DATE(created_at) = CURRENT_DATE
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  // Crear nueva conversación
  return createConversation({
    user_id: userId,
    title: `Conversación ${new Date().toLocaleDateString('es-MX')}`,
  });
}
