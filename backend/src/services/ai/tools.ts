/**
 * =====================================================
 * DEFINICIÓN DE TOOLS PARA OPENAI
 * =====================================================
 *
 * Los tools permiten que la IA ejecute acciones reales:
 * - Crear tareas
 * - Iniciar/pausar/completar tareas
 * - Obtener información del día
 *
 * OpenAI decide cuándo usar cada tool basándose en:
 * 1. La descripción del tool
 * 2. El mensaje del usuario
 * 3. El contexto de la conversación
 */

import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * Lista de tools disponibles para el agente
 */
export const AGENT_TOOLS: ChatCompletionTool[] = [
  // =====================================================
  // GESTIÓN DE TAREAS
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: `Crea una nueva tarea para el usuario. Usar cuando el usuario dice:
- "Empiezo X" o "Voy a hacer X" (con startNow=true)
- "Tengo que hacer X" o "Agregar tarea X"
- "Nueva tarea: X"

Si el usuario indica que está empezando algo, usar startNow=true para iniciar el timer automáticamente.`,
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nombre descriptivo de la tarea',
          },
          description: {
            type: 'string',
            description: 'Descripción opcional con más detalles',
          },
          estimatedMinutes: {
            type: 'number',
            description: 'Tiempo estimado en minutos (opcional)',
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Prioridad de la tarea',
          },
          startNow: {
            type: 'boolean',
            description: 'Si true, inicia el timer inmediatamente',
          },
        },
        required: ['name'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'complete_task',
      description: `Marca una tarea como completada y detiene el timer. Usar cuando el usuario dice:
- "Terminé" o "Listo" o "Acabé"
- "Completé X" o "Ya terminé con X"
- "Done" o "Fin"

Si no se proporciona taskId, completa la tarea activa automáticamente.`,
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID de la tarea a completar (opcional, si no se da usa la activa)',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'pause_task',
      description: `Pausa el timer de la tarea activa. Usar cuando el usuario dice:
- "Pauso" o "Un momento"
- "Voy a descansar"
- "Break" o "Pausa"`,
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID de la tarea a pausar (opcional)',
          },
        },
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'start_task',
      description: `Inicia o reanuda el timer de una tarea. Usar cuando el usuario dice:
- "Continúo con X" o "Retomo X"
- "Empiezo X" (para una tarea existente)
- "Vuelvo a X"`,
      parameters: {
        type: 'object',
        properties: {
          taskId: {
            type: 'string',
            description: 'ID de la tarea a iniciar',
          },
        },
        required: ['taskId'],
      },
    },
  },

  // =====================================================
  // CONSULTAS
  // =====================================================
  {
    type: 'function',
    function: {
      name: 'get_today_tasks',
      description: `Obtiene las tareas del día actual. Usar cuando el usuario pregunta:
- "¿Qué hice hoy?" o "¿Cómo me fue hoy?"
- "Mis tareas de hoy"
- "Resumen del día"
- "¿Qué tengo pendiente?"`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_active_task',
      description: `Obtiene la tarea que está actualmente en progreso. Usar cuando el usuario pregunta:
- "¿En qué estoy?" o "¿Qué estoy haciendo?"
- "Tarea actual"
- "¿Cuánto tiempo llevo?"`,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: 'get_time_stats',
      description: `Obtiene estadísticas de tiempo trabajado. Usar cuando el usuario pregunta:
- "¿Cuánto trabajé hoy?"
- "Tiempo total"
- "Estadísticas" o "Analytics"`,
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD (opcional, default: hoy)',
          },
        },
        required: [],
      },
    },
  },
];

/**
 * Nombres de tools disponibles (para validación)
 */
export const TOOL_NAMES = AGENT_TOOLS.map((t) => t.function.name);

/**
 * Tipo para los argumentos de cada tool
 */
export interface ToolArguments {
  create_task: {
    name: string;
    description?: string;
    estimatedMinutes?: number;
    priority?: 'low' | 'medium' | 'high';
    startNow?: boolean;
  };
  complete_task: {
    taskId?: string;
  };
  pause_task: {
    taskId?: string;
  };
  start_task: {
    taskId: string;
  };
  get_today_tasks: Record<string, never>;
  get_active_task: Record<string, never>;
  get_time_stats: {
    date?: string;
  };
}

export type ToolName = keyof ToolArguments;
