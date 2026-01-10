/**
 * =====================================================
 * PUNTO DE ENTRADA DEL SERVIDOR
 * =====================================================
 *
 * Este archivo:
 * 1. Carga la configuración
 * 2. Verifica conexiones (DB, OpenAI)
 * 3. Inicia el servidor HTTP
 * 4. Maneja el cierre limpio (graceful shutdown)
 *
 * Para ejecutar:
 * - Desarrollo: npm run dev
 * - Producción: npm run build && npm start
 */

import { buildApp } from './app.js';
import { env } from './utils/env.js';
import { testConnection, closePool } from './utils/db.js';

/**
 * Función principal que arranca el servidor
 */
async function main(): Promise<void> {
  console.log('🚀 Iniciando servidor...\n');

  // =====================================================
  // PASO 1: Verificar conexión a PostgreSQL
  // =====================================================
  console.log('📊 Conectando a PostgreSQL...');
  try {
    await testConnection();
  } catch (error) {
    console.error('❌ No se pudo conectar a PostgreSQL. Verifica:');
    console.error('   - Que PostgreSQL esté corriendo');
    console.error('   - Que DATABASE_URL en .env sea correcta');
    console.error('   - Que la base de datos exista');
    process.exit(1);
  }

  // =====================================================
  // PASO 2: Construir la aplicación Fastify
  // =====================================================
  console.log('\n⚙️  Configurando Fastify...');
  const app = await buildApp();

  // =====================================================
  // PASO 3: Iniciar el servidor HTTP
  // =====================================================
  try {
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    console.log('\n' + '='.repeat(50));
    console.log('✅ SERVIDOR INICIADO CORRECTAMENTE');
    console.log('='.repeat(50));
    console.log(`📍 URL:         http://${env.HOST}:${env.PORT}`);
    console.log(`🌍 Entorno:     ${env.NODE_ENV}`);
    console.log(`📋 Health:      http://${env.HOST}:${env.PORT}/health`);
    console.log(`🔐 Auth API:    http://${env.HOST}:${env.PORT}/api/v1/auth`);
    console.log(`💬 Chat API:    http://${env.HOST}:${env.PORT}/api/v1/chat`);
    console.log(`📝 Tasks API:   http://${env.HOST}:${env.PORT}/api/v1/tasks`);
    console.log('='.repeat(50) + '\n');
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }

  // =====================================================
  // PASO 4: Manejo de cierre limpio (Graceful Shutdown)
  // =====================================================
  // Cuando el proceso recibe señal de terminar, cerramos todo limpiamente

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⚠️  Recibida señal ${signal}. Cerrando servidor...`);

    try {
      // Cerrar servidor HTTP (deja de aceptar nuevas conexiones)
      await app.close();
      console.log('✅ Servidor HTTP cerrado');

      // Cerrar pool de PostgreSQL
      await closePool();
      console.log('✅ Conexiones a PostgreSQL cerradas');

      console.log('👋 Servidor cerrado correctamente');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error cerrando servidor:', error);
      process.exit(1);
    }
  };

  // Escuchar señales de terminación
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill

  // Manejar errores no capturados
  process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    console.error('❌ Promesa rechazada no manejada:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

// Ejecutar la función principal
main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
