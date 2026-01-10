/**
 * =====================================================
 * CLIENTE DE OPENAI
 * =====================================================
 *
 * Este módulo configura el cliente de OpenAI para conectar con GPT-5.
 *
 * Usamos el SDK oficial de OpenAI que maneja:
 * - Autenticación con API key
 * - Reintentos automáticos en caso de error
 * - Rate limiting
 * - Streaming de respuestas
 */

import OpenAI from 'openai';
import { env } from './env.js';

/**
 * Cliente de OpenAI configurado con la API key del entorno
 *
 * Uso:
 * ```typescript
 * import { openai } from './utils/openai';
 *
 * const response = await openai.chat.completions.create({
 *   model: 'gpt-4o-mini',
 *   messages: [{ role: 'user', content: 'Hola' }]
 * });
 * ```
 */
export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

/**
 * Modelo por defecto a usar
 * Configurable desde variables de entorno
 */
export const DEFAULT_MODEL = env.OPENAI_MODEL;

/**
 * Verifica que la API key de OpenAI sea válida
 *
 * @returns true si la conexión es exitosa
 * @throws Error si la API key es inválida
 */
export async function testOpenAIConnection(): Promise<boolean> {
  try {
    // Hacemos una llamada simple para verificar la API key
    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: 'user', content: 'Di "OK" y nada más.' }],
      max_tokens: 10,
    });

    console.log('✅ Conexión a OpenAI exitosa:', {
      model: DEFAULT_MODEL,
      response: response.choices[0]?.message?.content,
    });

    return true;
  } catch (error) {
    console.error('❌ Error conectando a OpenAI:', error);
    throw error;
  }
}
