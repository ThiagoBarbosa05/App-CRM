#!/bin/bash

# Script de sincronização Umbler → CRM
# Uso: ./scripts/umbler-sync.sh [batch_size]

set -e

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/umbler-sync-$(date +%Y%m%d).log"
BATCH_SIZE="${1:-100}"

# Criar diretório de logs se não existir
mkdir -p "$LOG_DIR"

# Função de log
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Início
log "=========================================="
log "Iniciando sincronização Umbler → CRM"
log "Batch size: $BATCH_SIZE"
log "=========================================="

# Navegar para o diretório do projeto
cd "$PROJECT_ROOT"

# Executar worker
log "Executando worker de sincronização..."

if npm run sync:umbler >> "$LOG_FILE" 2>&1; then
  log "✅ Sincronização concluída com sucesso"
  EXIT_CODE=0
else
  log "❌ Erro na sincronização"
  EXIT_CODE=1
fi

# Cleanup de logs antigos (manter últimos 30 dias)
find "$LOG_DIR" -name "umbler-sync-*.log" -type f -mtime +30 -delete

log "=========================================="
log "Fim da sincronização"
log "=========================================="

exit $EXIT_CODE
