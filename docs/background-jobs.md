# Jobs de background e custo de Autoscale

## Por que o app não dormia

O deploy é Replit Autoscale (`deploymentTarget = "cloudrun"` no `.replit`), que cobra tempo de
CPU enquanto há requisição em voo e desliga a instância quando não há nenhuma. Três coisas
impediam isso:

1. **SSE.** Cada aba aberta segura um `GET` que nunca termina. Para o Cloud Run é uma requisição
   permanentemente em voo — CPU alocada o tempo todo, instância nunca escala a zero.
2. **Timers no processo web.** `resume-bot-sessions` a cada 5 s, inbox de webhooks a cada 2 s,
   quatro dispatchers de campanha por minuto, mais ~20 crons diários — todos registrados como
   efeito colateral de `import` em `server/index.ts`.
3. **Polling do frontend.** ~35 queries com `refetchInterval`, algumas de 3 s.

Havia ainda um problema de correção, não só de custo: **cron dentro de um serviço que escala a
zero não roda**. Os jobs só funcionavam porque o SSE mantinha tudo aceso — ou seja, dependiam
exatamente daquilo que se queria eliminar.

## Desenho atual

Dois papéis, mesmo código, selecionados por `APP_ROLE`:

| Papel | Onde roda | O que faz |
|---|---|---|
| `web` | Replit Autoscale | Só HTTP: API, estáticos e webhooks. Nenhum cron, nenhum worker, nenhum trabalho no boot. Pode escalar a zero. |
| worker | Replit Scheduled Deployments | Executa **um** grupo de jobs e encerra. Container sobe, roda, morre — paga-se só o tempo de execução. |
| `all` | `npm run dev` | Agenda os grupos no próprio processo, para desenvolver com um processo só. |

`APP_ROLE` tem default `web` quando `NODE_ENV=production` e `all` fora disso.

### Grupos de jobs

Definidos em [`server/jobs/registry.ts`](../server/jobs/registry.ts) — fonte única das expressões
cron, consumida tanto pelos Scheduled Deployments quanto pelo scheduler de desenvolvimento.

| Grupo | Cron (America/Sao_Paulo) | Conteúdo |
|---|---|---|
| `minute` | `* * * * *` | Dispatchers de campanha (WhatsApp, e-mail, SMS, voz), timeouts de template, retomada de sessões de bot, retentativa de webhooks do gateway |
| `frequent` | `*/5 * * * *` | Expiração de sessões de bot, retry de comandas no Bling, automações de aniversário do dia |
| `quarter` | `*/15 * * * *` | Reconciliação de status dos canais com o gateway, refresh dos tokens Bling e Assertiva |
| `daily-night` | `0 0 * * *` | Finaliza eventos cuja data já passou |
| `daily-rfm` | `0 3 * * *` | Recalcula scores RFM |
| `daily-morning` | `0 8 * * *` | Cashback a vencer, alertas de orçamento, reengajamento, fila do Copiloto |
| `bootstrap` | — sob demanda | Seed de países e migrações de dados |

### Configurar no Replit

Um Scheduled Deployment por grupo (exceto `bootstrap`), cada um com:

- **Build:** `npm run build`
- **Run:** `npm run job -- <grupo>`
- **Schedule:** a expressão da tabela acima
- **Secrets:** os mesmos do deployment web (`DATABASE_URL`, `GATEWAY_URL`, etc.)

O `bootstrap` roda manualmente depois de um deploy que mude o schema:

```bash
npm run job -- bootstrap
```

Sem argumento, `npm run job` lista os grupos disponíveis. Um grupo desconhecido sai com código 1,
o que faz o Scheduled Deployment marcar a execução como falha.

## Decisões que valem lembrar

**Webhooks do gateway são event-driven, não polled.** `POST /api/evolution/webhook` responde 202 e
então chama `drainGatewayWebhookInbox()` fora do caminho da resposta. O worker de 2 segundos que
existia antes fazia uma transação por tick mesmo com a fila vazia (~43 mil por dia). O grupo
`minute` só cuida das retentativas e dos eventos presos em `processing` por um container que
morreu no meio.

**O nó "Aguardar" do bot tolera até 1 minuto.** Era verificado a cada 5 segundos — ~17 mil
conexões ao Postgres por dia, quase todas sem nada a fazer, para uma pausa que costuma ser de
minutos ou horas.

**Nada roda no boot.** Seed, migrações, refresh de token e catch-up de aniversário rodavam a cada
subida do processo. Com scale-to-zero isso passaria a ser toda vez que o Autoscale acorda o
container.

**Automações de aniversário não têm mais cron dinâmico.** O desenho antigo mantinha um
`cron.schedule` por automação num mapa em memória, recriado de hora em hora — estado que morre
junto com o container. `executeTodaysAutomations()` (em `automation-catchup.ts`) já foi escrita
para ambiente serverless: lê do banco, checa `shouldExecuteNow` e `wasExecutedToday`, e por isso é
idempotente. Por consequência, `reconfigureBirthdayScheduler()` virou no-op — não há mais
agendamento em memória para reconfigurar.

**A reconciliação de canais degrada por tempo, não por contagem.** `UNREACHABLE_THRESHOLD` era um
contador de falhas consecutivas em memória do processo. No worker, que é efêmero, ele zeraria a
cada execução e nunca atingiria o limite — um gateway fora do ar deixaria "Conectado" na tela para
sempre. Agora a condição é `connection_checked_at` mais velho que 30 minutos: durável e
compartilhado entre réplicas.

**Advisory locks ficam em `server/jobs/lock-keys.ts`.** São um espaço de nomes global no banco.
O dispatcher de e-mail e o `resume-bot-sessions` compartilhavam a chave `727_100_002`, e como o
segundo rodava a cada 5 segundos, o primeiro pulava a maioria dos ticks — sem erro e sem log.
