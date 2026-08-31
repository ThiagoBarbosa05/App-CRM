# Plano de implementação — auditoria de mensagens do Baileys

## Objetivo

Adaptar o CRM ao novo contrato do Baileys Gateway para:

- receber e auditar mensagens de Status sem criar contatos ou conversas artificiais;
- acompanhar falhas de descriptografia por meio do evento `messages.decryption`;
- manter a entrega normal de mensagens recuperadas por `messages.upsert`;
- disponibilizar a auditoria somente para usuários com perfil `admin` ou `gerente`;
- reter os registros por 30 dias.

O processamento continuará usando o inbox durável de webhooks do CRM. A entrega do gateway é `at-least-once`, portanto toda persistência e transição deverá ser idempotente.

## Decisões de produto

- Status não pertence ao inbox operacional e não deve criar contato, conversa ou mensagem em `whatsapp_messages`.
- Status não deve disparar bot, automação, distribuição, notificação ou contagem de não lidas.
- A auditoria será exibida na área de gestão dos canais WhatsApp, fora da tela de conversas.
- Apenas `admin` e `gerente` poderão consultar a auditoria.
- Os registros serão eliminados automaticamente após 30 dias.
- Uma mensagem recuperada será processada normalmente pelo fluxo existente de `messages.upsert`, além de atualizar o incidente de descriptografia.

## Contrato esperado do gateway

### `messages.upsert`

O CRM deve aceitar a chave completa enviada pelo gateway:

```ts
interface GatewayMessageKey {
  remoteJid: string;
  remoteJidAlt?: string;
  participant?: string;
  participantAlt?: string;
  addressingMode?: string;
  fromMe: boolean;
  id: string;
}
```

Quando `remoteJid === "status@broadcast"`, o evento deve seguir para a auditoria de Status. Nos demais casos, deve continuar usando o fluxo normal de mensagens.

### `messages.decryption`

O webhook deve aceitar, validar e persistir eventos com:

- `instance`;
- chave completa da mensagem;
- `status`: `pending`, `recovered`, `recovered_late` ou `failed`;
- `reason`: `missing_sender_key`, `missing_session` ou `unknown`;
- `attempts`;
- `retrying`;
- timestamps informados pelo gateway, incluindo primeiro/último recebimento e prazo final quando presentes.

Antes da implementação, alinhar os nomes exatos dos campos com `docs/API.md` do gateway e refletir esse contrato no schema Zod do CRM.

## Modelo de dados

### Tabela de Status

Criar uma tabela, por exemplo `whatsapp_status_audit`, com:

- `id` UUID;
- `channel_id`, com FK para o canal WhatsApp;
- `instance_name`;
- `message_id`;
- `remote_jid` e `remote_jid_alt`;
- `participant` e `participant_alt`;
- `addressing_mode`;
- `from_me`;
- `author_phone`, normalizado quando for possível determinar o PN;
- `author_lid`, quando disponível;
- `message_type`;
- `message_payload` JSONB com o conteúdo estruturado necessário para auditoria;
- `raw_payload` JSONB para diagnóstico;
- `message_timestamp`;
- `received_at`;
- `created_at` e `updated_at`.

Criar unicidade por `(channel_id, message_id)` para deduplicar reentregas. Se houver risco real de colisão entre autores, ampliar a chave para `(channel_id, remote_jid, participant, message_id)`.

Índices recomendados:

- `(channel_id, received_at DESC)`;
- `(author_phone, received_at DESC)`;
- `(author_lid, received_at DESC)`;
- `(created_at)` para a rotina de retenção.

### Tabela de incidentes de descriptografia

Criar uma tabela, por exemplo `whatsapp_decryption_incidents`, com:

- `id` UUID;
- `channel_id`, com FK para o canal WhatsApp;
- `instance_name`;
- `remote_jid` e `remote_jid_alt`;
- `participant` e `participant_alt`;
- `addressing_mode`;
- `from_me`;
- `message_id`;
- `status`;
- `reason`;
- `attempts`;
- `retrying`;
- `first_received_at`;
- `last_received_at`;
- `deadline_at`;
- `resolved_at`;
- `gateway_payload` JSONB;
- `created_at` e `updated_at`.

Criar unicidade pela identidade enviada pelo gateway: `(instance_name, remote_jid, participant, message_id)`. Tratar `participant` ausente de forma determinística no índice ou em uma chave normalizada, para que valores `NULL` não quebrem a deduplicação.

Índices recomendados:

- `(channel_id, status, last_received_at DESC)`;
- `(reason, last_received_at DESC)`;
- `(message_id)`;
- `(created_at)` para retenção.

Adicionar os schemas e tipos ao `shared/schema.ts`. Criar migração SQL manual conforme o padrão do projeto; não usar `db:push`.

## Ingestão e processamento

### Validação do webhook

Em `server/routes/evolution-webhook.routes.ts`:

- adicionar `messages.decryption` ao enum de eventos aceitos;
- criar validação Zod para o novo payload sem enfraquecer a validação dos eventos existentes;
- manter verificação HMAC, limites de payload e inserção no inbox durável antes da resposta HTTP;
- preservar no payload de `messages.upsert` todos os campos da chave PN/LID.

### Inbox durável

Em `server/services/baileys-gateway-webhook-inbox.service.ts`:

- incluir `messages.decryption` no tipo `GatewayWebhookEnvelope`;
- adicionar o novo caso ao dispatcher;
- encaminhar o evento a um serviço específico de auditoria;
- manter retries e dead-letter já existentes;
- garantir que reprocessamentos do inbox não dupliquem registros nem regressem estados.

### Processamento de Status

Em `server/services/whatsapp-baileys-events.service.ts`:

- detectar `remoteJid === "status@broadcast"` antes de chamar `isIgnorableJid`;
- encaminhar o evento a um serviço dedicado de auditoria de Status;
- retornar imediatamente após a persistência, impedindo a entrada no fluxo de contatos e conversas;
- extrair o autor usando os campos PN/LID, sem converter literalmente `status@broadcast` em telefone;
- preservar tipos ricos, incluindo localização, sticker animado e conteúdo encapsulado em ephemeral/view-once;
- usar upsert idempotente para que um retry atualize o registro existente.

Ordem sugerida para identificar o autor:

1. PN explícito em `participantAlt` ou `remoteJidAlt`;
2. PN presente em `participant` quando o JID não for LID;
3. LID em `participant` ou `participantAlt`;
4. manter apenas os identificadores brutos quando não for possível determinar o PN.

Não criar um contato somente para representar o autor de um Status. Um vínculo com contato existente poderá ser resolvido apenas para leitura, sem efeitos colaterais.

### Processamento de `messages.decryption`

Criar um serviço, por exemplo `whatsapp-message-audit.service.ts`, com uma operação transacional e idempotente:

- resolver `instance` para o canal correto;
- inserir o incidente na primeira ocorrência;
- atualizar `attempts`, timestamps, motivo e payload nos retries;
- aceitar somente transições válidas;
- impedir regressão de `recovered`, `recovered_late` ou `failed` para `pending`;
- permitir `failed → recovered_late`;
- tratar repetição do mesmo conjunto chave + status como atualização idempotente;
- registrar e tornar observável payloads inválidos ou instâncias sem canal correspondente.

Transições esperadas:

```text
novo -> pending
pending -> pending
pending -> recovered
pending -> failed
failed -> recovered_late
recovered -> recovered
recovered_late -> recovered_late
failed -> failed
```

Eventos fora dessas transições não devem regredir o registro. Eles podem atualizar `last_received_at`, `attempts` e `gateway_payload` quando isso não alterar o estado final.

O serviço não deve criar uma mensagem comum ao receber `recovered`. O conteúdo real chegará por `messages.upsert` e seguirá o fluxo existente.

## API administrativa

Adicionar endpoints sob a área de canais WhatsApp, protegidos por `requireAdminOrGerente`:

- `GET /api/whatsapp-channels/:channelId/message-audit/statuses`;
- `GET /api/whatsapp-channels/:channelId/message-audit/decryption`;
- opcionalmente, endpoints de detalhe por `id` caso a listagem não deva retornar o payload completo.

Filtros para Status:

- intervalo de datas;
- tipo da mensagem;
- telefone, LID ou ID da mensagem;
- paginação por cursor ou pelo padrão já usado no projeto.

Filtros para descriptografia:

- intervalo de datas;
- estado;
- motivo;
- telefone/JID/LID ou ID da mensagem;
- paginação.

Requisitos de resposta:

- não devolver payloads grandes na listagem quando uma visão resumida for suficiente;
- limitar tamanho de página;
- ordenar do evento mais recente para o mais antigo;
- retornar `404` quando o canal não existir ou não estiver acessível;
- retornar `403` para perfis diferentes de `admin` e `gerente`.

## Interface administrativa

Adicionar uma seção “Auditoria do gateway” na gestão do canal WhatsApp, visível apenas para `admin` e `gerente`.

A seção terá duas abas:

### Status recebidos

- data/hora;
- autor identificado por telefone e/ou LID;
- tipo de conteúdo;
- ID da mensagem;
- resumo do conteúdo;
- ação para abrir os detalhes e o payload técnico.

### Descriptografia

- data/hora da primeira e da última ocorrência;
- estado com destaque visual;
- motivo normalizado;
- tentativas;
- identificadores PN/LID/JID;
- ID da mensagem;
- prazo e horário de resolução;
- ação para abrir os detalhes técnicos.

Adicionar filtros, paginação, estados de carregamento, tela vazia e erro recuperável. Não expor a rota somente por ocultação visual: a API também deve aplicar `requireAdminOrGerente`.

## Retenção e privacidade

Criar uma rotina diária que remova registros com mais de 30 dias das duas tabelas.

- usar o mecanismo de jobs/scheduler já adotado pelo CRM;
- excluir em lotes para evitar locks prolongados;
- registrar quantidade removida, duração e falhas;
- tornar a operação idempotente;
- garantir que índices por `created_at` ou `received_at` sustentem a limpeza;
- não remover mensagens operacionais do inbox, contatos ou conversas nessa rotina;
- avaliar mascaramento de conteúdo sensível nos logs da aplicação.

O prazo deve ser configurável, com padrão de 30 dias, para permitir ajuste operacional sem nova migração.

## Observabilidade

Adicionar logs estruturados e, se o projeto possuir infraestrutura compatível, métricas para:

- Status persistidos e deduplicados;
- incidentes por estado e motivo;
- transições inválidas ignoradas;
- eventos sem canal correspondente;
- falhas de persistência/processamento;
- duração e volume da limpeza de retenção.

Os logs não devem registrar mídia binária, segredos do webhook ou payloads pessoais completos.

## Testes

### Testes de unidade

- parsing da chave completa PN/LID;
- resolução de autor de Status;
- detecção de Status antes de `isIgnorableJid`;
- normalização de conteúdo rico e encapsulado;
- tabela de transições de descriptografia;
- deduplicação com e sem `participant`;
- cálculo da retenção de 30 dias.

### Testes de integração

- webhook aceita `messages.decryption` com HMAC válido e o enfileira;
- webhook rejeita payload inválido ou assinatura inválida;
- retry do inbox não duplica Status nem incidente;
- Status cria apenas auditoria, sem contato, conversa, mensagem operacional, bot ou notificação;
- localização, sticker animado e view-once/ephemeral geram um único registro de Status;
- `pending → recovered` atualiza o mesmo incidente;
- `pending → failed → recovered_late` atualiza o mesmo incidente;
- eventos repetidos não fazem estados finais regredirem;
- `messages.upsert` recuperado segue criando a mensagem normal uma única vez;
- limpeza elimina somente registros vencidos.

### Testes de autorização e API

- `admin` e `gerente` conseguem listar e detalhar auditorias;
- outros perfis recebem `403` mesmo chamando a API diretamente;
- filtros, paginação, ordenação e isolamento entre canais funcionam;
- payload detalhado não aparece indevidamente na listagem resumida.

### Testes de interface

- abas e filtros renderizam para `admin` e `gerente`;
- seção não aparece para outros perfis;
- estados `pending`, `recovered`, `recovered_late` e `failed` têm rótulos claros;
- detalhes apresentam PN/LID sem produzir telefone `status`;
- carregamento, vazio, erro e paginação funcionam.

## Ordem recomendada de implementação

1. Confirmar o contrato final em `docs/API.md` do gateway e criar fixtures reais dos dois eventos.
2. Adicionar schemas/tipos compartilhados e migração SQL das tabelas e índices.
3. Escrever testes dos serviços para deduplicação, resolução PN/LID e máquina de estados.
4. Implementar o serviço de auditoria e a ingestão de `messages.decryption` pelo inbox.
5. Alterar `messages.upsert` para desviar `status@broadcast` ao fluxo de auditoria.
6. Criar endpoints administrativos protegidos por `requireAdminOrGerente`.
7. Criar hooks/tipos do cliente e a seção “Auditoria do gateway”.
8. Implementar job diário de retenção e observabilidade.
9. Atualizar a documentação operacional e executar a validação completa.

## Validação final

Executar, no mínimo:

```bash
npm run test:unit
npm run check
npm run build
```

Também executar os testes de integração específicos das rotas, do inbox durável e dos serviços alterados. Se o typecheck completo exceder memória, usar o procedimento de `tsconfig` isolado documentado pelo projeto sem deixar de validar todos os arquivos modificados.

## Critérios de aceite

- Todo Status descriptografado recebido pelo gateway fica consultável na auditoria por 30 dias.
- Nenhum Status cria conversa, contato fantasma com telefone `status`, notificação, bot ou automação.
- Todo evento `messages.decryption` válido é persistido de forma idempotente.
- Retries não criam duplicatas e estados finais não regridem.
- Recuperações normais e tardias ficam visíveis, e o `messages.upsert` correspondente continua chegando ao inbox.
- Somente `admin` e `gerente` acessam a auditoria no frontend e na API.
- A limpeza automática remove apenas auditorias vencidas e é observável.
- Testes, typecheck e build passam.

## Fora do escopo

- Atualização da versão do Baileys no gateway.
- Mudança da política de retry do gateway.
- Exibição de Status como conversa no inbox.
- Criação automática de contatos a partir de autores de Status.
- Garantia de recuperação de conteúdo que o WhatsApp nunca retransmitir.
