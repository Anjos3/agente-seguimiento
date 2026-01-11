/**
 * =====================================================
 * SCHEMAS DE VALIDACIÓN - AUTENTICACIÓN
 * =====================================================
 *
 * Usamos Zod para validar los datos de entrada.
 * Zod nos permite:
 * - Validar tipos en runtime
 * - Generar tipos TypeScript automáticamente
 * - Mensajes de error claros para el usuario
 */

import { z } from 'zod';

// =====================================================
// REGISTER
// =====================================================

/**
 * Schema para registro de usuario
 */
export const registerSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email no es válido')
    .max(255, 'El email es demasiado largo')
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(100, 'La contraseña es demasiado larga')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
    ),

  name: z
    .string({ required_error: 'El nombre es requerido' })
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(100, 'El nombre es demasiado largo')
    .trim(),

  timezone: z
    .string()
    .default('America/Mexico_City')
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// =====================================================
// LOGIN
// =====================================================

/**
 * Schema para login
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'El email es requerido' })
    .email('El email no es válido')
    .toLowerCase()
    .trim(),

  password: z
    .string({ required_error: 'La contraseña es requerida' })
    .min(1, 'La contraseña es requerida'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// =====================================================
// REFRESH TOKEN
// =====================================================

/**
 * Schema para refresh token
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string({ required_error: 'El refresh token es requerido' })
    .min(1, 'El refresh token es requerido'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// =====================================================
// HELPERS
// =====================================================

/**
 * Valida datos con un schema y retorna el resultado
 *
 * @param schema - Schema de Zod
 * @param data - Datos a validar
 * @returns Objeto con success, data y errors
 */
export function validateSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, errors: result.error };
}

/**
 * Formatea los errores de Zod para respuesta API
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    errors[path] = issue.message;
  }

  return errors;
}
