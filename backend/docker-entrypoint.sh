#!/bin/sh
# Docker Entrypoint - Lee secrets y los exporta como variables de entorno

set -e

# Función para leer secret de archivo
read_secret() {
    local secret_name=$1
    local env_var=$2
    local secret_file="/run/secrets/${secret_name}"

    if [ -f "$secret_file" ]; then
        export "$env_var"="$(cat $secret_file | tr -d '\n')"
        echo "✅ Secret '$secret_name' cargado"
    else
        echo "⚠️  Secret '$secret_name' no encontrado en $secret_file"
    fi
}

echo "🔐 Cargando secrets desde Docker Secrets..."

# Cargar cada secret
read_secret "jwt_secret" "JWT_SECRET"
read_secret "openai_api_key" "OPENAI_API_KEY"
read_secret "db_password" "DB_PASSWORD"

# Construir DATABASE_URL si tenemos el password
if [ -n "$DB_PASSWORD" ]; then
    DB_HOST="${DB_HOST:-postgres}"

    # Esperar a que el DNS resuelva el host de la BD (máx 30 segundos)
    echo "⏳ Esperando resolución DNS de $DB_HOST..."
    MAX_WAIT=30
    WAITED=0
    while ! getent hosts "$DB_HOST" >/dev/null 2>&1; do
        if [ $WAITED -ge $MAX_WAIT ]; then
            echo "❌ Timeout esperando DNS para $DB_HOST"
            break
        fi
        sleep 1
        WAITED=$((WAITED + 1))
    done

    if getent hosts "$DB_HOST" >/dev/null 2>&1; then
        echo "✅ DNS resuelto: $DB_HOST -> $(getent hosts $DB_HOST | awk '{print $1}')"
    fi

    export DATABASE_URL="postgresql://postgres:${DB_PASSWORD}@${DB_HOST}:5432/task_tracker_ai"
    echo "✅ DATABASE_URL construida con host: $DB_HOST"
fi

echo "🚀 Iniciando aplicación..."

# Ejecutar el comando pasado (npm run dev o lo que sea)
exec "$@"
