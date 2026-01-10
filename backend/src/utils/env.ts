/**
 * =====================================================
 * CONFIGURACIÓN DE VARIABLES DE ENTORNO
 * =====================================================
 *
 * Este módulo:
 * 1. Carga las variables desde el archivo .env
 * 2. Valida que existan las variables requeridas
 * 3. Exporta un objeto tipado con la configuración
 *
 * Si falta alguna variable crítica, el servidor no arranca.
 * Esto previene errores en runtime por configuración incompleta.
 */

import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde .env
// El archivo debe estar en la raíz del proyecto backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Lista de variables de entorno requeridas
 * Si alguna falta, el servidor no arrancará
 */
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'OPENAI_API_KEY',
] as const;

/**
 * Valida que todas las variables requeridas existan
 * @throws Error si falta alguna variable
 */
function validateEnv(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('❌ Error: Faltan variables de entorno requeridas:');
    missing.forEach((varName) => console.error(`   - ${varName}`));
    console.error('\n👉 Copia .env.example a .env y completa los valores');
    process.exit(1);
  }
}

// Validar al importar este módulo
validateEnv();

/**
 * Configuración del entorno, ya validada y tipada
 *
 * Uso:
 * ```typescript
 * import { env } from './utils/env';
 * console.log(env.PORT); // 3000
 * ```
 */
export const env = {
  // Servidor
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production',

  // Base de datos
  DATABASE_URL: process.env.DATABASE_URL!,

  // JWT
  JWT_SECRET: process.env.JWT_SECRET!,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // OpenAI
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Deepgram
  DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY || '',
  DEEPGRAM_MODEL: process.env.DEEPGRAM_MODEL || 'nova-2',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // Helpers
  isDevelopment: process.env.NODE_ENV !== 'production',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

// Tipo exportado para usar en otros módulos
export type Env = typeof env;
