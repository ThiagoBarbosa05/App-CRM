# Auditoria do fluxo de campanhas WhatsApp

Data da análise: 16 de agosto de 2026  
Escopo: criação, preview, segmentação, agendamento, enfileiramento, disparo, deduplicação, pausa, retomada, cancelamento, retry, webhooks, métricas e observabilidade.

## Resumo executivo

O fluxo atual possui boas proteções pontuais — opt-out, normalização de telefone, deduplicação por conteúdo, retry com backoff e lock global entre instâncias —, mas ainda apresenta riscos importantes de autorização, consistência transacional, concorrência e escalabilidade.

Principais riscos:

1. A criação e o enfileiramento não são atômicos e podem deixar campanhas parcialmente criadas.
2. Uma campanha totalmente suprimida é persistida como concluída, embora a API responda erro.
3. Pausar, retomar e cancelar podem responder sucesso sem alterar nenhuma campanha.
4. Campanhas futuras podem disparar antes da hora após pausa e retomada.
5. Falhas de entrega posteriores podem deixar campanha, contadores e deduplicação divergentes.
6. As rotas não aplicam autorização consistente por proprietário, organização ou canal.
7. O dispatcher globalmente serializado pode atrasar todas as campanhas.
8. Preview, preparação da audiência e envio fazem consultas repetidas por contato e escalam mal.

## Fluxo atual

1. A tela cria um registro genérico em `campaigns` por `POST /api/campaigns`.
2. Solicita o preview de audiência e deduplicação por `POST /api/whatsapp/campaigns/preview`.
3. Cria `whatsapp_campaigns`, mensagens e reservas de dedupe por `POST /api/whatsapp/campaigns`.
4. O dispatcher roda a cada minuto e promove campanhas vencidas de `created` para `in_progress`.
5. Cada campanha processa até 25 mensagens por tick, sequencialmente e com delay configurado globalmente.
6. Cada mensagem termina como `sent`, `delivered`, `read`, `failed`, `cancelled` ou `suppressed`, ou volta a `scheduled` para retry.
7. Quando não restam mensagens `scheduled`, a campanha é finalizada.

## Constatações detalhadas

### 1. P0 — Usuários podem acessar e controlar campanhas alheias

**Status: corrigido em 16 de agosto de 2026.**

No estado auditado, as rotas tinham autenticação global, mas listagem, detalhes, estatísticas, pausa, retomada, cancelamento, retry e reaplicação de etiquetas não validavam consistentemente `createdBy`, organização ou canais permitidos. A listagem consultava todas as campanhas em [`campaign-logger.ts`](../server/controllers/campaigns/campaign-logger.ts#L294), e os detalhes consultavam diretamente pelo ID em [`campaign-logger.ts`](../server/controllers/campaigns/campaign-logger.ts#L323). A criação restringia parcialmente os canais para vendedores em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L270), mas as ações posteriores não reaplicavam essa regra.

**Impacto:** exposição de nomes e telefones, consulta fora de escopo e cancelamento ou reenvio de campanhas de outros usuários.

**Correção aplicada:** todo o prefixo `/api/whatsapp/campaigns` e o prefixo legado `/api/umbler/campaigns` exigem role `admin` ou `gerente`. No router misto `/api/campaigns`, campanhas com `waEnabled`, `umblerEnabled` ou registro em `whatsapp_campaigns` são omitidas da listagem de vendedores, não podem ser criadas ou ativadas por eles e retornam `403 FORBIDDEN` em qualquer operação por ID. Isso inclui detalhes, clientes, triggers, progresso, estatísticas, chamadas, dispatch, edição e exclusão. Campanhas exclusivamente de telemarketing permanecem acessíveis aos vendedores.

O frontend também mantém vendedores fora das telas de campanhas WhatsApp e disponibiliza o módulo para administradores e gerentes. A API é a fronteira efetiva de segurança; ocultar a navegação é apenas uma proteção adicional de interface.

### 2. P1 — Criação e enfileiramento não são atômicos

O frontend grava primeiro `campaigns` e depois chama os endpoints de preview e enfileiramento em [`use-whatsapp.ts`](../client/src/hooks/use-whatsapp.ts#L488). O segundo endpoint cria o cabeçalho, insere suprimidos, monta o snapshot, reserva mensagens e recalcula contadores sem uma transação única em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L365).

Se uma etapa intermediária falhar, podem permanecer cabeçalho, mensagens ou reservas parciais. A compensação do frontend tenta apagar a campanha genérica, mas o endpoint de limpeza recusa quando já existe `whatsapp_campaigns`, mesmo incompleto, em [`campaigns.routes.ts`](../server/routes/campaigns.routes.ts#L335).

**Recomendação:** consolidar criação, snapshot, audiência, mensagens, impactos e contadores em um único serviço/transação backend e expor uma única chamada ao frontend.

### 3. P1 — Campanha totalmente suprimida é persistida e reportada como erro

Após persistir a campanha e as mensagens suprimidas, a rota lança `CAMPAIGN_ALL_DUPLICATE` quando `queued === 0` em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L538). Antes disso, marca a campanha como `completed` porque não existem mensagens agendadas em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L512).

O frontend entende que houve falha e tenta limpar, mas a limpeza é bloqueada pela existência do dispatch.

**Recomendação:** escolher uma semântica única: bloquear antes de qualquer gravação ou criar com sucesso uma campanha concluída e informar que todos os contatos foram protegidos/suprimidos.

### 4. P1 — Corrida entre submissões pode sobrescrever a configuração

A checagem de campanha existente ocorre por `SELECT` antes dos inserts em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L343). Sem lock ou transação abrangente, duas requisições podem observar ausência de execução e ambas atualizar audiência, horário, dedupe e etiqueta.

O índice por `(campaignId, contactId)` protege parte das mensagens, mas não protege a configuração nem audiências diferentes.

**Recomendação:** adquirir lock transacional da campanha ou fazer criação exclusiva antes de qualquer gravação derivada.

### 5. P1 — Retry pode reenfileirar mensagem sem reserva de dedupe válida

O retry altera mensagens para `scheduled` e atualiza impacts de `released` para `reserved` em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L167), mas não confirma que toda mensagem reenfileirada recuperou uma reserva.

Também ignora conflitos criados por outras campanhas depois da falha. Isso facilita tentar novamente a mesma mensagem, mas pode repetir conteúdo que outra campanha enviou nesse intervalo.

**Recomendação:** validar a relação um-para-um entre mensagem e impact e tornar o override de dedupe explícito e auditável, ou revalidar apenas conflitos externos.

### 6. P1 — Pausar, retomar e cancelar podem retornar sucesso sem alteração

Pausa e retomada não verificam linhas afetadas em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L602) e [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L619). Um ID inexistente ou uma transição inválida pode retornar `200` e gerar toast positivo.

O cancelamento aceita qualquer estado e também pode responder sucesso para ID inexistente em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L636).

**Recomendação:** implementar máquina de estados explícita, usar `.returning()` e devolver `404` para inexistente e `409` para transição inválida.

### 7. P1 — Retomar campanha futura ignora o agendamento original

Uma campanha futura pode ser pausada enquanto está `created`, mas a retomada sempre define `in_progress`, independentemente de `startDate`, em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L619). Ela pode disparar no próximo tick antes do horário programado.

**Recomendação:** retomar para `created` quando `startDate > now` e para `in_progress` somente quando o horário já venceu.

### 8. P1 — Cancelamento não interrompe mensagem já em voo

O executor consulta o estado antes de cada destinatário em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L132), mas o cancelamento pode ocorrer depois dessa checagem e antes da resposta do provedor. A mensagem ainda pode ser aceita e marcada como enviada.

**Trade-off:** chamadas externas não são transacionais; cancelamento imediato é necessariamente best effort.

**Recomendação:** registrar `cancelRequestedAt`, distinguir solicitação de cancelamento de cancelamento efetivo e mostrar quantas mensagens estavam em voo.

### 9. P1 — Falha de entrega posterior contradiz estado e contadores

A campanha é finalizada quando não restam mensagens `scheduled`. Depois, um webhook pode mudar uma mensagem de `sent` para `failed` em [`whatsapp-campaign-status.service.ts`](../server/services/whatsapp-campaign-status.service.ts#L48), sem reconciliar `whatsapp_campaigns.status`, `sentMessages`, `failedMessages` ou `completedAt`.

**Recomendação:** definir se `completed` significa “processada” ou “entregue sem falhas”. No segundo caso, reconciliar os agregados no webhook; no primeiro, renomear ou apresentar o estado de forma mais precisa.

### 10. P2 — Retry mantém contadores antigos até o próximo dispatcher

O retry muda a campanha para `in_progress` e limpa `completedAt`, mas os contadores antigos permanecem até a próxima finalização/recontagem em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L234).

**Impacto:** a UI pode mostrar campanha em andamento com todas as mensagens ainda contabilizadas como falhas.

**Recomendação:** recalcular os contadores na mesma transação do retry.

### 11. P1 — Um lock global serializa todas as campanhas

O cron mantém um único advisory lock durante todo o `runTick`, incluindo chamadas externas e delays, em [`whatsapp-campaign-dispatcher.ts`](../server/jobs/whatsapp-campaign-dispatcher.ts#L180).

**Trade-off:** evita envio simultâneo por múltiplas instâncias, mas reduz throughput, ocupa uma conexão do pool e faz uma campanha lenta atrasar todas as outras.

**Recomendação:** usar claim/lease por mensagem ou campanha, `FOR UPDATE SKIP LOCKED` e concorrência limitada por canal.

### 12. P1 — Preview faz uma consulta de dedupe por contato

O preview chama `findConflict()` sequencialmente para cada cliente em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L139). Audiências grandes podem produzir milhares de consultas e timeout.

O trabalho ainda é repetido no enfileiramento.

**Recomendação:** consultar conflitos em lote por CTE/tabela temporária ou combinar preview e criação em uma única operação backend que devolva o resumo persistido.

### 13. P2 — Enfileiramento é serial e contém busca O(n²)

Cada contato abre transação, adquire lock, consulta conflito e insere mensagem/impact em [`whatsapp-campaign-dedupe.service.ts`](../server/services/whatsapp-campaign-dedupe.service.ts#L232). No loop, `clientRows.find()` procura novamente o cliente em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L443), tornando essa parte O(n²).

**Recomendação:** criar um `Map` por ID, processar reservas em chunks e estabelecer limite ou fila assíncrona para audiências grandes.

### 14. P2 — Revalidação da audiência faz consultas individuais por envio

Cada mensagem consulta novamente o cliente e pode executar subconsultas de etiquetas em [`whatsapp-campaign-audience.service.ts`](../server/services/whatsapp-campaign-audience.service.ts#L62).

**Trade-off:** captura opt-out e alterações de segmentação no último instante, melhorando compliance, mas reduz throughput e aumenta carga no banco.

**Recomendação:** manter a revalidação, porém buscar clientes e etiquetas em lote para cada batch.

### 15. P2 — Campos legados não representam a execução atual

`whatsapp_campaigns` exige campos como `botId`, `channelId`, `fromPhone` e `organizationId`, mas o fluxo atual grava valores artificiais como `"whatsapp"` e strings vazias em [`whatsapp.routes.ts`](../server/routes/whatsapp.routes.ts#L365). Os dados reais ficam na tabela genérica `campaigns`.

**Impacto:** duas fontes de verdade, integridade fraca, relatórios ambíguos e isolamento organizacional inviável com `organizationId` vazio.

**Recomendação:** migrar para referências reais ou separar formalmente a estrutura legada da estrutura moderna.

### 16. P2 — Intervalo da campanha é ignorado

A tabela possui `intervalSeconds`, e a criação grava `1`, mas o executor usa `wa_message_delay_ms` global em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L39).

**Trade-off:** o delay global simplifica a proteção da conta, mas impede adequação por canal, tier ou volume.

**Recomendação:** remover o campo obsoleto ou torná-lo efetivo com limites mínimos por canal.

### 17. P2 — Logs e erros ocultam falhas operacionais

Faltam métricas estruturadas de duração, atraso de fila, retries, canal/provider, throughput e rate limit. Funções de consulta capturam exceções e retornam `[]` ou `null`, como em [`campaign-logger.ts`](../server/controllers/campaigns/campaign-logger.ts#L299), transformando falha de banco em “nenhuma campanha” ou “não encontrada”.

**Recomendação:** propagar erros à rota, usar IDs de correlação e publicar métricas por estado, campanha e canal.

### 18. P2 — Inbox pode divergir do envio real

Depois de o provedor aceitar uma mensagem, a persistência no inbox é best effort. Uma falha apenas gera log em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L659).

**Impacto:** destinatário recebe e campanha mostra envio, mas o CRM pode não exibir a mensagem; histórico, roteamento de resposta e fallback de status ficam incompletos.

**Recomendação:** criar outbox/reconciliação para reparar registros de conversa sem reenviar a mensagem externa.

### 19. P2 — Snapshot do bot limita a deduplicação a 25 saídas

A assinatura percorre o grafo e para após 25 mensagens de abertura em [`whatsapp-campaign-dedupe.service.ts`](../server/services/whatsapp-campaign-dedupe.service.ts#L98).

**Trade-off:** limita o custo, mas bots que diferem após esse limite podem produzir a mesma assinatura. O algoritmo também não possui versionamento explícito.

**Recomendação:** incluir versão do bot/configuração e versão do algoritmo no snapshot e documentar se a deduplicação considera somente a abertura ou o fluxo completo.

### 20. P2 — Batch não possui ordenação determinística

A consulta de mensagens `scheduled` usa `limit`, mas não ordena por `scheduledAt`, `nextAttemptAt`, criação ou ID em [`whatsapp-campaign.service.ts`](../server/services/whatsapp-campaign.service.ts#L282).

**Impacto:** ordem imprevisível, competição pouco clara entre retries e mensagens novas e troubleshooting menos reprodutível.

**Recomendação:** ordenar por `COALESCE(nextAttemptAt, scheduledAt)`, seguido de `createdAt` e `id`.

## Testes executados

Foi executado o conjunto direcionado:

```text
npm run test:unit -- --run server/services/__tests__/whatsapp-campaign-*.unit.test.ts server/routes/__tests__/whatsapp-campaigns-post.routes.test.ts server/routes/__tests__/whatsapp-retry-failed.routes.test.ts
```

Resultado observado: **2 arquivos de teste e 20 testes aprovados**.

Os testes cobrem principalmente:

- campanha já ativa ou finalizada;
- canal desconectado ou incompatível;
- audiência sem telefone válido ou com opt-out;
- respostas padronizadas de erro;
- bloqueio do retry em estados incompatíveis.

Lacunas recomendadas:

- duas criações simultâneas;
- falha no meio do enfileiramento e rollback;
- campanha 100% suprimida;
- pausa e retomada de campanha futura;
- ações em ID inexistente ou estado inválido;
- cancelamento durante chamada externa;
- webhook de falha após conclusão;
- concorrência entre dispatcher, cancelamento e retry;
- autorização entre usuários e organizações;
- justiça entre múltiplas campanhas;
- recuperação quando a persistência no inbox falha.

## Ordem recomendada de correção

1. Corrigir autorização e isolamento das campanhas.
2. Tornar criação e enfileiramento uma operação backend atômica.
3. Definir a semântica de campanhas 100% suprimidas.
4. Formalizar a máquina de estados e validar todas as transições.
5. Corrigir a retomada de campanhas agendadas.
6. Reconciliar estados e contadores após webhooks de entrega.
7. Introduzir claim/lease e paralelismo limitado por canal.
8. Otimizar preview, resolução de audiência e enfileiramento em lote.
9. Adicionar testes de concorrência e falhas parciais.
10. Melhorar observabilidade e reconciliação do inbox.

## Conclusão

O fluxo possui boas defesas locais, mas as fronteiras entre criação, preparação, execução e atualização assíncrona ainda não formam uma operação consistente de ponta a ponta. A prioridade deve ser proteger autorização e atomicidade antes de aumentar throughput. Em seguida, a máquina de estados, a reconciliação por webhook e a arquitetura do dispatcher devem ser ajustadas para tornar o comportamento previsível sob concorrência e grande volume.
