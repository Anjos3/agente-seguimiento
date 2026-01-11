/**
 * =====================================================
 * SERVICIO DE AUTENTICACIÓN
 * =====================================================
 *
 * Contiene la lógica de negocio para autenticación:
 * - Registro de usuarios
 * - Login con JWT
 * - Validación de tokens
 *
 * Usa bcrypt para hashear contraseñas de forma segura.
 */

import bcrypt from 'bcrypt';
import { FastifyInstance } from 'fastify';
import * as usersRepo from '../../repositories/users.repository.js';
import { User, UserPublic } from '../../types/index.js';
import { RegisterInput, LoginInput } from '../../schemas/auth.schema.js';

// =====================================================
// CONSTANTES
// =====================================================

/**
 * Número de rounds para bcrypt
 * 12 es un buen balance entre seguridad y velocidad
 * Más alto = más seguro pero más lento
 */
const SALT_ROUNDS = 12;

// =====================================================
// TIPOS DE RESPUESTA
// =====================================================

export interface AuthResult {
  user: UserPublic;
  token: string;
}

export interface AuthError {
  code: string;
  message: string;
  field?: string;
}

// =====================================================
// FUNCIONES DEL SERVICIO
// =====================================================

/**
 * Registra un nuevo usuario
 *
 * @param app - Instancia de Fastify (para firmar JWT)
 * @param input - Datos de registro validados
 * @returns Usuario y token, o error
 */
export async function register(
  app: FastifyInstance,
  input: RegisterInput
): Promise<{ success: true; data: AuthResult } | { success: false; error: AuthError }> {
  // Verificar si el email ya existe
  const emailTaken = await usersRepo.emailExists(input.email);

  if (emailTaken) {
    return {
      success: false,
      error: {
        code: 'EMAIL_EXISTS',
        message: 'Este email ya está registrado',
        field: 'email',
      },
    };
  }

  // Hashear la contraseña
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  // Crear el usuario
  const user = await usersRepo.create({
    email: input.email,
    name: input.name,
    password_hash: passwordHash,
    timezone: input.timezone,
  });

  // Generar JWT
  const token = generateToken(app, user);

  return {
    success: true,
    data: {
      user: usersRepo.toPublic(user),
      token,
    },
  };
}

/**
 * Inicia sesión de un usuario
 *
 * @param app - Instancia de Fastify (para firmar JWT)
 * @param input - Credenciales de login
 * @returns Usuario y token, o error
 */
export async function login(
  app: FastifyInstance,
  input: LoginInput
): Promise<{ success: true; data: AuthResult } | { success: false; error: AuthError }> {
  // Buscar usuario por email
  const user = await usersRepo.findByEmail(input.email);

  if (!user) {
    // No revelamos si el email existe o no (seguridad)
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email o contraseña incorrectos',
      },
    };
  }

  // Verificar contraseña
  const validPassword = await bcrypt.compare(input.password, user.password_hash);

  if (!validPassword) {
    return {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email o contraseña incorrectos',
      },
    };
  }

  // Actualizar último acceso
  await usersRepo.updateLastLogin(user.id);

  // Generar JWT
  const token = generateToken(app, user);

  return {
    success: true,
    data: {
      user: usersRepo.toPublic(user),
      token,
    },
  };
}

/**
 * Obtiene el usuario actual por ID
 *
 * @param userId - ID del usuario (del JWT)
 * @returns Usuario público o null
 */
export async function getCurrentUser(userId: string): Promise<UserPublic | null> {
  const user = await usersRepo.findById(userId);

  if (!user) {
    return null;
  }

  return usersRepo.toPublic(user);
}

/**
 * Genera un JWT para el usuario
 *
 * @param app - Instancia de Fastify
 * @param user - Usuario para el que se genera el token
 * @returns Token JWT firmado
 */
function generateToken(app: FastifyInstance, user: User): string {
  return app.jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    {
      expiresIn: '7d', // Token válido por 7 días
    }
  );
}

/**
 * Verifica la fortaleza de una contraseña
 * (Además de la validación de Zod, para feedback adicional)
 *
 * @param password - Contraseña a verificar
 * @returns Objeto con fortaleza y sugerencias
 */
export function checkPasswordStrength(password: string): {
  score: number; // 0-4
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (password.length < 8) {
    feedback.push('Usa al menos 8 caracteres');
  }
  if (!/[A-Z]/.test(password)) {
    feedback.push('Añade una letra mayúscula');
  }
  if (!/[0-9]/.test(password)) {
    feedback.push('Añade un número');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    feedback.push('Añade un carácter especial (!@#$%...)');
  }

  return { score: Math.min(score, 4), feedback };
}
