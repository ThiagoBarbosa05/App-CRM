# Sincronização de Tags Umbler → CRM

Sistema de sincronização automática de tags do Umbler para o CRM, respeitando rate limits e implementando boas práticas.

## 📋 Visão Geral

- **Direção:** Umbler → CRM (unidirecional)
- **Source of Truth:** Umbler
- **Rate Limit:** 100 requests / 5 segundos
- **Estratégia:** Pull-based com snapshot local
- **Volume:** ~5.000 clientes CRM, ~10.000 contatos Umbler

## 🏗️ Arquitetura

### Componentes

1. **Schema** (`shared/schema.ts`): Tabela `umbler_contact_snapshot`
2. **Repository** (`repositories/umbler-sync.repository.ts`): Operações de banco
3. **Service** (`services/umbler-sync.service.ts`): Lógica de sincronização
4. **Worker** (`jobs/umbler-sync.worker.ts`): Job de sincronização
5. **Routes** (`routes/umbler-sync.routes.ts`): API de controle
6. **Utils** (`lib/umbler-sync-utils.ts`): Rate limiter, hash, normalização

### Fluxo de Sincronização

```
1. Worker busca batch de 100 clientes do CRM
2. Para cada cliente:
   a. Normaliza telefone para E.164 (+5511999999999)
   b. Verifica cache de "não encontrado" (7 dias)
   c. Aguarda rate limit (100 req/5s)
   d. Consulta Umbler API (com retry)
   e. Calcula hash das tags
   f. Compara com snapshot local
   g. Se mudou: atualiza tags no CRM
   h. Atualiza snapshot
3. Throttle de 60ms entre requisições (~16 req/s safe rate)
```

## 🚀 Como Usar

### 1. Executar Migration

```bash
# Aplicar migration no banco de dados
psql -U postgres -d crm_db -f server/db/migrations/add_umbler_contact_snapshot.sql
```

Ou use sua ferramenta de migration preferida (Drizzle Kit, etc.).

### 2. Sincronização Manual (API)

#### Disparar sincronização

```bash
POST /api/umbler-sync/trigger
Content-Type: application/json

{
  "batchSize": 100  // opcional, default: 100
}
```

Resposta:

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

#### Ver estatísticas

```bash
GET /api/umbler-sync/stats
```

Resposta:

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

#### Sincronizar cliente específico

```bash
POST /api/umbler-sync/sync-client/:clientId
```

#### Ver status

```bash
GET /api/umbler-sync/status
```

#### Limpar snapshots órfãos

```bash
POST /api/umbler-sync/cleanup
```

### 3. Sincronização Automatizada (Cron)

#### Opção A: Node Cron (package.json)

Adicione ao `package.json`:

```json
{
  "scripts": {
    "sync:umbler": "tsx server/jobs/umbler-sync.worker.ts"
  }
}
```

#### Opção B: Crontab do Sistema

```bash
# Editar crontab
crontab -e

# Executar a cada 30 minutos
*/30 * * * * cd /home/thiago/dev/App-CRM && npm run sync:umbler >> /var/log/umbler-sync.log 2>&1

# Ou a cada hora
0 * * * * cd /home/thiago/dev/App-CRM && npm run sync:umbler >> /var/log/umbler-sync.log 2>&1
```

#### Opção C: Integração com Job Scheduler Existente

Se você já usa um sistema de jobs (Bull, Bee-Queue, etc.), adicione:

```typescript
import { runSyncWorker } from "./jobs/umbler-sync.worker";

// Adicionar ao seu scheduler
queue.process("umbler-sync", async (job) => {
  return await runSyncWorker(100);
});

// Agendar job
queue.add(
  "umbler-sync",
  {},
  {
    repeat: { cron: "*/30 * * * *" }, // A cada 30 minutos
  }
);
```

## 📊 Monitoramento

### Logs Estruturados

```typescript
[UmblerSync] Starting sync for 100 clients
[UmblerSync] Progress: 10/100
[UmblerSync] Progress: 20/100
...
[UmblerSync] Batch sync completed {
  processed: 100,
  synced: 15,
  notFound: 5,
  errors: 0,
  duration: '45000ms'
}
```

### Métricas Importantes

- **Taxa de sincronização:** clientes processados / hora
- **Taxa de mudança:** % de clientes com tags alteradas
- **Taxa de erro:** % de falhas na API
- **Cache hit rate:** % de clientes pulados por "não encontrado"

### Alertas Recomendados

- ⚠️ Taxa de erro > 5%
- ⚠️ Sync travado por > 1 hora
- ⚠️ Rate limit atingido com frequência
- ⚠️ > 10% de clientes com status "error"

## 🔧 Configuração

### Rate Limiting

O sistema implementa dois níveis de controle:

1. **Window-based:** 100 requests / 5 segundos
2. **Throttle:** 60ms entre requests (~16 req/s safe rate)

Editar em `lib/umbler-sync-utils.ts`:

```typescript
// Ajustar limites
const rateLimiter = new RateLimiter(100, 5); // 100 req, 5 segundos

// Ajustar throttle
await this.rateLimiter.throttle(); // Padrão: 60ms
```

### Batch Size

Controla quantos clientes são processados por execução:

```typescript
// Batch pequeno (mais frequente)
await runSyncWorker(50);

// Batch médio (padrão)
await runSyncWorker(100);

// Batch grande (menos frequente)
await runSyncWorker(200);
```

### Cache de "Não Encontrado"

Clientes não encontrados no Umbler são ignorados por 7 dias:

Editar em `repositories/umbler-sync.repository.ts`:

```typescript
// Mudar de 7 para N dias
sql`(${umblerContactSnapshot.notFoundAt} IS NULL OR ${umblerContactSnapshot.notFoundAt} < NOW() - INTERVAL '7 days')`;
```

## 🛡️ Segurança e Confiabilidade

### Idempotência

- Todas as operações são idempotentes
- É seguro executar múltiplas vezes
- Snapshots garantem consistência

### Retry com Backoff

- Máximo: 3 tentativas
- Delays: 1s, 2s, 4s (exponencial)
- Configurável em `lib/umbler-sync-utils.ts`

### Transações

- Updates de CRM + snapshot são atômicos
- Rollback automático em caso de falha

### Circuit Breaker

O service detecta quando há sync em andamento:

```typescript
if (umblerSyncService.isSyncInProgress()) {
  throw new Error("Sync already in progress");
}
```

## 🧪 Testes

### Testar Rate Limiter

```typescript
import { RateLimiter } from "./lib/umbler-sync-utils";

const limiter = new RateLimiter(100, 5);

// Simular 150 requests
for (let i = 0; i < 150; i++) {
  await limiter.waitForSlot();
  console.log(`Request ${i + 1}`);
}
```

### Testar Hash de Tags

```typescript
import { calculateTagsHash } from "./lib/umbler-sync-utils";

const tags1 = [
  { id: "tag1", name: "VIP" },
  { id: "tag2", name: "Premium" },
];

const tags2 = [
  { id: "tag2", name: "Premium" },
  { id: "tag1", name: "VIP" },
];

console.log(calculateTagsHash(tags1) === calculateTagsHash(tags2)); // true
```

### Testar Normalização de Telefone

```typescript
import { normalizePhoneToE164 } from "./lib/umbler-sync-utils";

console.log(normalizePhoneToE164("(11) 99999-9999")); // +5511999999999
console.log(normalizePhoneToE164("11999999999")); // +5511999999999
console.log(normalizePhoneToE164("+5511999999999")); // +5511999999999
```

## 📈 Performance

### Tempo Estimado

Para 5.000 clientes:

- Batch de 100 clientes
- ~50 execuções necessárias
- ~3 segundos por batch (com rate limiting)
- **Total: ~2.5 minutos para ciclo completo**

### Otimizações Implementadas

- ✅ Snapshot local evita consultas desnecessárias
- ✅ Cache de "não encontrado" (7 dias)
- ✅ Hash para detectar mudanças
- ✅ Priorização de clientes nunca sincronizados
- ✅ Batch processing

## 🐛 Troubleshooting

### Problema: Rate limit atingido

**Sintoma:** Erros 429 da API Umbler

**Solução:**

```typescript
// Aumentar throttle
await this.rateLimiter.throttle(); // De 60ms para 100ms
```

### Problema: Sync muito lento

**Sintoma:** Ciclo completo demora > 10 minutos

**Solução:**

```typescript
// Reduzir throttle (cuidado com rate limit)
await this.rateLimiter.throttle(); // De 60ms para 40ms
```

### Problema: Muitos erros

**Sintoma:** > 5% de clientes com status "error"

**Investigação:**

```bash
# Ver erros no banco
SELECT error_message, COUNT(*)
FROM umbler_contact_snapshot
WHERE sync_status = 'error'
GROUP BY error_message;
```

### Problema: Tags não atualizam

**Verificar:**

1. Snapshot está sendo atualizado?
2. Hash está mudando?
3. `clientsRepository.syncClientTags` está funcionando?

```bash
# Ver snapshots recentes
SELECT * FROM umbler_contact_snapshot
WHERE last_synced_at > NOW() - INTERVAL '1 hour'
ORDER BY last_synced_at DESC
LIMIT 10;
```

## 📝 Roadmap Futuro

- [ ] Dashboard de monitoramento em tempo real
- [ ] Alertas via email/Slack
- [ ] Métricas de performance (Prometheus/Grafana)
- [ ] Feature flag para habilitar/desabilitar sync
- [ ] Sync seletivo por setor/categoria
- [ ] Histórico de mudanças de tags

## 🔗 Referências

- [Plano de implementação](plano-sincronizacao-umbler-crm.md)
- API Umbler: `/contacts/phone`
- Rate limit: 100 req / 5s
