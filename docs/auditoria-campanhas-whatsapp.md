# Auditoria do fluxo de campanhas WhatsApp — pendências

Data da análise original: 16 de agosto de 2026

Última revisão do estado: 23 de agosto de 2026

Escopo: criação, preview, segmentação, agendamento, enfileiramento, disparo, deduplicação, pausa, retomada, cancelamento, retry, webhooks, métricas e observabilidade.

## Resumo executivo

A criação e o enfileiramento já foram consolidados em uma única transação backend, campanhas totalmente suprimidas agora sofrem rollback, a concorrência de criação não sobrescreve mais uma configuração preexistente e as rotas de campanhas WhatsApp estão restritas a administradores e gerentes.

Restam 16 problemas. Os riscos mais importantes são:

1. Pausa, retomada e cancelamento ainda não implementam uma máquina de estados confiável.
2. Uma campanha futura pode disparar antes da hora depois de ser pausada e retomada.
3. O retry pode reenfileirar mensagens sem restaurar uma reserva de deduplicação válida.
4. Webhooks tardios podem deixar campanha e contadores divergentes das mensagens.
5. Um lock global serializa todas as campanhas e limita throughput e justiça.
6. Preview, enfileiramento e revalidação da audiência ainda fazem trabalho individual por contato.

---

## Problemas pendentes

<!-- ### 1. P1 — Retry pode reenfileirar mensagem sem reserva de dedupe válida

O retry altera todas as mensagens `failed` para `scheduled` e tenta atualizar impacts de `released` para `reserved` em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts). Porém, não compara a quantidade de mensagens reenfileiradas com a quantidade de impacts efetivamente restaurados.

Também ignora conflitos criados por outras campanhas depois da falha. O override é intencional no código, mas não é explícito para o operador nem auditável.

**Correção necessária:** antes de reenfileirar, validar a relação um-para-um entre mensagem e impact. Recriar impacts ausentes de forma segura ou abortar a transação. Tornar o override de dedupe uma decisão explícita, registrada com usuário, data, motivo e conflitos encontrados. -->

<!-- ### 2. P1 — Pausar, retomar e cancelar podem retornar sucesso sem alteração

Pausa e retomada não verificam linhas afetadas em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts). Um ID inexistente ou uma transição inválida ainda pode retornar `200` e gerar toast positivo.

O cancelamento aceita qualquer estado, não verifica se a campanha existe e altera mensagens, impacts e campanha sem uma transação única.

**Correção necessária:** implementar uma máquina de estados explícita, executar cada ação em uma transação e usar `.returning()`. Retornar `404` para campanha inexistente e `409` para transição inválida. Estados terminais não devem aceitar pausa, retomada ou novo cancelamento silenciosamente. -->

<!-- ### 3. P1 — Retomar campanha futura ignora o agendamento original

Uma campanha futura pode ser pausada enquanto está `created`, mas a retomada sempre define `in_progress`, independentemente de `startDate`, em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts).

**Correção necessária:** ao retomar, definir `created` quando `startDate > now` e `in_progress` somente quando o horário já venceu. Cobrir a decisão e a resposta HTTP com testes de rota e serviço. -->

<!-- ### 4. P1 — Cancelamento não interrompe mensagem já em voo

O executor verifica o estado antes de cada destinatário, mas o cancelamento pode ocorrer depois dessa verificação e antes da resposta do provedor. A mensagem ainda pode ser aceita e marcada como enviada.

Chamadas externas não são transacionais; por isso, cancelamento imediato é necessariamente best effort.

**Correção necessária:** registrar `cancelRequestedAt`, distinguir solicitação de cancelamento de cancelamento efetivo e contabilizar mensagens em voo. A interface deve informar que mensagens já entregues ao provedor não podem ser recuperadas. -->

<!-- ### 5. P1 — Falha de entrega posterior contradiz estado e contadores

Depois que uma campanha é finalizada, um webhook pode mudar uma mensagem de `sent` para `failed` em [`whatsapp-campaign-status.service.ts`](../server/services/whatsapp-campaign-status.service.ts). O serviço atualiza apenas a mensagem e não reconcilia `whatsapp_campaigns.status`, `sentMessages`, `failedMessages` ou `completedAt`.

**Correção necessária:** adotar formalmente a semântica de que `completed` significa “processamento concluído”, enquanto entrega e falha são métricas mutáveis. Recalcular os agregados da campanha na mesma transação do webhook e manter `completedAt` como fim do processamento, sem reabrir automaticamente a fila. -->
<!--
### 6. P2 — Retry mantém contadores antigos até o próximo dispatcher

O retry muda a campanha para `in_progress` e limpa `completedAt`, mas preserva contadores antigos até o próximo tick ou finalização.

**Correção necessária:** recalcular `scheduledMessages`, `sentMessages` e `failedMessages` na mesma transação do retry, depois de validar e restaurar os impacts. -->

<!-- ### 7. P1 — Um lock global serializa todas as campanhas

O cron mantém um único advisory lock durante todo o `runTick`, incluindo chamadas externas e delays, em [`whatsapp-campaign-dispatcher.ts`](../server/jobs/whatsapp-campaign-dispatcher.ts).

Isso impede duplicidade entre instâncias, mas uma campanha lenta atrasa todas as outras, ocupa uma conexão do pool e limita o throughput global.

**Correção necessária:** substituir o lock global por claim/lease atômico por mensagem ou campanha, usando `FOR UPDATE SKIP LOCKED`. Permitir concorrência limitada e configurável por canal, sem processar a mesma mensagem em duas instâncias. -->

<!-- ### 8. P1 — Preview faz uma consulta de dedupe por contato

O preview chama `findConflict()` sequencialmente para cada cliente em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts). Audiências grandes podem produzir milhares de consultas e timeout.

O trabalho de audiência, fingerprint e dedupe ainda é repetido na criação.

**Correção necessária:** consultar conflitos em lote por CTE ou tabela temporária. Quando possível, reutilizar na criação um preview persistido e versionado, revalidando apenas alterações concorrentes antes do commit. -->

### 9. P2 — Enfileiramento continua serial

A busca O(n²) existente na auditoria original foi removida, mas cada contato ainda adquire lock, consulta conflito e insere mensagem/impact sequencialmente em uma única transação longa.

**Correção necessária:** preparar fingerprints em memória, reservar mensagens em chunks e definir limite síncrono de audiência. Audiências acima do limite devem usar preparação assíncrona com progresso e falha recuperável.

### 10. P2 — Revalidação da audiência faz consultas individuais por envio

Cada mensagem chama `validateCampaignRecipient()`, que consulta novamente o cliente e pode executar subconsultas de etiquetas em [`whatsapp-campaign-audience.service.ts`](../server/services/whatsapp-campaign-audience.service.ts).

A revalidação deve ser preservada por compliance, especialmente para opt-out e mudanças de telefone.

**Correção necessária:** carregar clientes, telefones, opt-out e etiquetas em lote para cada batch do dispatcher, mantendo a mesma decisão de supressão por destinatário.

### 11. P2 — Campos legados não representam a execução atual

`whatsapp_campaigns` continua exigindo campos como `botId`, `channelId`, `fromPhone` e `organizationId`, mas a criação grava valores artificiais como `"whatsapp"` e strings vazias em [`whatsapp-campaign-creation.service.ts`](../server/services/whatsapp-campaign-creation.service.ts). Os dados reais permanecem em `campaigns`.

**Correção necessária:** definir `campaigns` como fonte canônica e migrar relatórios e consultas para referências reais. Depois, remover ou tornar opcionais os campos legados, com migração explícita para registros existentes.

### 12. P2 — Intervalo da campanha é ignorado

A tabela possui `intervalSeconds`, a criação grava `1`, mas o executor usa apenas `wa_message_delay_ms` global em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts).

**Correção necessária:** remover o campo obsoleto. A proteção de envio deve permanecer centralizada em configuração por canal, com limite mínimo seguro, em vez de aceitar um intervalo por campanha sem governança.

### 13. P2 — Logs e erros ocultam falhas operacionais

Faltam métricas estruturadas de duração, atraso de fila, retries, canal/provider, throughput e rate limit. Funções como `listCampaigns()` e `getCampaignDetails()` capturam exceções e retornam `[]` ou `null` em [`campaign-logger.ts`](../server/controllers/campaigns/campaign-logger.ts), transformando falha de banco em “nenhuma campanha” ou “não encontrada”.

**Correção necessária:** propagar erros à rota, devolver `500` em falha operacional e reservar `404` para ausência confirmada. Adicionar ID de correlação e métricas por campanha, canal, estado e tipo de falha.

### 14. P2 — Inbox pode divergir do envio real

Depois de o provedor aceitar uma mensagem, a persistência em `whatsapp_messages` é best effort. Uma falha apenas gera log em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts).

**Correção necessária:** criar uma outbox de persistência/reconciliação vinculada a `campaignMessageId` e `waMessageId`. O reparo deve reconstruir a conversa sem reenviar a mensagem ao provedor.

### 15. P2 — Snapshot do bot limita a deduplicação a 25 saídas

A assinatura percorre o grafo e para após 25 mensagens de abertura em [`whatsapp-campaign-dedupe.service.ts`](../server/services/whatsapp-campaign-dedupe.service.ts). Bots que diferem depois desse limite podem produzir a mesma assinatura.

O snapshot também não registra uma versão explícita do algoritmo.

**Correção necessária:** incluir versão do bot/configuração e versão do algoritmo no snapshot. Documentar que a deduplicação cobre a abertura alcançável até o limite escolhido, ou substituir o corte por uma representação canônica completa com proteção contra ciclos.

### 16. P2 — Batch não possui ordenação determinística

A consulta de mensagens `scheduled` usa `limit`, mas não ordena por `scheduledAt`, `nextAttemptAt`, criação ou ID em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts).

**Correção necessária:** ordenar por `COALESCE(nextAttemptAt, scheduledAt)`, seguido de `createdAt` e `id`. O mesmo critério deve ser aplicado pelo futuro mecanismo de claim/lease.

---

## Testes necessários

Os testes existentes cobrem criação transacional em nível unitário, autorização por papel, erros básicos de criação, bloqueio de retry por estado, finalização e transições de status de mensagens. Permanecem necessárias as seguintes coberturas:

- retry com impact ausente, impact em estado inesperado e conflito externo;
- pausa, retomada e cancelamento em ID inexistente ou estado inválido;
- retomada de campanha futura e vencida;
- rollback do cancelamento quando a atualização de impacts falha;
- cancelamento durante uma chamada externa em voo;
- webhook de falha depois da conclusão e reconciliação dos agregados;
- concorrência entre dispatcher, cancelamento e retry;
- justiça e exclusão mútua entre múltiplas campanhas e instâncias;
- preview e criação com audiência grande;
- revalidação em lote preservando opt-out, telefone e etiquetas;
- recuperação quando a persistência na conversa falha;
- ordenação determinística entre retries e mensagens novas.

## Ordem recomendada de correção

1. Formalizar a máquina de estados e tornar pausa, retomada e cancelamento transacionais.
2. Corrigir a retomada de campanhas agendadas.
3. Garantir a relação um-para-um entre retry e reserva de dedupe.
4. Recalcular contadores durante retry e webhooks tardios.
5. Introduzir claim/lease e paralelismo limitado por canal.
6. Otimizar preview, enfileiramento e revalidação em lote.
7. Criar outbox de reconciliação da conversa.
8. Resolver campos legados e remover `intervalSeconds`.
9. Versionar o snapshot de deduplicação e ordenar batches.
10. Completar métricas, correlação e propagação de erros.

## Critério de conclusão

Esta auditoria estará encerrada quando os 16 problemas acima tiverem testes automatizados de regressão, as transições de estado e operações críticas forem atômicas, duas instâncias puderem processar campanhas diferentes sem duplicar mensagens e falhas assíncronas puderem ser reconciliadas sem intervenção manual nem reenvio externo.
