/**
 * =====================================================
 * REPOSITORY DE USUARIOS
 * =====================================================
 *
 * Patrón Repository: Encapsula toda la lógica de acceso a datos.
 * El servicio no sabe cómo se guardan los datos, solo llama al repository.
 *
 * Beneficios:
 * - Fácil de testear (mock del repository)
 * - Fácil de cambiar de BD (solo cambias el repository)
 * - Queries centralizadas y reutilizables
 */

import { query } from '../utils/db.js';
import { User, UserPublic, UserPreferences } from '../types/index.js';

// =====================================================
// TIPOS INTERNOS
// =====================================================

interface CreateUserData {
  email: string;
  name: string;
  password_hash: string;
  timezone?: string;
  preferences?: UserPreferences;
}

interface UpdateUserData {
  name?: string;
  timezone?: string;
  preferences?: UserPreferences;
}

// =====================================================
// FUNCIONES DEL REPOSITORY
// =====================================================

/**
 * Busca un usuario por email
 *
 * @param email - Email del usuario (case insensitive)
 * @returns Usuario encontrado o null
 */
export async function findByEmail(email: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE email = $1`,
    [email.toLowerCase()]
  );

  return result.rows[0] || null;
}

/**
 * Busca un usuario por ID
 *
 * @param id - UUID del usuario
 * @returns Usuario encontrado o null
 */
export async function findById(id: string): Promise<User | null> {
  const result = await query<User>(
    `SELECT * FROM users WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

/**
 * Crea un nuevo usuario
 *
 * @param data - Datos del usuario a crear
 * @returns Usuario creado
 */
export async function create(data: CreateUserData): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (email, name, password_hash, timezone, preferences)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.email.toLowerCase(),
      data.name,
      data.password_hash,
      data.timezone || 'America/Mexico_City',
      JSON.stringify(data.preferences || {}),
    ]
  );

  return result.rows[0];
}

/**
 * Actualiza un usuario existente
 *
 * @param id - UUID del usuario
 * @param data - Campos a actualizar
 * @returns Usuario actualizado o null si no existe
 */
export async function update(
  id: string,
  data: UpdateUserData
): Promise<User | null> {
  // Construir query dinámica solo con campos proporcionados
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramCount = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramCount++}`);
    values.push(data.name);
  }

  if (data.timezone !== undefined) {
    updates.push(`timezone = $${paramCount++}`);
    values.push(data.timezone);
  }

  if (data.preferences !== undefined) {
    updates.push(`preferences = $${paramCount++}`);
    values.push(JSON.stringify(data.preferences));
  }

  if (updates.length === 0) {
    return findById(id);
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  const result = await query<User>(
    `UPDATE users
     SET ${updates.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Verifica si un email ya está registrado
 *
 * @param email - Email a verificar
 * @returns true si el email existe
 */
export async function emailExists(email: string): Promise<boolean> {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists`,
    [email.toLowerCase()]
  );

  return result.rows[0].exists;
}

/**
 * Elimina la información sensible del usuario
 * Útil para enviar al cliente
 *
 * @param user - Usuario completo
 * @returns Usuario sin password_hash
 */
export function toPublic(user: User): UserPublic {
  const { password_hash, ...publicUser } = user;
  return publicUser;
}

/**
 * Actualiza la fecha de último acceso
 *
 * @param id - UUID del usuario
 */
export async function updateLastLogin(id: string): Promise<void> {
  await query(
    `UPDATE users SET updated_at = NOW() WHERE id = $1`,
    [id]
  );
}
