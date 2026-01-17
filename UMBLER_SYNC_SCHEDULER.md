# Umbler Sync - Scheduler Automático

O scheduler de sincronização Umbler → CRM executa automaticamente em segundo plano.

## 🚀 Configuração Padrão

- **Frequência:** A cada 5 minutos
- **Horário:** Das 8h às 22h (horário de Brasília)
- **Batch:** 100 clientes por execução
- **Expressão Cron:** `*/5 8-22 * * *`

## 📊 Para ~5000 clientes:

- 50 execuções necessárias para ciclo completo
- ~4 horas por ciclo completo (50 × 5min)
- ~6 ciclos completos por dia
- Rate limit respeitado: 100 req/5s

## 🎛️ Gerenciamento via API

### Verificar status do scheduler

```bash
curl http://localhost:5000/api/umbler-sync/status | jq '.data.scheduler'
```

### Parar scheduler

```bash
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/stop
```

### Iniciar scheduler

```bash
# Com configuração padrão
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/start

# Com cron customizado (a cada 10 minutos, 24/7)
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/start \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "*/10 * * * *"}'
```

### Reiniciar scheduler

```bash
# Mantém configuração atual
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart

# Com nova configuração
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "0 */2 * * *"}'
```

## ⏰ Expressões Cron Comuns

```bash
"*/5 8-22 * * *"     # A cada 5 min, das 8h às 22h (padrão)
"*/10 * * * *"       # A cada 10 min, 24/7
"0 */2 * * *"        # A cada 2 horas
"0 9,14,18 * * *"    # Às 9h, 14h e 18h
"*/5 8-18 * * 1-5"   # A cada 5 min, horário comercial, dias úteis
"0 0 * * *"          # Diariamente à meia-noite
"0 */4 * * *"        # A cada 4 horas
```

## 📝 Logs

O scheduler registra logs automaticamente:

```
[UmblerSyncScheduler] 🚀 Iniciando scheduler com expressão: */5 8-22 * * *
[UmblerSyncScheduler] ⏰ Executando sincronização agendada - 2025-01-15T14:30:00Z
[UmblerSyncScheduler] ✅ Sincronização concluída com sucesso
[UmblerSyncScheduler] 📊 Estatísticas: {
  "clientsProcessed": 100,
  "clientsSynced": 95,
  "clientsNotFound": 3,
  "clientsError": 2,
  "duration": 12500
}
[UmblerSyncScheduler] ⏱️ Execução finalizada em 12500ms
```

## 🛠️ Inicialização

O scheduler inicia automaticamente quando a aplicação sobe:

```typescript
// No server/index.ts
import "./jobs/umbler-sync-scheduler";
```

## 🔄 Auto-restart

O scheduler reinicia automaticamente se:
- Aplicação é reiniciada
- Servidor sofre restart
- PM2/nodemon detecta mudanças

## 📊 Monitoramento

```bash
# Status completo
curl http://localhost:5000/api/umbler-sync/status

# Apenas scheduler
curl http://localhost:5000/api/umbler-sync/status | jq '.data.scheduler'

# Monitoramento contínuo
watch -n 30 'curl -s http://localhost:5000/api/umbler-sync/status | jq .data.scheduler'
```

## 🚨 Troubleshooting

### Scheduler não está executando

```bash
# 1. Verificar status
curl http://localhost:5000/api/umbler-sync/status | jq '.data.scheduler.isActive'

# 2. Se false, iniciar
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/start

# 3. Se true mas não executa, reiniciar
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart
```

### Execuções muito frequentes

```bash
# Reduzir frequência para a cada 10 minutos
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "*/10 8-22 * * *"}'
```

### Timezone incorreto

O scheduler usa timezone "America/Sao_Paulo" (GMT-3).

## ⚙️ Configuração Avançada

### Ajustar para horário comercial estendido

```bash
# 7h às 23h
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "*/5 7-23 * * *"}'
```

### Executar apenas em dias úteis

```bash
# Segunda a sexta, 8h às 18h
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "*/5 8-18 * * 1-5"}'
```

### Executar 24/7 em produção

```bash
curl -X POST http://localhost:5000/api/umbler-sync/scheduler/restart \
  -H "Content-Type: application/json" \
  -d '{"cronExpression": "*/5 * * * *"}'
```

## 🎯 Boas Práticas

1. **Monitorar logs** - Verificar execuções regularmente
2. **Ajustar horários** - Evitar horários de pico se possível
3. **Rate limit** - Respeitar limite de 100 req/5s (automático)
4. **Limpeza** - Executar cleanup semanal de snapshots órfãos
5. **Backup** - Manter snapshots para rollback se necessário

## 🔐 Segurança

O scheduler:
- Não requer autenticação (processo interno)
- Respeita rate limits automaticamente
- Tem graceful shutdown em SIGTERM/SIGINT
- Não expõe dados sensíveis nos logs
