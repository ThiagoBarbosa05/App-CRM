# Exemplos de Uso - API de Sincronização Umbler

Este arquivo contém exemplos práticos de como usar a API de sincronização.

## 📡 Endpoints Disponíveis

### 1. Disparar Sincronização Manual

**Endpoint:** `POST /api/umbler-sync/trigger`

**Descrição:** Dispara uma sincronização manual de um batch de clientes

**Body (opcional):**

```json
{
  "batchSize": 100 // Padrão: 100
}
```

**Exemplo com curl:**

```bash
curl -X POST http://localhost:5000/api/umbler-sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 100}'
```

**Resposta de sucesso:**

```json
{
  "success": true,
  "message": "Sync completed successfully. Processed 100 clients.",
  "data": {
    "clientsProcessed": 100,
    "clientsSynced": 15,
    "clientsNotFound": 5,
    "clientsError": 0,
    "duration": 45000
  }
}
```

**Resposta de erro (sync em andamento):**

```json
{
  "success": false,
  "error": "Sync already in progress"
}
```

---

### 2. Ver Estatísticas de Sincronização

**Endpoint:** `GET /api/umbler-sync/stats`

**Descrição:** Retorna estatísticas gerais da sincronização

**Exemplo com curl:**

```bash
curl http://localhost:5000/api/umbler-sync/stats
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "total": 5000,
    "synced": 4500,
    "pending": 400,
    "notFound": 90,
    "error": 10,
    "lastSyncDate": "2026-01-15T10:30:00.000Z"
  }
}
```

**Interpretação:**

- `total`: Total de clientes ativos no CRM
- `synced`: Clientes já sincronizados com sucesso
- `pending`: Clientes aguardando sincronização
- `notFound`: Clientes não encontrados no Umbler (cache de 7 dias)
- `error`: Clientes com erro na última tentativa
- `lastSyncDate`: Data da última sincronização bem-sucedida

---

### 3. Sincronizar Cliente Específico

**Endpoint:** `POST /api/umbler-sync/sync-client/:clientId`

**Descrição:** Força a sincronização de um cliente específico

**Exemplo com curl:**

```bash
curl -X POST http://localhost:5000/api/umbler-sync/sync-client/cli_abc123
```

**Resposta de sucesso:**

```json
{
  "success": true,
  "message": "Client cli_abc123 synced successfully"
}
```

**Resposta de erro:**

```json
{
  "success": false,
  "error": "Failed to sync client: Invalid phone format: (11) 9999"
}
```

---

### 4. Ver Status Atual

**Endpoint:** `GET /api/umbler-sync/status`

**Descrição:** Verifica se há sincronização em andamento e estatísticas

**Exemplo com curl:**

```bash
curl http://localhost:5000/api/umbler-sync/status
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "isRunning": false,
    "stats": {
      "total": 5000,
      "synced": 4500,
      "pending": 400,
      "notFound": 90,
      "error": 10,
      "lastSyncDate": "2026-01-15T10:30:00.000Z"
    }
  }
}
```

---

### 5. Limpar Snapshots Órfãos

**Endpoint:** `POST /api/umbler-sync/cleanup`

**Descrição:** Remove snapshots de clientes que foram deletados do CRM

**Exemplo com curl:**

```bash
curl -X POST http://localhost:5000/api/umbler-sync/cleanup
```

**Resposta:**

```json
{
  "success": true,
  "message": "Cleanup completed. Deleted 15 orphaned snapshots.",
  "data": {
    "deletedCount": 15
  }
}
```

---

## 🔄 Casos de Uso Comuns

### Caso 1: Primeira Sincronização (Setup Inicial)

```bash
# 1. Verificar quantos clientes precisam ser sincronizados
curl http://localhost:5000/api/umbler-sync/stats

# 2. Iniciar primeira sincronização (batch pequeno para teste)
curl -X POST http://localhost:5000/api/umbler-sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'

# 3. Verificar resultado
curl http://localhost:5000/api/umbler-sync/stats

# 4. Se ok, processar batch maior
curl -X POST http://localhost:5000/api/umbler-sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 100}'
```

### Caso 2: Sincronização Agendada (Cron)

```bash
# Adicionar ao crontab (a cada 30 minutos)
crontab -e

# Adicionar linha:
*/30 * * * * cd /home/thiago/dev/App-CRM && npm run sync:umbler >> logs/umbler-sync.log 2>&1
```

### Caso 3: Sincronizar Cliente Após Cadastro

```javascript
// No código do CRM, após criar/atualizar cliente
async function afterClientUpdate(clientId) {
  try {
    await fetch(
      `http://localhost:5000/api/umbler-sync/sync-client/${clientId}`,
      {
        method: "POST",
      }
    );
    console.log(`Cliente ${clientId} sincronizado`);
  } catch (error) {
    console.error("Erro ao sincronizar:", error);
  }
}
```

### Caso 4: Dashboard de Monitoramento

```javascript
// Buscar estatísticas a cada minuto
setInterval(async () => {
  const response = await fetch("http://localhost:5000/api/umbler-sync/status");
  const data = await response.json();

  console.log("Status:", data.data.isRunning ? "Sincronizando" : "Parado");
  console.log("Progresso:", data.data.stats.synced, "/", data.data.stats.total);
}, 60000);
```

### Caso 5: Manutenção Semanal

```bash
#!/bin/bash

# Script de manutenção semanal
echo "=== Manutenção Umbler Sync ==="

# 1. Limpar snapshots órfãos
echo "Limpando snapshots órfãos..."
curl -X POST http://localhost:5000/api/umbler-sync/cleanup

# 2. Ver estatísticas
echo "Estatísticas atuais:"
curl http://localhost:5000/api/umbler-sync/stats

# 3. Sincronizar clientes com erro
# (implementar endpoint específico se necessário)

echo "=== Manutenção concluída ==="
```

---

## 🧪 Testes e Debug

### Testar Rate Limiter

```bash
# Disparar múltiplas sincronizações rápidas
for i in {1..5}; do
  echo "Tentativa $i"
  curl -X POST http://localhost:5000/api/umbler-sync/trigger \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 10}'
  echo ""
done

# Apenas a primeira deve executar, as outras devem retornar erro "already in progress"
```

### Verificar Logs

```bash
# Ver últimas linhas do log
tail -f logs/umbler-sync.log

# Buscar erros
grep ERROR logs/umbler-sync.log

# Contar clientes sincronizados hoje
grep "clientsSynced" logs/umbler-sync-$(date +%Y%m%d).log | wc -l
```

### Debug de Cliente Específico

```bash
# 1. Verificar dados do cliente no CRM
curl http://localhost:5000/api/clients/cli_abc123

# 2. Tentar sincronizar
curl -X POST http://localhost:5000/api/umbler-sync/sync-client/cli_abc123

# 3. Verificar snapshot no banco
psql -U postgres -d crm_db -c "SELECT * FROM umbler_contact_snapshot WHERE crm_client_id = 'cli_abc123'"
```

---

## 📊 Queries Úteis no Banco

### Ver clientes com erro

```sql
SELECT
  c.id,
  c.name,
  c.phone,
  s.error_message,
  s.retry_count,
  s.last_checked_at
FROM clients c
JOIN umbler_contact_snapshot s ON c.id = s.crm_client_id
WHERE s.sync_status = 'error'
ORDER BY s.last_checked_at DESC;
```

### Ver clientes não encontrados

```sql
SELECT
  c.id,
  c.name,
  c.phone,
  s.not_found_at
FROM clients c
JOIN umbler_contact_snapshot s ON c.id = s.crm_client_id
WHERE s.sync_status = 'not_found'
ORDER BY s.not_found_at DESC;
```

### Ver última sincronização por cliente

```sql
SELECT
  c.id,
  c.name,
  s.last_synced_at,
  s.sync_status,
  LENGTH(s.tags_json) as tags_size
FROM clients c
LEFT JOIN umbler_contact_snapshot s ON c.id = s.crm_client_id
ORDER BY s.last_synced_at DESC NULLS LAST
LIMIT 10;
```

### Estatísticas por status

```sql
SELECT
  sync_status,
  COUNT(*) as count,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage
FROM umbler_contact_snapshot
GROUP BY sync_status
ORDER BY count DESC;
```

---

## 🚨 Troubleshooting

### Erro: "Sync already in progress"

**Causa:** Outra sincronização está executando

**Solução:**

```bash
# Verificar status
curl http://localhost:5000/api/umbler-sync/status

# Aguardar conclusão ou reiniciar servidor se travado
```

### Erro: "Invalid phone format"

**Causa:** Telefone do cliente não está no formato correto

**Solução:**

```sql
-- Atualizar telefone no CRM
UPDATE clients
SET phone = '+5511999999999'
WHERE id = 'cli_abc123';

-- Tentar sincronizar novamente
```

### Erro: Rate limit (429)

**Causa:** Muitas requisições para a API do Umbler

**Solução:**

```bash
# Aguardar 5 segundos e tentar novamente
sleep 5
curl -X POST http://localhost:5000/api/umbler-sync/trigger
```

---

## 📈 Monitoramento de Performance

### Script de monitoramento contínuo

```bash
#!/bin/bash

while true; do
  echo "=== $(date) ==="

  # Buscar status
  STATUS=$(curl -s http://localhost:5000/api/umbler-sync/status)

  # Extrair valores (requer jq)
  IS_RUNNING=$(echo $STATUS | jq -r '.data.isRunning')
  SYNCED=$(echo $STATUS | jq -r '.data.stats.synced')
  TOTAL=$(echo $STATUS | jq -r '.data.stats.total')

  # Calcular percentual
  PERCENT=$(echo "scale=2; $SYNCED * 100 / $TOTAL" | bc)

  echo "Status: $IS_RUNNING"
  echo "Progresso: $SYNCED / $TOTAL ($PERCENT%)"
  echo ""

  sleep 60
done
```

### Alertas via webhook

```javascript
// Monitorar taxa de erro e alertar se > 5%
async function checkAndAlert() {
  const response = await fetch("http://localhost:5000/api/umbler-sync/stats");
  const data = await response.json();

  const errorRate = (data.data.error / data.data.total) * 100;

  if (errorRate > 5) {
    // Enviar alerta (Slack, email, etc.)
    await fetch("https://hooks.slack.com/services/YOUR/WEBHOOK/URL", {
      method: "POST",
      body: JSON.stringify({
        text: `🚨 Taxa de erro na sincronização Umbler: ${errorRate.toFixed(
          2
        )}%`,
      }),
    });
  }
}

// Executar a cada 10 minutos
setInterval(checkAndAlert, 10 * 60 * 1000);
```
