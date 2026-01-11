/**
 * =====================================================
 * SCHEMAS DE VALIDACIÓN - TAREAS
 * =====================================================
 */

import { z } from 'zod';

// =====================================================
// CREATE TASK
// =====================================================

export const createTaskSchema = z.object({
  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre es demasiado largo')
    .trim(),

  description: z
    .string()
    .max(1000, 'La descripción es demasiado larga')
    .optional(),

  categoryId: z
    .string()
    .uuid('ID de categoría inválido')
    .optional(),

  priority: z
    .enum(['low', 'medium', 'high'])
    .default('medium')
    .optional(),

  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .optional(),

  estimatedMinutes: z
    .number()
    .int('Los minutos deben ser enteros')
    .min(1, 'El tiempo estimado debe ser al menos 1 minuto')
    .max(1440, 'El tiempo estimado no puede superar 24 horas')
    .optional(),

  startNow: z
    .boolean()
    .default(false)
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// =====================================================
// UPDATE TASK
// =====================================================

export const updateTaskSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre no puede estar vacío')
    .max(200, 'El nombre es demasiado largo')
    .trim()
    .optional(),

  description: z
    .string()
    .max(1000, 'La descripción es demasiado larga')
    .nullable()
    .optional(),

  categoryId: z
    .string()
    .uuid('ID de categoría inválido')
    .nullable()
    .optional(),

  priority: z
    .enum(['low', 'medium', 'high'])
    .optional(),

  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
    .nullable()
    .optional(),

  estimatedMinutes: z
    .number()
    .int('Los minutos deben ser enteros')
    .min(1, 'El tiempo estimado debe ser al menos 1 minuto')
    .max(1440, 'El tiempo estimado no puede superar 24 horas')
    .nullable()
    .optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// =====================================================
// LIST TASKS
// =====================================================

export const listTasksSchema = z.object({
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .optional(),

  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido')
    .optional(),

  categoryId: z
    .string()
    .uuid('ID de categoría inválido')
    .optional(),

  priority: z
    .enum(['low', 'medium', 'high'])
    .optional(),

  limit: z.coerce.number().min(1).max(100).default(50),

  offset: z.coerce.number().min(0).default(0),
});

export type ListTasksInput = z.infer<typeof listTasksSchema>;

// =====================================================
// TASK ID PARAM
// =====================================================

export const taskIdSchema = z.object({
  id: z.string().uuid('ID de tarea inválido'),
});

export type TaskIdInput = z.infer<typeof taskIdSchema>;
