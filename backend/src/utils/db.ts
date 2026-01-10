/**
 * =====================================================
 * CONEXIÓN A POSTGRESQL
 * =====================================================
 *
 * Este módulo maneja la conexión a la base de datos PostgreSQL.
 *
 * Usamos un "Pool" de conexiones en lugar de una conexión única.
 * ¿Por qué?
 * - Crear una conexión es costoso (~50-100ms)
 * - El pool mantiene varias conexiones abiertas y las reutiliza
 * - Cuando haces una query, toma una conexión del pool
 * - Cuando termina, la devuelve al pool (no la cierra)
 *
 * Esto es crucial para un servidor que maneja muchas requests.
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from './env.js';

/**
 * Pool de conexiones a PostgreSQL
 *
 * Configuración:
 * - max: 20 conexiones máximas simultáneas
 * - idleTimeoutMillis: cierra conexiones inactivas después de 30s
 * - connectionTimeoutMillis: falla si no puede conectar en 5s
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Evento: Error en el pool
 * Los errores inesperados se loguean pero no crashean el servidor
 */
pool.on('error', (err: Error) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

/**
 * Evento: Nueva conexión creada
 * Útil para debugging
 */
pool.on('connect', () => {
  if (env.isDevelopment) {
    console.log('🔌 Nueva conexión al pool de PostgreSQL');
  }
});

/**
 * Ejecuta una query SQL y retorna los resultados
 *
 * @param text - Query SQL con placeholders ($1, $2, etc.)
 * @param params - Parámetros para los placeholders
 * @returns Resultado de la query
 *
 * @example
 * ```typescript
 * // Query simple
 * const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
 *
 * // Insert con RETURNING
 * const result = await query(
 *   'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
 *   [email, name]
 * );
 * const newUser = result.rows[0];
 * ```
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();

  try {
    const result = await pool.query<T>(text, params);

    // Log de queries en desarrollo (útil para debugging)
    if (env.isDevelopment) {
      const duration = Date.now() - start;
      console.log(`📊 Query ejecutada en ${duration}ms:`, {
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error('❌ Error en query:', { text, params, error });
    throw error;
  }
}

/**
 * Obtiene un cliente del pool para transacciones
 *
 * IMPORTANTE: Siempre liberar el cliente con client.release()
 *
 * @example
 * ```typescript
 * const client = await getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO users...');
 *   await client.query('INSERT INTO tasks...');
 *   await client.query('COMMIT');
 * } catch (e) {
 *   await client.query('ROLLBACK');
 *   throw e;
 * } finally {
 *   client.release(); // ¡SIEMPRE liberar!
 * }
 * ```
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Ejecuta múltiples queries en una transacción
 *
 * Si alguna query falla, hace ROLLBACK automático.
 * Si todas pasan, hace COMMIT.
 *
 * @param callback - Función que recibe el cliente y ejecuta queries
 * @returns Lo que retorne el callback
 *
 * @example
 * ```typescript
 * const result = await transaction(async (client) => {
 *   const user = await client.query('INSERT INTO users... RETURNING *');
 *   const task = await client.query('INSERT INTO tasks... RETURNING *');
 *   return { user: user.rows[0], task: task.rows[0] };
 * });
 * ```
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verifica la conexión a la base de datos
 *
 * @returns true si la conexión es exitosa
 * @throws Error si no puede conectar
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Conexión a PostgreSQL exitosa:', result.rows[0]);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a PostgreSQL:', error);
    throw error;
  }
}

/**
 * Cierra todas las conexiones del pool
 * Llamar al cerrar el servidor
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('🔌 Pool de PostgreSQL cerrado');
}
