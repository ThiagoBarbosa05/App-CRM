# Sistema de Controle de Execuções de Automação

## Visão Geral

Este documento descreve o novo sistema implementado para cancelar automações em andamento e gerenciar o catch-up manualmente no sistema de automações de aniversário.

## ✨ Funcionalidades Implementadas

### 1. **Rastreamento de Execuções**

- Nova tabela `automation_executions` no banco de dados
- Registra cada execução com status detalhado
- Permite monitoramento em tempo real

### 2. **Cancelamento de Execuções**

- ✅ Cancelar execução específica
- ✅ Cancelar todas as execuções em andamento
- ✅ Cancelamento gracioso (respeita mensagens já enviadas)

### 3. **Gerenciamento de Catch-up**

- ✅ Iniciar catch-up manualmente (automações do dia)
- ✅ Iniciar catch-up completo (últimos 7 dias)
- ✅ Parar catch-up em execução
- ✅ Verificar status do catch-up

## 🗄️ Estrutura do Banco de Dados

### Tabela `automation_executions`

```typescript
{
  id: string (UUID)
  automationId: string (FK)
  executionType: "scheduled" | "manual" | "catchup"
  status: "queued" | "running" | "completed" | "cancelled" | "failed"
  targetDate: string (YYYY-MM-DD)
  scheduledTime: string (HH:mm)
  startedAt: timestamp
  completedAt: timestamp
  cancelledAt: timestamp
  cancelledBy: string (user ID)
  totalClients: number
  processedClients: number
  successfulMessages: number
  failedMessages: number
  errorMessage: string
  metadata: JSON
  createdAt: timestamp
  updatedAt: timestamp
}
```

## 🔧 Arquitetura

### Service Layer

**`AutomationExecutionService`** (`server/services/automation-execution.service.ts`)

- Gerencia ciclo de vida das execuções
- Controla cancelamento via flags em memória
- Atualiza progresso em tempo real

### Controllers

1. **`get-executions.controller.ts`**

   - `getExecutionsController`: Lista todas execuções
   - `getRunningExecutionsController`: Execuções em andamento
   - `getExecutionHistoryController`: Histórico por automação

2. **`cancel-execution.controller.ts`**

   - `cancelExecutionController`: Cancela execução específica
   - `cancelAllExecutionsController`: Cancela todas

3. **`catchup.controller.ts`**
   - `startCatchupController`: Inicia catch-up
   - `stopCatchupController`: Para catch-up
   - `getCatchupStatusController`: Status do catch-up
   - `executeFullCatchupController`: Catch-up completo

### Rotas API

```
GET    /api/automation/executions                    # Listar execuções
GET    /api/automation/executions/running            # Execuções ativas
GET    /api/automation/executions/history/:id        # Histórico
POST   /api/automation/executions/:id/cancel         # Cancelar uma
POST   /api/automation/executions/cancel-all         # Cancelar todas
GET    /api/automation/catchup/status                # Status catch-up
POST   /api/automation/catchup/start                 # Iniciar catch-up
POST   /api/automation/catchup/stop                  # Parar catch-up
POST   /api/automation/catchup/full                  # Catch-up completo
```

## 💻 Interface do Usuário

### Hooks React

**`use-automation-execution.ts`**

```typescript
// Consulta
useAutomationExecutions(page, pageSize);
useRunningExecutions();
useExecutionHistory(automationId, limit);
useCatchupStatus();

// Mutação
useCancelExecution();
useCancelAllExecutions();
useStartCatchup();
useStopCatchup();
useExecuteFullCatchup();
```

### Componente UI

Nova seção "Controle de Execuções" em `automation-management.tsx`:

- 📊 Mostra execuções em andamento
- 🔴 Botão para cancelar cada execução
- ⛔ Botão para cancelar todas
- 🎯 Status do catch-up em tempo real
- ▶️ Botões para iniciar catch-up (hoje ou completo)
- ⏹️ Botão para parar catch-up

## 🔄 Fluxo de Execução

### 1. Execução Agendada (Cron)

```
Cron dispara às 09:00
  ↓
Cria registro de execução (status: queued)
  ↓
Inicia execução (status: running)
  ↓
Processa clientes (verifica cancelamento a cada iteração)
  ↓
Atualiza progresso a cada 5 clientes
  ↓
Finaliza (status: completed/cancelled/failed)
```

### 2. Cancelamento

```
Usuário clica "Cancelar"
  ↓
Flag de cancelamento é setada na memória
  ↓
Banco atualizado (status: cancelled)
  ↓
Loop de processamento verifica flag
  ↓
Interrompe processamento
  ↓
Registra execução como cancelada
```

### 3. Catch-up

```
Usuário clica "Iniciar Catch-up"
  ↓
Service marca catch-up como "running"
  ↓
Busca automações perdidas
  ↓
Cria execuções para cada automação
  ↓
Processa cada uma (com verificação de cancelamento)
  ↓
Finaliza e limpa flag
```

## 🎯 Boas Práticas Implementadas

### 1. **Separação de Responsabilidades**

- Service: Lógica de negócio
- Controller: Manipulação de requisições
- Routes: Definição de endpoints

### 2. **Type Safety**

- Interfaces TypeScript para todos os tipos
- Validação de dados em runtime

### 3. **Performance**

- Cache em memória para verificação rápida de cancelamento
- Atualização de progresso em lotes (a cada 5 clientes)
- Queries otimizadas com paginação

### 4. **Experiência do Usuário**

- Feedback em tempo real
- Confirmação antes de ações destrutivas
- Atualização automática a cada 3-5 segundos

### 5. **Resiliência**

- Execuções podem ser retomadas
- Cancelamento gracioso (não perde progresso)
- Logs detalhados para debugging

## 📝 Exemplos de Uso

### Backend (API)

```typescript
// Cancelar uma execução
await AutomationExecutionService.cancelExecution(executionId, userId);

// Verificar se foi cancelada
if (AutomationExecutionService.isCancelled(executionId)) {
  console.log("Execução foi cancelada, interrompendo...");
  break;
}

// Atualizar progresso
await AutomationExecutionService.updateProgress(
  executionId,
  processed,
  successful,
  failed
);
```

### Frontend (React)

```typescript
// Listar execuções em andamento
const { data: running } = useRunningExecutions();

// Cancelar uma execução
const cancelMutation = useCancelExecution();
cancelMutation.mutate(executionId);

// Iniciar catch-up
const startCatchup = useStartCatchup();
startCatchup.mutate();

// Verificar status
const { data: status } = useCatchupStatus();
if (status?.isRunning) {
  console.log("Catch-up em execução!");
}
```

## 🚀 Como Testar

### 1. Testar Cancelamento de Execução Individual

1. Acesse a interface de automações
2. Clique em "Executar Automações do Dia"
3. Observe a execução aparecer em "Controle de Execuções"
4. Clique em "Cancelar" na execução
5. Verifique que o status muda para "cancelled"

### 2. Testar Cancelamento em Massa

1. Execute múltiplas automações (ou use catch-up)
2. Clique em "Cancelar Todas"
3. Confirme a ação
4. Todas as execuções devem ser canceladas

### 3. Testar Catch-up

1. Clique em "Iniciar Catch-up (Hoje)"
2. Observe o indicador de "Catch-up em Execução"
3. Clique em "Parar" para cancelar
4. Verifique que o catch-up foi interrompido

### 4. Testar Catch-up Completo

1. Clique em "Catch-up Completo (7 dias)"
2. Observe múltiplas execuções serem criadas
3. Monitore o progresso de cada uma

## ⚠️ Considerações Importantes

### 1. **Cancelamento Gracioso**

- Mensagens já enviadas não são afetadas
- O cancelamento ocorre entre o processamento de clientes
- Pode levar alguns segundos para efetivar

### 2. **Estado Distribuído**

- Flags de cancelamento são mantidas em memória
- Em ambientes com múltiplas instâncias, cada instância tem seu próprio cache
- Recomendado usar uma única instância ou implementar cache distribuído (Redis)

### 3. **Limpeza de Dados**

- Execuções antigas podem ser limpas periodicamente
- Manter últimos 30 dias por padrão

### 4. **Segurança**

- Adicionar autenticação nas rotas
- Validar permissões (apenas admin pode cancelar?)
- Log de quem cancelou (auditoria)

## 🔮 Melhorias Futuras

1. **WebSockets para Updates em Tempo Real**

   - Push de atualizações sem polling
   - Notificações instantâneas

2. **Dashboard de Métricas**

   - Gráficos de execuções
   - Taxa de sucesso/falha
   - Tempo médio de execução

3. **Retry Automático**

   - Re-executar automações que falharam
   - Configurar número de tentativas

4. **Agendamento Personalizado**

   - Agendar execuções para horários específicos
   - Criar execuções recorrentes

5. **Cache Distribuído**
   - Usar Redis para flags de cancelamento
   - Suportar múltiplas instâncias da aplicação

## 📚 Referências

- [Schema Database](../../shared/schema.ts)
- [Automation Execution Service](../../server/services/automation-execution.service.ts)
- [API Routes](../../server/routes/automation-execution.routes.ts)
- [React Hooks](../../client/src/hooks/use-automation-execution.ts)
- [UI Component](../../client/src/components/automation-management.tsx)

---

**Autor:** Sistema de Automação CRM  
**Data:** Dezembro 2025  
**Versão:** 1.0
