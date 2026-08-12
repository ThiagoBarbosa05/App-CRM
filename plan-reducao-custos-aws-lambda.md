# Reduzir custo de deploy: parar de manter a instância Autoscale acordada 24/7

## Context

O app está publicado no Replit com `deploymentTarget = "cloudrun"` (Autoscale) — modelo que cobra por
tempo de compute e só é barato se a instância **escala a zero** quando não há tráfego. O gráfico de
monitoramento mostra CPU e memória contínuas durante toda a madrugada, com picos, apesar de não haver
nenhum acesso de usuário. Ou seja: o app está pagando preço de servidor sempre-ligado sem receber o
benefício de escala a zero.

A causa é arquitetural, não um bug: ~20 crons e 2 pollers de alta frequência são registrados em tempo
de import dentro do **mesmo processo que serve HTTP**, sem nenhum gate de ambiente
([server/index.ts:22-40](../../dev/App-CRM/server/index.ts) e `:208-212`). Enquanto esses timers
existirem no processo web, a instância nunca fica ociosa e o Autoscale nunca a desliga.

Confirmado com o usuário: as sessões WhatsApp Baileys rodam num **gateway externo** — este app só
recebe webhooks. Isso é decisivo: o processo web não precisa segurar socket nenhum e *pode*
escalar a zero, desde que os jobs saiam dele.

Objetivo: reduzir o custo de deploy mantendo todos os jobs funcionando com a mesma pontualidade.

---

## Diagnóstico — o que mantém o processo vivo

### Piso constante (o ~5% de CPU da madrugada)

| O quê | Frequência | Arquivo | Função |
|---|---|---|---|
| Worker de inbox de webhooks | **2 s** | `server/services/baileys-gateway-webhook-inbox.service.ts:157` | Drena `baileys_gateway_webhook_inbox`. ~43.200 queries/dia |
| Retomar sessões do bot | **5 s** | `server/jobs/resume-bot-sessions.job.ts:29` | `pool.connect()` + advisory lock por tick. ~17.280 queries/dia |
| Cliente Postgres `LISTEN` | permanente | `server/lib/sse-hub.ts:25-33, :70` | Segundo pool Neon dedicado, cliente preso em `LISTEN whatsapp_sse` desde o boot |

### Crons de 1 minuto (6 jobs, 8.640 execuções/dia)

`campaign-dispatcher.ts:278`, `whatsapp-campaign-dispatcher.ts:181`, `email-campaign-dispatcher.ts:50`,
`sms-campaign-dispatcher.ts:50`, `template-timeouts.job.ts:6`, `reconcile-baileys-status.job.ts:13`
(este último faz HTTP externo ao gateway a cada minuto). Quatro deles repetem a mesma sequência
`pool.connect()` + `pg_try_advisory_lock`, cada um por conta própria.

### Periódicos e diários

5 min: `expire-bot-sessions.job.ts:6`, `bling-sales-order-sync-scheduler.ts:41`,
`assertiva-token-refresh-scheduler.ts:4`. 15 min: `bling-token-refresh-scheduler.ts:19`.
1 h: `birthday-job-scheduler.ts:148` (destrói e recria todos os crons de aniversário).
Diários (America/Sao_Paulo): `update-expired-events` 00:00, **`rfm-recalculate` 03:00 — UPDATE por
cliente em loop, o job mais pesado**, `cashback` e `quote-expiry` 08:00, `reengagement` 08:30,
`copiloto-scan` 09:00. O pico do gráfico às ~6h corresponde ao RFM (03:00 SP = 06:00 UTC).

### Custo por cold start

Todo boot executa, em tempo de import, antes da primeira request: `seedCountries` + 5 migrations
(`server/index.ts:190-207`), `refreshBlingConnections`, `retryPendingBlingSyncs`, `ensureFreshToken`
(Assertiva), os dois scans de `quote-expiry`, `updateExpiredEvents`, `setupBirthdayJobs` e o UPDATE de
recuperação do inbox. No Autoscale isso é pago de novo a cada instância que sobe.

### Tráfego do frontend

Dezenas de `refetchInterval` de 3 s a 60 s (`client/src/hooks/use-whatsapp.ts`,
`use-automation-execution.ts:61,83,127` a 3–5 s, `components/telemarketing/twilio-monitor.tsx:163`
a 5 s, PDV, campanhas) mais endpoints SSE de longa duração. Uma aba esquecida aberta à noite gera
requests reais e segura uma instância de pé sozinha — independente dos crons.

---

## Abordagem recomendada: Web Autoscale + AWS Lambda/EventBridge + Gateway Baileys existente

A recomendação revisada é **não criar, inicialmente, uma segunda Reserved VM para os jobs do CRM**.
Como o gateway Baileys já roda em uma VM separada e precisa permanecer disponível continuamente, o
objetivo passa a ser deixar o deployment web do CRM realmente compatível com Autoscale e mover os
trabalhos periódicos para uma arquitetura serverless.

Arquitetura alvo:

```text
Usuários / integrações
        |
        v
+-----------------------+
| CRM Web - Replit      |
| Autoscale             |
|                       |
| HTTP / API / webhooks |
| sem cron              |
| sem pollers contínuos |
| sem workers           |
+-----------+-----------+
            |
            v
        Neon/Postgres
            ^
            |
  +---------+------------------+
  |                            |
  |                            |
AWS Lambda + EventBridge    Gateway Baileys
Scheduler                  VM já existente
  |                            |
jobs periódicos             sockets WhatsApp
e tarefas agendadas         e trabalho contínuo
```

O princípio é simples:

- **CRM web (Replit Autoscale)**: atende apenas tráfego HTTP, APIs, webhooks e conexões necessárias ao
  usuário. Sem `cron.schedule`, `setInterval` de background ou workers de polling.
- **AWS EventBridge Scheduler + Lambda**: executa tarefas periódicas e termina após a conclusão. Não há
  servidor aguardando o próximo horário.
- **Gateway Baileys (VM existente)**: continua responsável pelo que realmente exige processo
  permanentemente ativo, principalmente sockets e sessões do WhatsApp.
- **Neon/PostgreSQL**: permanece como banco compartilhado entre os componentes, desde que os jobs sejam
  idempotentes e o acesso concorrente seja controlado.

Essa arquitetura evita trocar o problema atual por outro. Criar imediatamente uma segunda Reserved VM
faria o CRM web escalar a zero, mas adicionaria outro servidor permanentemente ligado. Lambda +
EventBridge permite pagar apenas pela execução dos jobs e, no volume atual, há boa possibilidade de
permanecer dentro das franquias gratuitas da AWS.

### 1. Gate único para todo trabalho de background no CRM web

Criar `server/config/runtime-mode.ts` exportando `isWorker` derivado de
`process.env.RUN_JOBS === "true"` (default `false`). No deployment Autoscale de produção, `RUN_JOBS`
deve permanecer ausente/`false`.

Em `server/index.ts`, trocar os imports de efeito colateral dos schedulers por registro explícito e
condicionado. Idealmente o deployment web não importa nenhum scheduler.

Exemplo conceitual:

```ts
const runJobs = process.env.RUN_JOBS === "true";

if (runJobs) {
  const { registerAllJobs } = await import("./jobs/register-all");
  await registerAllJobs();
}
```

Durante a migração, esse gate permite manter compatibilidade com o comportamento antigo. Depois que os
jobs forem transferidos para AWS Lambda/EventBridge, a intenção é que o deployment web use
permanentemente `RUN_JOBS=false`.

O mesmo cuidado vale para trabalho executado no boot. `seedCountries`, migrations, refresh de tokens,
scans e recuperações não devem rodar automaticamente a cada cold start do Autoscale. Migrations e
seeds devem virar uma etapa explícita de deploy/administração; jobs periódicos devem ir para Lambda.

### 2. Migrar cron jobs para AWS EventBridge Scheduler + Lambda

Para cada tarefa periódica, separar a **regra de negócio** do **scheduler** atual.

Hoje:

```ts
cron.schedule("...", async () => {
  // regra de negócio
});
```

Objetivo:

```ts
export async function runRfmRecalculation() {
  // regra de negócio
}
```

No Replit antigo, durante a transição, o scheduler poderia chamar essa função. Na AWS, o handler da
Lambda chama a mesma lógica:

```ts
export const handler = async () => {
  await runRfmRecalculation();
};
```

O EventBridge Scheduler fica responsável pela agenda. Ele suporta schedules recorrentes usando
expressões `cron` ou `rate`, pode invocar Lambda diretamente e permite configurar timezone. Para jobs
em horário comercial do Brasil, usar explicitamente `America/Sao_Paulo` em vez de converter
manualmente para UTC.

#### Classificação inicial dos jobs

| Job atual | Frequência | Destino recomendado |
|---|---:|---|
| `update-expired-events` | diário 00:00 | **Lambda + EventBridge** |
| `rfm-recalculate` | diário 03:00 | **Lambda + EventBridge** |
| `cashback` | diário 08:00 | **Lambda + EventBridge** |
| `quote-expiry` | diário 08:00 | **Lambda + EventBridge** |
| `reengagement` | diário 08:30 | **Lambda + EventBridge** |
| `copiloto-scan` | diário 09:00 | **Lambda + EventBridge** |
| `bling-sales-order-sync` | 5 min | **Lambda + EventBridge**, após validar duração |
| `assertiva-token-refresh` | 5 min | **Lambda + EventBridge** |
| `bling-token-refresh` | 15 min | **Lambda + EventBridge** |
| `expire-bot-sessions` | 5 min | **Lambda + EventBridge**, se não exigir precisão de segundos |
| `reconcile-baileys-status` | 1 min hoje | **Lambda + EventBridge**, preferencialmente 5 min |
| `template-timeouts` | 1 min | **Lambda + EventBridge**, validar volume |
| dispatchers de campanha | 1 min | Lambda inicialmente; **fila/event-driven** como evolução |
| inbox Baileys | 2 s | **Não usar Lambda agendada**; remover polling/redesenhar |
| `resume-bot-sessions` | 5 s | **Não usar Lambda agendada**; remover polling/redesenhar |

A granularidade mínima do EventBridge Scheduler é adequada para jobs de 1 minuto ou mais. Os pollers de
2 s e 5 s não devem ser simplesmente reproduzidos em Lambda.

### 3. Free Tier e limites que precisam entrar na decisão

Na data desta revisão, a AWS informa para Lambda uma franquia mensal de **1.000.000 de requisições**
e **400.000 GB-s de computação**. Para EventBridge Scheduler, a AWS informa **14.000.000 de
invocações agendadas por mês** dentro da franquia gratuita.

Exemplo: um job executado a cada minuto gera aproximadamente:

```text
60 * 24 * 30 = 43.200 invocações/mês
```

Mesmo dez schedules por minuto dariam aproximadamente 432.000 invocações/mês. Isso não garante custo
zero, pois memória, duração, logs, tráfego de rede e outros serviços também contam, mas mostra que o
volume de invocações atual é compatível com a escala do Free Tier.

A duração máxima de uma invocação Lambda padrão é de **15 minutos**. Portanto, antes de migrar jobs
pesados — principalmente RFM e sincronizações grandes — medir o tempo real. Se algum job puder
ultrapassar esse limite, ele precisa ser otimizado, particionado ou movido para outro mecanismo.

Evitar colocar as Lambdas em VPC privada sem necessidade. Como o Neon é externo e acessível pela
Internet, adicionar NAT Gateway apenas para chegar ao banco pode criar custo de infraestrutura muito
maior do que o próprio Lambda. Adotar VPC somente se houver requisito técnico ou de segurança que a
justifique.

### 4. Primeiro job piloto: RFM

O RFM é um bom candidato para a primeira migração porque:

1. roda apenas uma vez por dia;
2. já aparece como o job mais pesado no diagnóstico;
3. é fácil comparar duração/custo antes e depois;
4. permite validar acesso Lambda -> Neon sem mexer ainda nos fluxos críticos do WhatsApp.

Fluxo:

```text
03:00 America/Sao_Paulo
        |
        v
EventBridge Scheduler
        |
        v
AWS Lambda: rfm-recalculate
        |
        v
Neon/PostgreSQL
        |
        v
CloudWatch Logs / métricas
```

Antes da migração, otimizar `rfm-recalculate-scheduler.ts` para eliminar UPDATE por cliente e executar
a operação em lote com `UPDATE ... FROM (...)`. Isso reduz tempo de execução e consumo tanto no banco
quanto na Lambda.

### 5. Campanhas: Lambda como etapa de transição, SQS como arquitetura alvo

Os quatro dispatchers de campanha hoje consultam periodicamente o banco. Eles podem ser migrados para
Lambda + EventBridge a cada minuto como primeira etapa, eliminando a necessidade de manter o CRM web
acordado.

Entretanto, a arquitetura alvo deve evitar polling:

```text
Usuário inicia campanha
        |
        v
CRM grava campanha
        |
        v
SQS
        |
        v
Lambda consumer
        |
        +--> WhatsApp
        +--> e-mail
        +--> SMS
```

Com SQS, o processamento passa a ocorrer porque existe trabalho, em vez de uma função perguntar ao
banco a cada minuto se existe algo para fazer.

Durante a evolução, manter idempotência por mensagem/campanha, limites de concorrência e rate limiting
dos provedores.

### 6. Inbox Baileys: não migrar o polling de 2 s para Lambda

O worker `baileys_gateway_webhook_inbox` é um dos principais alvos de otimização. A solução não é
transformar o polling de 2 segundos em um cron Lambda.

Arquitetura preferida:

```text
WhatsApp
   |
   v
Gateway Baileys
   |
   +---- webhook HTTP ----> CRM Autoscale
```

Se for necessário desacoplar processamento e aumentar confiabilidade:

```text
WhatsApp
   |
   v
Gateway Baileys
   |
   v
AWS SQS
   |
   v
Lambda
   |
   v
Neon/PostgreSQL
```

A tabela `baileys_gateway_webhook_inbox` pode continuar existindo temporariamente para idempotência,
auditoria ou retry, mas não deveria exigir uma consulta ao banco a cada 2 segundos sem trabalho.

### 7. `resume-bot-sessions`: eliminar polling de 5 segundos

O job atual consulta o banco aproximadamente 17.280 vezes por dia. Não faz sentido reproduzir essa
frequência em EventBridge/Lambda.

Opções, em ordem de preferência:

1. agendar a retomada de cada sessão com um mecanismo orientado a evento/horário;
2. publicar uma mensagem com delay/controle de tempo em uma fila apropriada;
3. manter temporariamente o worker na VM do gateway, usando `MIN(resume_at)` para dormir até o próximo
   horário em vez de consultar a cada 5 segundos.

A terceira opção é a menor mudança durante a migração e aproveita a VM que já está paga.

### 3. Reduzir o piso de CPU do worker (aplica-se mesmo se ficar tudo junto)

- **Inbox worker 2 s → 10 s com backoff adaptativo**: manter 2 s enquanto o último batch processou
  algo, cair para 10–15 s após N batches vazios. Elimina ~35 mil queries/dia ociosas.
- **`resume-bot-sessions` 5 s → tick adaptativo pelo mesmo critério**, ou consultar o `MIN(resume_at)`
  das sessões aguardando e dormir até lá em vez de sondar.
- **Unificar os 4 dispatchers de campanha** num único tick de 1 min que pega o advisory lock uma vez e
  chama os quatro `runTick`, em vez de 4 conexões independentes por minuto.
- **`reconcile-baileys-status` 1 min → 5 min** — é reconciliação defensiva, o webhook é o caminho
  primário.
- **RFM (`rfm-recalculate-scheduler.ts`)**: substituir o loop de UPDATE por cliente por um único
  `UPDATE ... FROM (SELECT ...)` em lote. É o pico visível do gráfico e o ganho mais direto.
- **`birthday-job-scheduler.ts:148`**: parar de destruir/recriar todos os crons de hora em hora;
  recarregar só quando a configuração mudar (invalidação a partir da rota que edita a automação).

### 8. Cortar tráfego noturno do frontend

Em `client/src/lib/queryClient.ts` (que já define `refetchInterval: false` como default, `:75`),
garantir `refetchIntervalInBackground: false` — o padrão do TanStack Query já é esse, então a ação real
é auditar os hooks que sobrescrevem o default e confirmar que nenhum força background refetch. Os mais
agressivos (`use-automation-execution.ts` a 3 s, `twilio-monitor.tsx` a 5 s) devem ficar condicionados
a um estado ativo (`enabled:`), no padrão já usado em
`client/src/pages/restaurant-pdv/table-map.tsx:98` (`refetchInterval: cashSessionOpen ? 15000 : false`).

Nas rotas SSE, fechar conexões inativas por tempo (ex.: 30 min sem evento) para que uma aba esquecida
não segure a instância a noite toda.

### Fora de escopo, mas anotado

`server/index.ts:255` faz `listen` em `127.0.0.1` com `0.0.0.0` comentado; e os handlers de
SIGTERM/SIGINT (`:264-270`) chamam `process.exit(0)` sem parar crons nem fechar pools — o worker vai
querer shutdown limpo. Tratar em passo separado.

---

## Arquivos principais

- `server/index.ts` — gate `isWorker`, imports de job, bloco de migrations `:190-207`, `:208-212`
- `server/config/runtime-mode.ts` (novo), `server/jobs/register-all.ts` (novo)
- Todos os `server/jobs/*-scheduler.ts` — converter `cron.schedule` de topo de módulo para `start*()`
- `server/services/baileys-gateway-webhook-inbox.service.ts:157` — intervalo adaptativo
- `server/jobs/resume-bot-sessions.job.ts:29` — intervalo adaptativo
- `server/jobs/rfm-recalculate-scheduler.ts` — UPDATE em lote
- `client/src/hooks/use-automation-execution.ts`, `components/telemarketing/twilio-monitor.tsx` — `enabled:`
- `.replit` — segundo deployment/worker

## Plano de migração por fases

### Fase 1 — preparar o CRM para escalar a zero

1. Implementar `RUN_JOBS=false` como default.
2. Remover todos os schedulers/imports com efeito colateral do processo web.
3. Tirar migrations, seeds e jobs automáticos do cold start.
4. Confirmar que o CRM continua recebendo APIs e webhooks normalmente.
5. Auditar SSE e `refetchInterval` do frontend.

### Fase 2 — piloto AWS com RFM

1. Extrair a lógica do RFM para uma função reutilizável.
2. Converter o UPDATE por cliente em operação SQL em lote.
3. Criar uma Lambda Node.js para executar o job.
4. Configurar segredo/variável para acesso ao Neon.
5. Criar EventBridge Scheduler às 03:00 em `America/Sao_Paulo`.
6. Configurar timeout, memória e retry de forma conservadora.
7. Executar manualmente em ambiente controlado.
8. Comparar resultado com a execução atual.
9. Habilitar schedule apenas depois da validação.

### Fase 3 — migrar jobs periódicos simples

Migrar, um por vez:

- `update-expired-events`
- `cashback`
- `quote-expiry`
- `reengagement`
- `copiloto-scan`
- refreshes de token
- sincronizações de 5/15 min
- `reconcile-baileys-status`
- `template-timeouts`

Após cada migração, desativar o scheduler equivalente no Replit antes de habilitar definitivamente a
AWS, evitando execução duplicada.

### Fase 4 — eliminar os pollers de alta frequência

1. Inbox Baileys 2 s: migrar para webhook direto ou SQS -> Lambda.
2. `resume-bot-sessions` 5 s: substituir por scheduling orientado ao próximo `resume_at`, fila ou,
   temporariamente, worker eficiente na VM do gateway.
3. Garantir idempotência e retry em todos os consumidores.

### Fase 5 — campanhas orientadas a fila

1. Manter Lambda + EventBridge como solução transitória se necessário.
2. Introduzir SQS para itens de campanha.
3. Consumir SQS com Lambda.
4. Aplicar rate limits por canal/provedor.
5. Remover polling dos dispatchers quando o fluxo por fila estiver estabilizado.

## Verificação

1. `npm run dev` sem `RUN_JOBS` -> nenhum scheduler inicia no boot.
2. Deployment web Autoscale -> nenhum cron/poller rodando em background.
3. Neon -> ausência de queries periódicas originadas pelo web quando não existem requests, exceto
   conexões realmente necessárias como SSE/LISTEN enquanto houver cliente conectado.
4. Lambda piloto -> logs mostram início, término, duração e ausência de erro.
5. EventBridge -> execução no timezone esperado.
6. RFM -> comparar quantidade de clientes/classificações antes e depois para garantir equivalência.
7. Confirmar que nenhum job executa simultaneamente na AWS e no scheduler antigo.
8. Configurar alarmes básicos para falha de Lambda e/ou DLQ nos fluxos críticos.
9. Após deploy, comparar 24-72 h do gráfico do Autoscale. Esperado: durante a madrugada sem usuários e
   sem webhooks, o deployment web chega a zero.
10. Comparar custo do Replit antes/depois e custo total da AWS, incluindo CloudWatch e eventual tráfego.

## Arquitetura final pretendida

```text
                         +----------------------+
Usuários / integrações ->| CRM Replit Autoscale |
                         | HTTP/API/Webhooks     |
                         | SEM CRON/POLLING      |
                         +----------+-----------+
                                    |
                                    v
                              Neon/Postgres
                               ^         ^
                               |         |
              +----------------+         +----------------+
              |                                           |
+-------------+-------------+                +------------+-----------+
| AWS Lambda               |                | Gateway Baileys VM     |
| + EventBridge Scheduler  |                | processo 24/7 existente|
| jobs periódicos          |                | sockets WhatsApp       |
+-------------+-------------+                +------------------------+
              |
              | evolução
              v
            SQS
              |
              v
         Lambda consumers
```

A criação de uma **segunda Reserved VM** deixa de ser a abordagem padrão e passa a ser plano de
contingência: usar apenas se houver workload contínuo que não possa ser convertido para Lambda,
EventBridge, SQS ou acomodado com segurança na VM do gateway já existente.

## Fontes externas verificadas para a revisão AWS

- AWS Lambda Pricing — Free Tier: 1 milhão de requests e 400.000 GB-s por mês:
  https://aws.amazon.com/lambda/pricing/
- Amazon EventBridge Pricing — Scheduler: 14 milhões de invocações/mês no Free Tier:
  https://aws.amazon.com/eventbridge/pricing/
- AWS Lambda + EventBridge Scheduler:
  https://docs.aws.amazon.com/lambda/latest/dg/with-eventbridge-scheduler.html
- EventBridge Scheduler — cron/rate e timezone:
  https://docs.aws.amazon.com/eventbridge/latest/userguide/using-eventbridge-scheduler.html
- AWS Lambda timeout — até 900 segundos / 15 minutos:
  https://docs.aws.amazon.com/lambda/latest/dg/configuration-timeout.html
