/**
 * =====================================================
 * SERVICIO DE IA - PROCESAMIENTO DE MENSAJES
 * =====================================================
 *
 * Flujo completo:
 * 1. Usuario envía mensaje
 * 2. Construimos contexto (usuario, tareas, metas)
 * 3. Primera llamada a OpenAI (con tools disponibles)
 * 4. Si OpenAI decide usar tool → ejecutamos → segunda llamada
 * 5. OpenAI genera respuesta final con texto + UI components
 * 6. Guardamos en DB y retornamos
 */

import { openai, DEFAULT_MODEL } from '../../utils/openai.js';
import { generateSystemPrompt, BASE_SYSTEM_PROMPT } from './systemPrompt.js';
import { AGENT_TOOLS, ToolName } from './tools.js';
import { executeTool, parseToolArguments, ToolContext } from './toolExecutor.js';
import { AIContext, AIResponse, Message } from '../../types/index.js';
import * as usersRepo from '../../repositories/users.repository.js';
import * as messagesRepo from '../../repositories/messages.repository.js';
import * as tasksRepo from '../../repositories/tasks.repository.js';
import {
  ChatCompletionMessageParam,
  ChatCompletionToolMessageParam,
} from 'openai/resources/chat/completions';

// =====================================================
// TIPOS
// =====================================================

interface ProcessMessageInput {
  userId: string;
  conversationId: string;
  content: string;
  isVoice?: boolean;
}

interface ProcessMessageResult {
  success: true;
  data: {
    userMessage: Message;
    assistantMessage: Message;
    response: AIResponse;
  };
}

interface ProcessMessageError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

// =====================================================
// SCHEMA JSON PARA STRUCTURED OUTPUT
// =====================================================

const RESPONSE_SCHEMA = {
  type: 'object' as const,
  additionalProperties: false,
  properties: {
    text: {
      type: 'string' as const,
      description: 'Mensaje de texto para el usuario',
    },
    ui_components: {
      type: 'array' as const,
      description: 'Componentes visuales a renderizar',
      items: {
        type: 'object' as const,
        additionalProperties: false,
        properties: {
          type: {
            type: 'string' as const,
            enum: [
              'task_timeline',
              'metrics_card',
              'bar_chart',
              'pie_chart',
              'progress_ring',
              'task_list',
              'alert_card',
              'goal_tracker',
              'pattern_insight',
              'quick_actions',
            ],
          },
          id: { type: 'string' as const },
          order: { type: 'number' as const },
          props: {
            type: 'string' as const,
            description: 'JSON serializado con las propiedades del componente',
          },
        },
        required: ['type', 'id', 'order', 'props'] as const,
      },
    },
  },
  required: ['text', 'ui_components'] as const,
};

// =====================================================
// FUNCIÓN PRINCIPAL
// =====================================================

/**
 * Procesa un mensaje del usuario con el agente de IA
 *
 * El flujo puede incluir múltiples llamadas a OpenAI si se usan tools:
 * 1. Primera llamada → OpenAI puede devolver tool_calls
 * 2. Ejecutamos cada tool
 * 3. Segunda llamada con resultados → respuesta final
 */
export async function processMessage(
  input: ProcessMessageInput
): Promise<ProcessMessageResult | ProcessMessageError> {
  try {
    const { userId, conversationId, content, isVoice } = input;

    // 1. Construir contexto del usuario
    const context = await buildContext(userId);

    // 2. Obtener historial reciente
    const recentMessages = await messagesRepo.getRecentMessages(conversationId, 10);

    // 3. Construir mensajes para OpenAI
    const messages = buildOpenAIMessages(context, recentMessages, content);

    // 4. Primera llamada a OpenAI (puede retornar tool_calls)
    const firstResponse = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto', // OpenAI decide si usar tools
      temperature: 0.7,
      max_tokens: 2000,
    });

    const firstChoice = firstResponse.choices[0];
    let finalMessages = [...messages];
    let aiResponse: AIResponse;

    // 5. Si hay tool_calls, ejecutarlos
    if (firstChoice.message.tool_calls && firstChoice.message.tool_calls.length > 0) {
      // Agregar el mensaje del asistente con los tool_calls
      finalMessages.push(firstChoice.message as ChatCompletionMessageParam);

      // Ejecutar cada tool y agregar resultados
      const toolContext: ToolContext = { userId };

      for (const toolCall of firstChoice.message.tool_calls) {
        const toolName = toolCall.function.name as ToolName;
        const toolArgs = parseToolArguments(toolCall.function.arguments);

        console.log(`🔧 Ejecutando tool: ${toolName}`, toolArgs);

        const toolResult = await executeTool(toolName, toolArgs, toolContext);

        console.log(`✅ Resultado de ${toolName}:`, toolResult);

        // Agregar resultado del tool al historial
        const toolMessage: ChatCompletionToolMessageParam = {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        };

        finalMessages.push(toolMessage);
      }

      // 6. Segunda llamada con resultados de tools
      const secondResponse = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: finalMessages,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ai_response',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const secondContent = secondResponse.choices[0]?.message?.content;

      if (!secondContent) {
        throw new Error('OpenAI no retornó contenido en segunda llamada');
      }

      aiResponse = JSON.parse(secondContent) as AIResponse;
    } else {
      // No hubo tool_calls, respuesta directa
      // Necesitamos hacer otra llamada para obtener JSON estructurado
      const directResponse = await openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          ...messages,
          {
            role: 'assistant',
            content: firstChoice.message.content || '',
          },
          {
            role: 'user',
            content:
              'Por favor, formatea tu respuesta anterior como JSON con los campos "text" y "ui_components".',
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ai_response',
            strict: true,
            schema: RESPONSE_SCHEMA,
          },
        },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const directContent = directResponse.choices[0]?.message?.content;

      if (!directContent) {
        // Fallback: usar el contenido de texto directamente
        aiResponse = {
          text: firstChoice.message.content || 'No pude procesar tu mensaje.',
          ui_components: [],
        };
      } else {
        aiResponse = JSON.parse(directContent) as AIResponse;
      }
    }

    // 7. Guardar mensajes en DB
    const { userMessage, assistantMessage } = await messagesRepo.createMessagePair(
      {
        conversation_id: conversationId,
        role: 'user',
        content,
        is_voice: isVoice,
      },
      {
        conversation_id: conversationId,
        role: 'assistant',
        content: aiResponse.text,
        ui_components: aiResponse.ui_components,
      }
    );

    return {
      success: true,
      data: {
        userMessage,
        assistantMessage,
        response: aiResponse,
      },
    };
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return {
          success: false,
          error: {
            code: 'OPENAI_AUTH_ERROR',
            message: 'Error de autenticación con OpenAI',
          },
        };
      }

      if (error.message.includes('rate limit')) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
          },
        };
      }
    }

    return {
      success: false,
      error: {
        code: 'AI_PROCESSING_ERROR',
        message: 'Error procesando el mensaje con IA',
      },
    };
  }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

/**
 * Construye el contexto del usuario para la IA
 */
async function buildContext(userId: string): Promise<AIContext> {
  const user = await usersRepo.findById(userId);

  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // Hora local del usuario
  const now = new Date();
  const localTime = now.toLocaleTimeString('es-MX', {
    timeZone: user.timezone,
    hour: '2-digit',
    minute: '2-digit',
  });
  const localDate = now.toLocaleDateString('es-MX', {
    timeZone: user.timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Obtener tareas de hoy y tarea activa
  const todayTasks = await tasksRepo.getTodayTasks(userId);
  const activeTask = await tasksRepo.getActiveTask(userId);

  return {
    user: {
      name: user.name,
      timezone: user.timezone,
    },
    local_time: localTime,
    local_date: localDate,
    active_task: activeTask,
    today_tasks: todayTasks,
    active_goals: [], // TODO: Implementar cuando tengamos goals
    recent_check_in: null, // TODO: Implementar cuando tengamos check-ins
  };
}

/**
 * Construye el array de mensajes para OpenAI
 */
function buildOpenAIMessages(
  context: AIContext,
  recentMessages: Message[],
  newContent: string
): ChatCompletionMessageParam[] {
  const messages: ChatCompletionMessageParam[] = [];

  // System prompt con contexto
  const systemPrompt = generateSystemPrompt(context);

  messages.push({
    role: 'system',
    content: systemPrompt,
  });

  // Historial reciente
  for (const msg of recentMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Mensaje nuevo del usuario
  messages.push({
    role: 'user',
    content: newContent,
  });

  return messages;
}

/**
 * Genera una respuesta simple sin tools (para pruebas)
 */
export async function generateSimpleResponse(userMessage: string): Promise<AIResponse> {
  const response = await openai.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: 'system', content: BASE_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'ai_response',
        strict: true,
        schema: RESPONSE_SCHEMA,
      },
    },
    temperature: 0.7,
    max_tokens: 1000,
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    return {
      text: 'Lo siento, no pude procesar tu mensaje.',
      ui_components: [],
    };
  }

  return JSON.parse(content) as AIResponse;
}
