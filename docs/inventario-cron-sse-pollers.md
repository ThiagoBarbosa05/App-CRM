# Inventário de cron jobs, SSE e pollers

> Levantamento estático da aplicação realizado em 12 de agosto de 2026.

## 1. Escopo e critérios

Este documento inventaria os mecanismos recorrentes encontrados em `server/` e
`client/src/`:

- cron jobs executados pelo `node-cron`;
- workers baseados em `setInterval` no backend;
- streams SSE (Server-Sent Events);
- pollers explícitos do frontend, incluindo `refetchInterval` do TanStack Query;
- schedulers disponíveis, mas não ativados automaticamente.

Não são tratados como pollers os timers usados apenas para debounce, animação,
rolagem, duração de gravação, duração de chamada ou atraso entre mensagens.

Todos os horários de negócio usam `America/Sao_Paulo`, salvo quando indicado.
Os jobs carregados automaticamente podem ser conferidos no bootstrap em
[`server/index.ts`](../server/index.ts).

## 2. Resumo executivo

- Há 21 famílias de jobs/workers recorrentes ativas no backend, incluindo jobs
  dinâmicos de aniversário e rotinas de manutenção em memória.
- O scheduler Umbler existe e pode ser controlado por API, mas seu auto-start
  está desativado.
- Há nove famílias de streams SSE, com heartbeat a cada 25 segundos nos hubs
  compartilhados.
- O frontend combina SSE e polling em áreas críticas, principalmente WhatsApp
  e Zernio. Isso melhora a reconciliação após perda de eventos, mas mantém parte
  do custo de tráfego que o SSE deveria eliminar.
- Os menores intervalos do backend são 2 segundos para a inbox de webhooks
  Baileys e 5 segundos para retomada de sessões de bot.
- Alguns jobs têm proteção distribuída com PostgreSQL advisory lock; outros
  dependem de idempotência e podem executar uma vez por réplica.

## 3. Cron jobs e workers recorrentes do backend

### 3.1 Jobs ativos

| Job | Implementação | Frequência | Funcionalidade | Trade-offs |
|---|---|---:|---|---|
| Automações de aniversário dinâmicas | [`birthday-job-scheduler.ts`](../server/jobs/birthday-job-scheduler.ts) | Horário configurado em cada automação | Cria um cron por configuração ativa e dispara mensagens considerando `daysBefore`, horário e deduplicação diária. | Um timer por automação aumenta estado em memória. Mudanças precisam reconfigurar os jobs. Em múltiplas réplicas, a deduplicação precisa impedir disparos repetidos. |
| Recarga de automações de aniversário | [`birthday-job-scheduler.ts`](../server/jobs/birthday-job-scheduler.ts) | `0 * * * *`; em desenvolvimento também `*/5 * * * *` | Relê configurações e recria os crons dinâmicos. | Mudanças podem demorar até uma hora em produção. A recriação periódica gera consultas e complexidade adicional. |
| Catch-up inicial de aniversário | [`birthday-job-scheduler.ts`](../server/jobs/birthday-job-scheduler.ts) | No startup | Recupera automações que deveriam ter executado durante indisponibilidade. | Evita perda de disparos, mas reinícios podem gerar carga ou duplicidade sem idempotência. |
| Atualização de eventos expirados | [`update-expired-events-scheduler.ts`](../server/jobs/update-expired-events-scheduler.ts) | `0 0 * * *`; em desenvolvimento também `* * * * *`; roda no startup | Marca eventos cuja data passou como `finalizado`. | Em produção, o estado pode atrasar até 24 horas. O startup adiciona trabalho aos deploys. |
| Renovação do token Assertiva | [`assertiva-token-refresh-scheduler.ts`](../server/jobs/assertiva-token-refresh-scheduler.ts) | `*/5 * * * *`; roda no startup | Garante que o token OAuth da Assertiva esteja válido. | Até 288 verificações por dia e por réplica. Instâncias diferentes podem tentar renovar simultaneamente. |
| Renovação de conexões Bling | [`bling-token-refresh-scheduler.ts`](../server/jobs/bling-token-refresh-scheduler.ts) | `*/15 * * * *`; roda no startup | Marca conexões expiradas e renova as próximas do vencimento. | Existe uma janela de até 15 minutos. Custo cresce com conexões e réplicas. |
| Retry de pedidos Bling | [`bling-sales-order-sync-scheduler.ts`](../server/jobs/bling-sales-order-sync-scheduler.ts) | `*/5 * * * *`; roda no startup | Reenvia comandas fechadas com sync `pendente`, `erro` ou nulo, respeitando o limite de tentativas. | Recupera falhas eventuais, mas pode gerar rajadas. O envio precisa ser idempotente para não duplicar pedidos. |
| Dispatcher legado de campanhas | [`campaign-dispatcher.ts`](../server/jobs/campaign-dispatcher.ts) | `*/1 * * * *` | Processa a fila do mecanismo legado de campanhas. | Latência de até um minuto. A trava `running` impede sobreposição apenas dentro da mesma instância. Sua coexistência com dispatchers especializados deve ser revisada. |
| Dispatcher de campanhas WhatsApp | [`whatsapp-campaign-dispatcher.ts`](../server/jobs/whatsapp-campaign-dispatcher.ts) | `*/1 * * * *` | Busca lotes agendados, envia mensagens e finaliza campanhas. | Pressão periódica no banco e APIs externas. Usa advisory lock, reduzindo duplicidade entre réplicas. |
| Dispatcher de campanhas de e-mail | [`email-campaign-dispatcher.ts`](../server/jobs/email-campaign-dispatcher.ts) | `*/1 * * * *` | Despacha mensagens de campanhas de e-mail. | Latência de até um minuto. Usa proteção local e advisory lock. |
| Dispatcher de campanhas SMS | [`sms-campaign-dispatcher.ts`](../server/jobs/sms-campaign-dispatcher.ts) | `*/1 * * * *` | Despacha mensagens SMS agendadas. | Além do risco de duplicidade, falhas de idempotência têm custo financeiro. Usa advisory lock. |
| Expiração de sessões de bot | [`expire-bot-sessions.job.ts`](../server/jobs/expire-bot-sessions.job.ts) | `*/5 * * * *` | Encerra sessões inativas há aproximadamente 30 minutos. | Uma sessão pode expirar com atraso de até cinco minutos. A varredura cresce com o volume de sessões. |
| Retomada de sessões pausadas | [`resume-bot-sessions.job.ts`](../server/jobs/resume-bot-sessions.job.ts) | `*/5 * * * * *` | Retoma bots cujo nó `Aguardar` venceu. | Baixa latência, mas executa até 17.280 ticks por dia por réplica. Usa trava compartilhada e proteção local contra sobreposição. |
| Timeout de respostas de template | [`template-timeouts.job.ts`](../server/jobs/template-timeouts.job.ts) | `*/1 * * * *` | Processa sessões que excederam o prazo de resposta a template. | O timeout pode atrasar até um minuto. As regras precisam ser compatíveis com a expiração geral de sessões. |
| Reconciliação de status Baileys | [`reconcile-baileys-status.job.ts`](../server/jobs/reconcile-baileys-status.job.ts) | `*/1 * * * *` | Consulta o gateway, reconcilia o status dos canais, detecta instâncias ausentes/indisponíveis e publica mudanças. | Corrige webhooks perdidos, mas cria polling servidor-gateway proporcional ao número de canais. Possui tolerância a falhas para reduzir falsos `disconnected`. |
| Recálculo RFM | [`rfm-recalculate-scheduler.ts`](../server/jobs/rfm-recalculate-scheduler.ts) | `0 3 * * *` | Recalcula recência, frequência, valor e segmento dos clientes. | Os dados podem ficar desatualizados por até 24 horas. A implementação faz atualizações por cliente e pode ser pesada. |
| Lembretes de cashback | [`cashback-automation-scheduler.ts`](../server/jobs/cashback-automation-scheduler.ts) | `0 8 * * *` | Encontra cashback próximo do vencimento e dispara lembretes conforme regras. | Concentra carga e mensagens às 08:00. Uma indisponibilidade nessa janela exige idempotência/catch-up no serviço. |
| Alertas de orçamento | [`quote-expiry-alert-scheduler.ts`](../server/jobs/quote-expiry-alert-scheduler.ts) | `0 8 * * *`; roda no startup | Notifica sobre orçamentos vencendo em até dois dias e enviados sem validade que estão parados. | O startup pode repetir trabalho. Existe deduplicação de 24 horas, porém com consultas por orçamento. |
| Reengajamento por inatividade | [`reengagement-automation-scheduler.ts`](../server/jobs/reengagement-automation-scheduler.ts) | `30 8 * * *` | Avança clientes elegíveis na régua de reengajamento, respeitando intervalo e máximo de tentativas. | Pode criar pico de mensagens às 08:30. A granularidade diária reduz custo, mas atrasa elegibilidade em até um dia. |
| Varredura do Copiloto | [`copiloto-scan-scheduler.ts`](../server/jobs/copiloto-scan-scheduler.ts) | `0 9 * * *` | Gera cards e oportunidades para vendedores usando sinais do CRM e RFM. | Varredura potencialmente pesada e dados eventualmente consistentes. O comentário do arquivo diz 05:00, mas a expressão efetiva agenda 09:00. |
| Worker da inbox de webhooks Baileys | [`baileys-gateway-webhook-inbox.service.ts`](../server/services/baileys-gateway-webhook-inbox.service.ts) | A cada 2 segundos | Consome em lotes eventos persistidos do gateway, com retry e recuperação de registros após restart. | Baixa latência e boa resiliência, mas chega a 43.200 ticks por dia por processo. Usa `unref()` e bloqueio local contra sobreposição. |
| Limpeza do rate limiter | [`rate-limit.ts`](../server/middleware/rate-limit.ts) | A cada 5 minutos | Remove buckets expirados mantidos em memória. | Evita vazamento de memória. O rate limit continua local ao processo, não distribuído. |
| Limpeza de OAuth/MCP | [`mcp.routes.ts`](../server/routes/mcp.routes.ts) | A cada 15 minutos | Remove authorization codes e access tokens expirados dos mapas em memória. | Implementação simples; entradas expiradas podem permanecer em memória por até 15 minutos. |

### 3.2 Scheduler disponível, mas não ativo automaticamente

O scheduler Umbler em
[`umbler-sync-scheduler.ts`](../server/jobs/umbler-sync-scheduler.ts) usa, por
padrão, `*/5 8-22 * * *`: sincroniza lotes de 100 clientes a cada cinco
minutos, das 08:00 às 22:59.

O import e o auto-start estão comentados no bootstrap. O scheduler pode ser
iniciado, parado ou reconfigurado pelas rotas administrativas de sincronização.

Trade-offs:

- permite operação controlada e uma expressão cron customizada;
- o estado do scheduler é local ao processo;
- em múltiplas réplicas, uma chamada administrativa pode atingir apenas uma
  instância ou ativar mais de um executor;
- o ciclo completo pode levar horas para bases grandes, mas isso limita a carga
  sobre a API Umbler.

### 3.3 Arquivos que não representam jobs ativos

- `birthday-job-example.ts` contém somente exemplos comentados.
- `send-birthday-message.ts` e `send-birthday-mensage.ts` executam lógica de
  envio, mas não registram crons próprios.
- scripts de migração, seed e validação em `server/jobs/` são tarefas pontuais,
  não schedulers recorrentes.
- `pubsub-subscriber.ts` disponibiliza um subscriber, mas sua inicialização não
  foi encontrada no bootstrap atual.

## 4. SSE (Server-Sent Events)

### 4.1 Streams em uso

| Stream/família | Backend | Consumidor | Funcionalidade | Trade-offs específicos |
|---|---|---|---|---|
| Notificações gerais do WhatsApp | Hub SSE e rotas WhatsApp | [`wa-notifications-stream.ts`](../client/src/lib/wa-notifications-stream.ts) | Status e QR de canais, novas conversas e notificações gerais. | O frontend compartilha uma única `EventSource`, reduzindo conexões. Eventos gerais ainda exigem invalidação cuidadosa das queries afetadas. |
| Conversa WhatsApp por ID | [`whatsapp-conversations.routes.ts`](../server/routes/whatsapp-conversations.routes.ts) | [`conversations.tsx`](../client/src/pages/whatsapp/conversations.tsx) | Mensagens, status, reações e mudanças da conversa selecionada. | Atualização imediata e escopo pequeno. Trocas de conversa abrem/fecham conexões e exigem autorização contínua. |
| Conversa WhatsApp por cliente | [`whatsapp-conversations.routes.ts`](../server/routes/whatsapp-conversations.routes.ts) | [`use-client-whatsapp-conversation.ts`](../client/src/hooks/use-client-whatsapp-conversation.ts) | Mantém a ficha do cliente atualizada com sua conversa. | Conversas paralelas do mesmo cliente tornam o roteamento mais delicado. |
| Chat interno geral | [`internal-chat.routes.ts`](../server/routes/internal-chat.routes.ts) | [`useInternalChat.ts`](../client/src/hooks/useInternalChat.ts) | Atualiza lista, criação/alteração de conversas e notificações gerais. | Evita polling da lista, mas cada aba conectada ocupa uma conexão persistente. |
| Conversa do chat interno | [`internal-chat.routes.ts`](../server/routes/internal-chat.routes.ts) | [`useInternalChat.ts`](../client/src/hooks/useInternalChat.ts) | Entrega mensagens e alterações de membros em tempo real. | Acesso precisa ser revogado imediatamente quando um participante é removido. |
| Notificações de chamadas | [`calls.routes.ts`](../server/routes/calls.routes.ts) | [`use-call-notifications.ts`](../client/src/hooks/use-call-notifications.ts) | Notifica o vendedor sobre eventos de chamadas. | Bom para alertas instantâneos, mas não substitui polling de histórico e monitoramento. |
| Eventos Zernio | [`zernio.routes.ts`](../server/routes/zernio.routes.ts) | [`zernio-inbox.tsx`](../client/src/pages/zernio-inbox.tsx) | Entrega mensagens recebidas em tempo real. | Usa polling como fallback. O hub Zernio é mantido em memória e não apresenta propagação distribuída equivalente ao hub principal. |
| Progresso de produtos Bling | [`bling-products.routes.ts`](../server/routes/bling-products.routes.ts) | Telas de importação/replicação | Transmite progresso de tarefas longas de produtos. | Evita polling constante, mas a conexão permanece ocupada até conclusão, cancelamento ou desconexão. |
| Progresso de categorias financeiras Bling | [`bling-financial-categories.routes.ts`](../server/routes/bling-financial-categories.routes.ts) | Tela de migração financeira | Revalida fingerprint e transmite o progresso da migração. | Progresso granular; requer fallback/reconciliação se a conexão cair no meio do processo. |

### 4.2 Infraestrutura e funcionamento

O hub principal em [`sse-hub.ts`](../server/lib/sse-hub.ts):

- mantém assinantes gerais e assinantes por conversa;
- envia heartbeat `:ping` a cada 25 segundos;
- usa PostgreSQL `LISTEN/NOTIFY` para propagar eventos entre réplicas;
- publica eventos gerais por usuário ou em broadcast;
- revalida e revoga acesso a conversas transferidas;
- considera um usuário online quando há uma conexão SSE aberta.

O hub Zernio em [`zernio-sse.ts`](../server/lib/zernio-sse.ts) também envia
heartbeat a cada 25 segundos, mas mantém seus clientes apenas em memória.

### 4.3 Trade-offs gerais de SSE

Vantagens:

- baixa latência sem consultas HTTP repetidas;
- protocolo simples sobre HTTP;
- reconexão automática oferecida pelo `EventSource`;
- adequado ao fluxo unidirecional servidor-cliente;
- `LISTEN/NOTIFY` permite publicar entre réplicas no hub principal.

Custos e riscos:

- uma conexão HTTP longa por contexto/aba;
- dependência da configuração de timeout e buffering de proxies/load balancers;
- SSE não atende comunicação bidirecional como WebSocket;
- heartbeats geram tráfego permanente, ainda que pequeno;
- eventos não persistidos podem ser perdidos durante desconexão;
- o cliente precisa reconciliar estado após reconectar;
- o snapshot de presença do hub é descrito como local à réplica, podendo
  produzir visão parcial em ambiente horizontal;
- o hub Zernio não distribui seus clientes/eventos entre réplicas.

## 5. Pollers do frontend

### 5.1 Automação e integrações

| Poller | Implementação | Intervalo/condição | Finalidade | Trade-offs específicos |
|---|---|---:|---|---|
| Status Assertiva | [`use-assertiva-status.ts`](../client/src/hooks/use-assertiva-status.ts) | 30 s | Exibe disponibilidade, autenticação e estado do token. | Simples e resiliente, porém consulta mesmo sem alteração. |
| Execuções de automação | [`use-automation-execution.ts`](../client/src/hooks/use-automation-execution.ts) | 5 s | Atualiza a listagem de execuções. | Boa visibilidade operacional, com custo relevante se a tela permanecer aberta. |
| Automações em andamento | Mesmo hook | 3 s | Monitora execuções ativas. | Baixa latência, mas pode sobrepor dados do poller geral. |
| Status do catch-up | Mesmo hook | 3 s | Acompanha recuperação de automações atrasadas. | Ideal enquanto o processo roda; deveria permanecer condicionado ao estado ativo. |
| Visão geral de automações | [`use-automations.ts`](../client/src/hooks/use-automations.ts) | 60 s | Atualiza métricas e saúde agregada. | Baixo custo relativo e até um minuto de defasagem. |
| Saúde das automações | [`automation-management.tsx`](../client/src/components/automation-management.tsx) | 60 s | Alimenta o indicador administrativo de saúde. | Pode duplicar informação da visão geral se ambos estiverem montados. |
| Importação Bling | [`use-bling-import.ts`](../client/src/hooks/use-bling-import.ts) | 2 s somente enquanto `running` | Atualiza o progresso da importação. | Bom padrão condicional: resposta rápida e encerra ao concluir. |
| Exportação Bling | [`use-bling-export.ts`](../client/src/hooks/use-bling-export.ts) | 2 s somente enquanto `running` | Atualiza o progresso da exportação. | Mesmo benefício e custo do importador. |
| Replicação de produtos Bling | [`bling-product-replicate-section.tsx`](../client/src/components/bling-product-replicate-section.tsx) | Enquanto há job | Atualiza o progresso da replicação. | Complementa tarefas longas, mas deve sempre limpar o intervalo ao finalizar/desmontar. |
| Migração de categorias Bling | [`bling-financial-category-migration-section.tsx`](../client/src/components/bling-financial-category-migration-section.tsx) | Enquanto há job | Atualiza/reconcilia o progresso da migração. | Funciona como fallback ao SSE, ao custo de tráfego duplicado. |
| Importação de contatos Umbler | [`umbler-contact-import-management.tsx`](../client/src/components/umbler-contact-import-management.tsx) | 2 s durante execução | Atualiza contadores e conclusão. | Condicional e responsivo; várias abas multiplicam requisições. |
| Importação de tags Umbler | [`umbler-tag-import.tsx`](../client/src/components/umbler-tag-import.tsx) | 2 s durante execução | Atualiza progresso e conclusão. | Mesmo perfil do importador de contatos. |
| Sincronização Umbler | [`umbler-sync-management.tsx`](../client/src/components/umbler-sync-management.tsx) | 30 s | Exibe status do scheduler e última sincronização. | Pode permanecer consultando mesmo com scheduler desativado. |
| Criação de chat Umbler | [`use-umbler.tsx`](../client/src/hooks/use-umbler.tsx) | Condicional | Repete a consulta enquanto o chat solicitado ainda não existe. | Resolve consistência eventual, mas necessita limite/timeout para não pollar indefinidamente. |

### 5.2 Campanhas, WhatsApp e Zernio

| Poller | Implementação | Intervalo/condição | Finalidade | Trade-offs específicos |
|---|---|---:|---|---|
| Lista de campanhas genéricas | [`use-campaigns.ts`](../client/src/hooks/use-campaigns.ts) | 30 s | Atualiza os estados das campanhas. | Até 30 segundos de defasagem e tráfego permanente com a tela montada. |
| Detalhes de campanha | [`use-campaign-details.ts`](../client/src/hooks/use-campaign-details.ts) | 30 s | Atualiza a campanha aberta. | Poderia ser condicionado ao estado ativo para reduzir tráfego. |
| Estatísticas de campanha | [`use-campaign-stats.ts`](../client/src/hooks/use-campaign-stats.ts) | 30 s | Atualiza entregas e resultados. | Pode duplicar consultas da tela de detalhes. |
| Campanha WhatsApp | [`use-whatsapp.ts`](../client/src/hooks/use-whatsapp.ts) | 4 s somente quando `in_progress` | Mostra progresso detalhado do disparo. | Excelente latência/custo enquanto condicionado ao andamento. |
| Estatísticas WhatsApp | Mesmo hook | 4 s enquanto houver pendentes | Atualiza enviados, entregues, lidos e erros. | Pode permanecer ativo se algum registro ficar preso em `pending`. |
| Estatísticas do bot da campanha | Mesmo hook | 4 s enquanto houver sessões ativas | Acompanha respostas e processamento dos bots. | Sessões presas mantêm polling indefinidamente. |
| Histórico de sessões de bot | Mesmo hook | 4 s se a página contiver sessão ativa | Mostra transição para concluído, erro ou expirado. | Só observa a página atual; atividade fora dela não mantém polling. |
| Log de mensagens WhatsApp | Mesmo hook | 4 s se houver mensagem recente não final | Acompanha `sent`, `delivered`, `read` e `failed`, limitado a uma janela de 10 minutos. | A janela limita custo, mas uma confirmação muito atrasada pode não aparecer automaticamente. |
| Lista de canais WhatsApp | Mesmo hook | 60 s | Mantém badges e status como fallback ao SSE. | Redundante em condições normais, útil para corrigir eventos perdidos. |
| Status ao vivo de canal | Mesmo hook | 15 s | Confirma o estado real no gateway. | Custo proporcional ao número de componentes/canais montados. |
| Histórico de conexão | Mesmo hook | 60 s | Atualiza eventos de conexão do canal. | Baixo custo, com até um minuto de atraso. |
| Saúde WhatsApp | Mesmo hook | 60 s | Atualiza a visão agregada de saúde. | Adequado a monitoramento, não a alertas instantâneos. |
| Eventos do monitor WhatsApp | Mesmo hook | 60 s | Atualiza diagnóstico operacional. | Pode duplicar carga da consulta de saúde. |
| Badge da lista de conversas | Mesmo hook | 30 s | Atualiza contagem de conversas não lidas/pendentes. | Fallback robusto ao SSE, mas gera tráfego contínuo no shell. |
| Canais do atendente | [`conversations.tsx`](../client/src/pages/whatsapp/conversations.tsx) | 30 s | Atualiza canais disponíveis na tela de conversas. | Mudanças podem levar até 30 segundos sem evento SSE correspondente. |
| Primeira página de conversas | Mesmo arquivo | 15 s | Reconcilia ordenação e lista com o servidor. | Requisição relativamente pesada em paralelo com SSE; garante recuperação de eventos perdidos. |
| Mensagens da conversa | Mesmo arquivo | 15 s em trecho de fallback | Reconcilia mensagens e estados. | Segurança adicional, mas duplica parte do trabalho do stream por conversa. |
| Conversas Zernio | [`zernio-inbox.tsx`](../client/src/pages/zernio-inbox.tsx) | 30 s | Atualiza lista e ordenação. | Bom fallback ao SSE, com tráfego mesmo sem mudanças. |
| Mensagens Zernio | Mesmo arquivo | 15 s | Reconcilia mensagens da conversa aberta. | Reduz impacto de perda SSE, mas aumenta chamadas enquanto a conversa está aberta. |

### 5.3 PDV

| Poller | Implementação | Intervalo/condição | Finalidade | Trade-offs específicos |
|---|---|---:|---|---|
| Pedidos da sessão atual | [`table-map.tsx`](../client/src/pages/restaurant-pdv/table-map.tsx) | 15 s somente com caixa aberto | Atualiza vendas recentes. | Condição reduz custo fora do expediente; ainda há atraso de até 15 segundos. |
| Mapa de mesas | Mesmo arquivo | 15 s | Atualiza ocupação, comandas e totais. | Estado colaborativo pode ficar defasado entre dois ticks. |
| Sessão de caixa atual | Mesmo arquivo | 30 s | Detecta abertura, fechamento e mudanças no caixa. | Menor custo, mas fechamento remoto pode levar 30 segundos para aparecer. |
| Comanda selecionada | [`comanda.tsx`](../client/src/pages/restaurant-pdv/comanda.tsx) | 15 s | Atualiza itens, pagamentos e status. | Não impede conflitos concorrentes; mutações precisam validar estado no servidor. |
| Sessão atual na tela de caixa | [`cash-session.tsx`](../client/src/pages/restaurant-pdv/cash-session.tsx) | 30 s | Atualiza o estado da sessão. | Pode sobrepor a consulta da sessão feita no mapa de mesas se ambos estiverem montados. |
| Visão geral do caixa | Mesmo arquivo | 20 s | Atualiza totais e indicadores. | Bom equilíbrio, mas relatórios ficam eventualmente consistentes. |
| Painel administrativo de unidades | [`admin-panel.tsx`](../client/src/pages/restaurant-pdv/admin-panel.tsx) | 30 s | Consolida a situação das unidades/PDVs. | Consultas agregadas podem ser custosas em muitas unidades. |

### 5.4 Telemarketing

| Poller | Implementação | Intervalo/condição | Finalidade | Trade-offs específicos |
|---|---|---:|---|---|
| Progresso de campanha | [`campaign-monitor-dialog.tsx`](../client/src/components/telemarketing/campaign-monitor-dialog.tsx) | 3 s com modal aberto | Mostra contatos processados e decisões de IA. | Baixa latência e escopo condicionado; consultas podem ser grandes conforme a campanha. |
| Estatísticas por campanha | [`campaigns-list.tsx`](../client/src/components/telemarketing/campaigns-list.tsx) | 15 s por campanha renderizada | Atualiza cards da lista. | Possível padrão N+1: uma query periódica por campanha visível. |
| Métricas do dashboard | [`dashboard-metrics.tsx`](../client/src/components/telemarketing/dashboard-metrics.tsx) | 30 s | Atualiza indicadores agregados. | Custo depende da complexidade da agregação no servidor. |
| Status de chamada de IA | [`dialer.tsx`](../client/src/components/telemarketing/dialer.tsx) | 3 s enquanto existe `aiCallSid` | Detecta encerramento remoto e abre o resultado. | Simples e confiável; webhooks/SSE reduziriam a latência e o número de chamadas. |
| Chamadas ativas | [`twilio-monitor.tsx`](../client/src/components/telemarketing/twilio-monitor.tsx) | 5 s | Alimenta o monitor operacional. | Adequado a tempo quase real, mas constante enquanto o monitor está aberto. |
| Alertas Twilio | Mesmo arquivo | 60 s | Atualiza logs e alertas filtrados. | Baixo custo relativo e atraso de até um minuto. |
| Chamadas recentes | Mesmo arquivo | 30 s | Atualiza o histórico recente. | Pode se sobrepor à query de chamadas ativas. |
| Estatísticas de chamadas | Mesmo arquivo | 30 s | Atualiza métricas do monitor. | Agregações repetidas podem ser custosas sem cache/índices. |

## 6. Trade-offs gerais do polling

Vantagens:

- implementação e diagnóstico simples;
- funciona através de proxies comuns;
- reconcilia estado mesmo quando eventos são perdidos;
- pollers condicionais dão feedback rápido a tarefas assíncronas.

Custos e riscos:

- a carga cresce por usuário, aba e componente montado;
- um intervalo de 15 segundos representa até 240 requisições por hora por aba;
- consultas continuam ocorrendo quando nada mudou;
- múltiplos hooks podem buscar informações relacionadas com chaves diferentes;
- o TanStack Query deduplica a mesma `queryKey`, mas não queries apenas
  semanticamente equivalentes;
- abas em segundo plano podem sofrer throttling de timers pelo navegador;
- polling simultâneo com SSE preserva resiliência, mas reduz a economia de
  tráfego esperada com eventos em tempo real;
- estados presos em `running`, `pending` ou `active` podem manter pollers
  condicionais ativos indefinidamente.

As configurações globais em
[`queryClient.ts`](../client/src/lib/queryClient.ts) desativam polling e refetch
por foco por padrão. Portanto, os intervalos deste inventário foram definidos
explicitamente nos respectivos componentes/hooks.

## 7. Riscos e oportunidades prioritárias

1. **Divergência no Copiloto:** o comentário afirma execução às 05:00, mas o
   cron efetivo executa às 09:00.
2. **Quatro dispatchers por minuto:** legado, WhatsApp, e-mail e SMS. Deve-se
   confirmar se o dispatcher legado ainda possui responsabilidade exclusiva.
3. **Execução por réplica:** jobs carregados pelo bootstrap são registrados em
   cada instância. Nem todos usam advisory lock distribuído.
4. **Frequência alta:** inbox Baileys a cada dois segundos e retomada de bots a
   cada cinco segundos merecem métricas de duração, backlog e falhas.
5. **SSE mais polling:** WhatsApp e Zernio mantêm ambos. É resiliente, mas pode
   haver oportunidade de aumentar o intervalo do fallback após confirmar a
   estabilidade do stream.
6. **Scheduler Umbler local:** controle por API e estado em memória não oferecem
   semântica clara em implantação com várias réplicas.
7. **N+1 no telemarketing:** estatísticas periódicas por campanha renderizada
   podem crescer linearmente com a lista.
8. **Presença SSE:** a presença em memória pode ser parcial por réplica mesmo
   que a publicação de eventos seja propagada por `LISTEN/NOTIFY`.
9. **Ausência de observabilidade uniforme:** os jobs registram logs, mas não há
   neste levantamento um painel único com última execução, duração, sucesso,
   falha e atraso de cada scheduler.

## 8. Recomendações

- Adotar uma tabela/infraestrutura de leases ou advisory locks para jobs que
  devem executar uma única vez no cluster.
- Registrar por job: início, fim, duração, resultado, quantidade processada,
  erro e próxima execução esperada.
- Adicionar alerta para execução atrasada e backlog crescente.
- Tornar todos os pollers de progresso condicionais a estados terminais e
  definir timeout máximo para estados presos.
- Consolidar queries periódicas relacionadas e revisar chaves do TanStack Query.
- Para áreas com SSE estável, manter polling de reconciliação em intervalo mais
  longo, por exemplo entre 60 e 120 segundos.
- No telemarketing, substituir estatísticas por campanha por um endpoint
  agregado ou um stream de progresso.
- Documentar explicitamente quais serviços são seguros para execução concorrente
  e quais dependem de exclusão mútua.

## 9. Referências principais

- Bootstrap dos jobs: [`server/index.ts`](../server/index.ts)
- Jobs: [`server/jobs/`](../server/jobs/)
- Hub SSE principal: [`server/lib/sse-hub.ts`](../server/lib/sse-hub.ts)
- Hub SSE Zernio: [`server/lib/zernio-sse.ts`](../server/lib/zernio-sse.ts)
- Rotas WhatsApp: [`server/routes/whatsapp-conversations.routes.ts`](../server/routes/whatsapp-conversations.routes.ts)
- Hooks WhatsApp: [`client/src/hooks/use-whatsapp.ts`](../client/src/hooks/use-whatsapp.ts)
- Cliente SSE geral do WhatsApp: [`client/src/lib/wa-notifications-stream.ts`](../client/src/lib/wa-notifications-stream.ts)
- Configuração global do TanStack Query: [`client/src/lib/queryClient.ts`](../client/src/lib/queryClient.ts)

