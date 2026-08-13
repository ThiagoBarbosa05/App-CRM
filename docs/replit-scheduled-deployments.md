# Checklist — configurar os Scheduled Deployments no Replit

Passo a passo para criar os processos de background. São 5 deployments agendados; o grupo
`bootstrap` não entra aqui porque roda sob demanda.

Contexto de por que isso existe: [`docs/background-jobs.md`](./background-jobs.md).

---

## Antes de começar

- [ ] Fazer o deploy do **Autoscale** (processo web) com o código novo.
- [ ] Confirmar que a variável `APP_ROLE` está como `web` no deployment Autoscale — ou ausente,
      já que `web` é o default quando `NODE_ENV=production`.
- [ ] Ter em mãos os secrets do deployment web. Cada Scheduled Deployment precisa dos **mesmos**:
      `DATABASE_URL`, `GATEWAY_URL`, `GATEWAY_API_KEY`, `WEBHOOK_SIGNING_SECRET`, além dos de
      Bling, Twilio, SendGrid, Assertiva e OpenAI que já estão no web.
- [ ] Conferir que o build gera os dois bundles: `dist/index.js` (web) e `dist/worker.js` (jobs).

> Se um grupo subir sem `DATABASE_URL`, ele falha na primeira query e sai com código 1 — o
> Replit marca a execução como falha. Vale olhar o log da primeira execução de cada um.

---

## Campos comuns a todos os 5

Em **Deployments → Create Deployment → Scheduled**:

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Timezone | `America/Sao_Paulo` |
| Secrets | os mesmos do deployment web |

O que muda entre eles é só o **nome**, o **Run command** e o **schedule**.

---

## Os 5 deployments

### 1. `crm-jobs-minute`

- [ ] Run command: `npm run job -- minute`
- [ ] Schedule: `* * * * *` (a cada minuto)
- [ ] Timeout: 5 minutos

Disparo de campanhas (WhatsApp, e-mail, SMS, voz), timeouts de template, retomada de sessões de
bot em nó "Aguardar" e retentativa de webhooks do gateway que falharam.

> É o mais caro dos cinco, porque paga um cold start por minuto. Se o log mostrar boot acima de
> ~8s, mude para `*/2 * * * *` — o custo é o dobro da latência no disparo de campanha, o que
> costuma ser aceitável.

### 2. `crm-jobs-frequent`

- [ ] Run command: `npm run job -- frequent`
- [ ] Schedule: `*/5 * * * *`
- [ ] Timeout: 10 minutos

Expiração de sessões de bot, retry de comandas no Bling e automações de aniversário do dia.

> É este grupo que dispara as mensagens de aniversário. O horário configurado em cada automação
> continua valendo: `executeTodaysAutomations()` só executa depois que `sendTime` passou, e nunca
> duas vezes no mesmo dia. A granularidade do disparo passa a ser de 5 minutos.

### 3. `crm-jobs-quarter`

- [ ] Run command: `npm run job -- quarter`
- [ ] Schedule: `*/15 * * * *`
- [ ] Timeout: 10 minutos

Reconciliação do status dos canais com o Baileys Gateway e refresh dos tokens Bling e Assertiva.

### 4. `crm-jobs-daily`

- [ ] Run command: `npm run job -- daily-night`
- [ ] Schedule: `0 0 * * *`
- [ ] Timeout: 30 minutos

Finaliza eventos cuja data já passou.

### 5. `crm-jobs-rfm`

- [ ] Run command: `npm run job -- daily-rfm`
- [ ] Schedule: `0 3 * * *`
- [ ] Timeout: 60 minutos

Recalcula os scores RFM. Faz um UPDATE por cliente — dê folga no timeout.

### 6. `crm-jobs-morning`

- [ ] Run command: `npm run job -- daily-morning`
- [ ] Schedule: `0 8 * * *`
- [ ] Timeout: 60 minutos

Cashback a vencer, alertas de orçamento, régua de reengajamento e fila do Copiloto. Roda depois do
RFM das 3h, de que o Copiloto depende.

---

## Depois de criar

- [ ] Rodar `crm-jobs-minute` manualmente ("Run now") e conferir no log:
      `[worker] grupo "minute" concluído em Xms` com saída 0.
- [ ] Repetir para os outros quatro.
- [ ] Se o deploy mudou o schema, rodar o bootstrap uma vez pelo Shell do Replit:

```bash
npm run job -- bootstrap
```

- [ ] No log do deployment **web**, confirmar a linha
      `APP_ROLE=web: jobs de background não são agendados neste processo`
      e a ausência de `[dispatcher]`, `[ResumeBotSessions]` e `[Baileys Gateway Inbox]` periódicos.
- [ ] Acompanhar o gráfico de compute-time do Autoscale por 48h. O sinal de sucesso é a instância
      chegando a zero durante a madrugada.

---

## Se precisar reverter

Basta definir `APP_ROLE=all` no deployment web e pausar os Scheduled Deployments: o processo web
volta a agendar todos os grupos internamente (`server/jobs/dev-scheduler.ts`), como era antes —
com o custo de antes junto.
