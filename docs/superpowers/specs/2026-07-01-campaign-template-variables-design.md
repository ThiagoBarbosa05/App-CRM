# Variáveis e mídia de template na criação de campanha

## Contexto

No passo "Template" da criação de campanha ([create-campaign.tsx](../../../client/src/pages/whatsapp/create-campaign.tsx), `StepTemplateOrBot`), o usuário só escolhe qual template Meta usar — não preenche as variáveis do corpo/cabeçalho nem escolhe mídia de cabeçalho, como já é possível no editor de bots (`SendTemplateEditor` em `bot-editor.tsx`) e no envio de template pelo chat (`TemplatePicker` em `conversations.tsx`).

Investigação encontrou um bug real no caminho atual: `handleSubmit` extrai os *nomes* das variáveis via `parseTemplateVars` e manda como se fossem valores. No disparo, `buildBodyParams` ([whatsapp-campaign.service.ts:204](../../../server/services/whatsapp-campaign.service.ts)) só trata magicamente a palavra `"nome"` (vira o primeiro nome do cliente); qualquer outra variável vira texto literal errado. Variáveis e mídia de **cabeçalho** não têm nenhum suporte no backend de campanhas hoje.

Também foi identificado que, se os valores fossem salvos do jeito que já existe para `bodyParams` (na linha compartilhada de `whatsapp_templates`, por nome+idioma via `ensureLocalTemplateForMeta`), duas campanhas usando o mesmo template Meta se sobrescreveriam mutuamente antes do disparo da primeira terminar.

**Objetivo:** permitir preencher variáveis de corpo/cabeçalho (com suporte a tokens de personalização por cliente, ex. `{{nome}}`) e escolher mídia de cabeçalho na criação da campanha, com os valores isolados por campanha (corrigindo o bug de sobrescrita de quebra).

## Decisões confirmadas com o usuário

1. **Escopo dos dados:** por campanha (novas colunas em `campaigns`), não na linha compartilhada de `whatsapp_templates`.
2. **Personalização:** variáveis suportam tokens resolvidos por cliente no disparo (`{{nome}}`, `{{email}}`, etc.), além de texto fixo — igual ao editor de bots.
3. **Mídia de cabeçalho:** selecionada via `AttachFileDialog` (upload novo ou biblioteca de mídia existente), igual ao chat.
4. **Validação:** o botão "Próximo" fica bloqueado se houver variável vazia ou mídia de cabeçalho pendente quando o template exigir.

## 1. Modelo de dados

Novo script de migração manual `scripts/add-campaign-template-params-cols.mjs` (padrão do projeto — nunca `db:push`, sempre SQL direto via `@neondatabase/serverless`, seguindo o mesmo formato de `scripts/add-bot-session-campaign-cols.mjs`):

```sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS meta_template_body_params jsonb,
  ADD COLUMN IF NOT EXISTS meta_template_header_params jsonb,
  ADD COLUMN IF NOT EXISTS meta_template_header_media_storage_key text,
  ADD COLUMN IF NOT EXISTS meta_template_header_media_type text
```

- `metaTemplateBodyParams` / `metaTemplateHeaderParams`: `string[]` nullable — cada posição pode conter texto fixo ou um token `{{nome}}`, `{{email}}`, etc.
- `metaTemplateHeaderMediaStorageKey` / `metaTemplateHeaderMediaType`: nullable, preenchidos só quando o cabeçalho do template exigir imagem/vídeo/documento.

`shared/schema.ts` ganha essas 4 colunas na definição de `campaigns` (jsonb/text, nullable). Nada muda em `whatsapp_templates` ou `whatsapp_campaigns`.

Essa migração precisa ser executada manualmente contra o banco (confirmação do usuário antes de rodar, por ser uma alteração direta em produção).

## 2. UI do frontend (`create-campaign.tsx`)

**Novo estado no componente pai** (`WhatsAppCreateCampaign`): `templateBodyParams: string[]`, `templateHeaderParams: string[]`, `templateHeaderMedia: {storageKey, mediaType} | null`. Resetam sempre que o template selecionado muda ou o usuário troca para a aba "Bot".

**Fluxo em `StepTemplateOrBot`:** ao escolher um template, a lista de busca dá lugar a uma tela de configuração (mesmo padrão de duas telas do `TemplatePicker` do chat): card do template selecionado + botão "Trocar template", seguido de:

1. **Variáveis do corpo** — um input por posição detectada via `parseTemplateVars` (grupo `body`), com um dropdown ao lado para inserir um token de cliente (`{{nome}}`, `{{email}}`, `{{telefone}}`, `{{telefone_fixo}}`, `{{cpf}}`, `{{cidade}}`, `{{estado}}`, `{{endereco}}`, `{{aniversario}}` — os mesmos 9 campos que o bot engine já injeta em `startBotSession`) ou digitar texto fixo. Placeholder igual ao editor de bots: "Texto fixo ou {{nome}}, {{email}}...".
2. **Variáveis do cabeçalho de texto** (raro, mas simétrico ao corpo) — mesmo tratamento, se o grupo `header` tiver `format: "text"` com variáveis.
3. **Mídia de cabeçalho** — se `format` for `image`/`video`/`document`, botão "Selecionar arquivo" abre `AttachFileDialog` (`lockedType` travado no formato exigido); depois de escolhida, mostra preview + "Trocar".
4. **Pré-visualização** — reaproveita `TemplatePreview`, mas tokens reconhecidos viram rótulos amigáveis entre colchetes (ex. "[Nome do cliente]") e texto fixo aparece literal.

**Validação do "Próximo":** bloqueado se houver variável vazia (corpo ou cabeçalho) ou mídia de cabeçalho pendente quando o template exigir.

**Submissão:** `handleSubmit` troca a extração quebrada atual pelos valores reais preenchidos, e inclui `metaTemplateHeaderParams`/`metaTemplateHeaderMedia` quando aplicável. O hook `useCreateCampaignWithDispatch` ([use-whatsapp.ts](../../../client/src/hooks/use-whatsapp.ts)) ganha esses 2 campos novos no payload enviado a `POST /api/campaigns`.

## 3. Backend — criação e disparo

**Criação** ([campaigns.routes.ts](../../../server/routes/campaigns.routes.ts), `POST /api/campaigns`):
- Passa a aceitar `metaTemplateHeaderParams?: string[]` e `metaTemplateHeaderMedia?: { storageKey, mediaType }` no body (desestruturação direta, sem Zod — consistente com o resto da rota).
- `ensureLocalTemplateForMeta` deixa de receber `bodyParams` da campanha (só resolve nome/idioma/categoria do template) — evita sobrescrever a linha compartilhada de `whatsapp_templates`, que continua sendo lida por aniversário/pós-venda.
- No `insert` em `campaigns`, grava as 4 colunas novas.

**Disparo** ([whatsapp-campaign.service.ts](../../../server/services/whatsapp-campaign.service.ts), `executeCampaign`):
- Extrai de `whatsapp-bot-engine.service.ts` a lógica que hoje monta `clientVars` inline em `startBotSession` (linhas ~1071–1088) para uma função exportada `buildClientVariables(client, phone)` — evita duplicar os 9 campos em dois lugares.
- Para cada mensagem: busca o cliente por `msg.contactId` (já gravado em `whatsapp_campaign_messages`), monta `clientVars` com `buildClientVariables`, substitui `buildBodyParams` por uma versão que usa `interpolate()` (já exportada do bot engine) sobre `campaign.metaTemplateBodyParams`.
- Se `campaign.metaTemplateHeaderMediaStorageKey` existir, monta o componente `header` com `getPublicR2Url(storageKey)` — igual ao nó "Enviar template" do bot ([whatsapp-bot-engine.service.ts:741-747](../../../server/services/whatsapp-bot-engine.service.ts)). Se em vez disso houver `metaTemplateHeaderParams`, monta um componente `header` com parâmetros de texto interpolados.
- `sendTemplateMessage(...)` recebe um array `components` mais completo, sem mudança de assinatura.
- Se o cliente não for encontrado (ex. apagado depois da criação da campanha), cai no fallback só com `{ telefone }`, igual ao bot engine para contatos sem cadastro.

## 4. Validação, erros e testes

**Validação (frontend):** ver seção 2 — bloqueia "Próximo" com variável vazia ou mídia de cabeçalho pendente. Estado reseta ao trocar de template ou alternar para "Bot".

**Validação (backend):** nenhuma checagem defensiva nova. Se dados incompletos chegarem (bypass do frontend), a própria Meta API rejeita a mensagem e o try/catch por mensagem que já existe em `executeCampaign` captura isso, marcando só aquela mensagem como `failed` — sem abortar o restante da campanha.

**Testes:**
1. `npm run check` (obrigatório).
2. Verificação manual no navegador: selecionar template com variáveis de corpo, preencher misturando texto fixo e token `{{nome}}`, conferir pré-visualização; se exigir mídia, anexar via `AttachFileDialog`; tentar avançar com campo vazio para confirmar bloqueio; concluir e inspecionar `POST /api/campaigns` para confirmar os 4 campos novos no payload.
3. Sem disparo real de campanha nesta sessão (evita enviar mensagens reais via Meta) — a lógica de `executeCampaign` é validada por leitura de código, não por execução.
4. Toolchain de testes automatizados (`vitest`) está quebrado com a versão atual do `vite` (registrado em memória do projeto) — não depender de testes automatizados para esta feature, só checagem de tipos + verificação manual.
5. A migração roda direto no banco — pedir confirmação do usuário antes de executá-la.

## Fora de escopo

- `server/controllers/campaigns/create-campaign.controller.ts` (API externa baseada em Umbler com `exclusiveTagFilter`) — fluxo separado, não usado pela tela `create-campaign.tsx`. Não mexer.
- Suporte a botões de template (`templateButtons`) — não mencionado no pedido original, não incluído aqui.
- Página `client/src/pages/create-campaign-improved.tsx` (campanha multicanal legada) — fora de escopo.
