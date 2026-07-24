# Canal Eventos — envio "some" (erro 463 / conta restrita)

## Contexto

O usuário de televendas não consegue enviar mensagens para clientes pelo canal **Eventos** (número 21989014965, conectado via QR/Baileys), embora consiga por outros canais. Sintomas: (1) mensagem aparece como **"enviado"** mas o contato **não recebe**; (2) às vezes aparece **"Reenviar"**; (3) log do Baileys `error 463: account restricted or missing tctoken for contact`.

## Diagnóstico (causa raiz)

**Não é bug do CRM.** O número do canal Eventos está sob **restrição do WhatsApp** ("reach-out time-lock" / conta restrita). Evidências, confirmadas no pacote instalado `@whiskeysockets/baileys@7.0.0-rc13` (que já é a versão `latest`):

- `node_modules/@whiskeysockets/baileys/lib/Socket/messages-recv.js:1511-1566` trata o 463 e comenta: *"account is restricted: WhatsApp blocks starting new chats but preserves existing ones… **No retry — retrying counts as another 'reach out' and worsens the restriction.**"*
- O Baileys **já tenta recuperar o tctoken sozinho** no 463 (linhas 1521-1545) e já emite `messages.update` com `status: ERROR` + `messageStubParameters` (`["463"]`, ou `["463","Your account has been restricted"]`). Ou seja: **não há upgrade nem tctoken faltando para corrigir** — a restrição é do lado do WhatsApp.
- Constantes (em `decode-wa-message.js`): `MessageAccountRestriction = "463"`, `ACCOUNT_RESTRICTED_TEXT = "Your account has been restricted"`.

**Por que "aparece enviado mas não chega":** `sock.sendMessage` resolve com o *server-ack* → o CRM marca `sent`. A rejeição/descarte do WhatsApp vem depois (nack 463 assíncrono, ou silenciosamente sem nack para contatos ambíguos). Quando o nack 463 chega, o CRM **já** o mapeia para `failed` (`server/services/whatsapp-baileys-events.service.ts:166`) — daí o "Reenviar". Quando o WhatsApp apenas dá ack e descarta em silêncio, **nenhum código consegue detectar** (limitação do Baileys/WA).

## Recomendações operacionais (o "fix" de verdade — fora do código)

- **Parar de clicar em "Reenviar"** no canal Eventos: cada reenvio conta como novo "reach out" e **prolonga/piora** a restrição.
- Deixar o número **esfriar** (reduzir/parar disparos para contatos frios por alguns dias); a restrição é temporária.
- Priorizar **conversas iniciadas pelo cliente** (inbound carrega tctoken e não conta como reach-out).
- Evitar **re-parear o QR** repetidamente.
- Para volume de marketing/eventos, usar a **Meta Cloud API oficial** (o projeto já suporta via `provider = "cloud_api"`).

## Objetivo das mudanças de código

O código não remove a restrição do WhatsApp, mas hoje **esconde** o problema (mostra "enviado" falso e um "Reenviar" que piora tudo). As 3 mudanças abaixo tornam a falha visível, honesta e não-agravante.

---

## Mudança 1 — Persistir o motivo do erro (schema)

`whatsapp_messages` hoje não tem coluna de motivo (`shared/schema.ts:5043`; `status` enum = `sent|delivered|read|failed`).

- **SQL manual** (conforme CLAUDE.md — nunca `db:push`): criar script `scripts/add-message-status-reason.mjs` no padrão de `scripts/create-reactions-table.mjs` (driver `@neondatabase/serverless`, lê `DATABASE_URL`), rodando:
  ```sql
  ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS status_reason text;
  ```
- **`shared/schema.ts`**: adicionar `statusReason: text("status_reason")` na definição de `whatsappMessages` (depois de `status`).

Valor semântico: `"account_restricted"` para 463; `null` caso normal.

## Mudança 2 — Capturar o 463 do Baileys e gravar o motivo

**a) Passar `messageStubParameters` adiante** — `server/services/baileys/session-manager.ts:480-486`, handler `messages.update`: hoje só repassa `status`. Incluir também `messageStubParameters` (ou pelo menos o 1º código de erro) no objeto mapeado.

**b) Detectar 463 e persistir motivo** — `handleMessagesUpdate` em `server/services/whatsapp-baileys-events.service.ts:153-179`: quando o status mapear para `failed`, ler os stub params; se o código for `"463"` (ou incluir `ACCOUNT_RESTRICTED_TEXT`), gravar também `statusReason: "account_restricted"` no mesmo `.update()` (match por `waMessageId`). Manter o mapeamento atual de status.

## Mudança 3 — Corrigir o "sent" falso (race do nack tardio)

Em `sendConversationMessage` (`server/services/whatsapp-conversations.service.ts:1470-1513`): a mensagem é inserida como `failed` (placeholder) e, no sucesso, sobrescrita para `sent` (linha 1510-1513). Se um nack 463 já marcou `failed`+motivo, a escrita de `sent` pode **sobrescrevê-lo**.

- Tornar a escrita de `sent` **condicional a não haver motivo de erro registrado**: adicionar `and(eq(id, savedMessage.id), isNull(whatsappMessages.statusReason))` no `.where(...)`. Assim um 463 que chegue na janela não é apagado por um "sent".
- Aplicar o mesmo guard no caminho de mídia (`sendConversationMedia`, ~linha 1893+) e, se aplicável, no retry (`handleRetry`/rota de reenvio).
- **Limitação a documentar:** ack-sem-nack (descarte silencioso) continua indetectável — é do WhatsApp, não do CRM.

## Mudança 4 — Expor `statusReason` na API de mensagens

`server/services/whatsapp-conversations.service.ts:1317-1334` (select de mensagens da conversa): adicionar `statusReason: whatsappMessages.statusReason` ao objeto `.select({...})`, para o campo chegar ao frontend.

## Mudança 5 — Frontend: bloquear reenvio no 463 e mostrar o motivo

`client/src/pages/whatsapp/conversations.tsx`:

- **Tipo** `WaMessage` (linha 253): adicionar `statusReason?: string | null;`.
- **Botão Reenviar** (linha 4499-4515): quando `msg.statusReason === "account_restricted"`, **não** renderizar o botão "Reenviar"; em vez disso mostrar um aviso curto (ex.: "Número restrito pelo WhatsApp — não reenvie") e não permitir `handleRetry`. Para os demais `failed`, manter o botão como está.
- (Opcional, mesmo motivo) refletir o aviso no indicador de status da bolha (linhas ~4696-4712).

---

## Verificação

- `npm run check` — atenção ao aviso do CLAUDE.md sobre OOM do `tsc`: usar `tsconfig.tmp.json` na raiz incluindo `server/types/express.d.ts` + os arquivos tocados.
- Rodar o script SQL e confirmar a coluna: `node scripts/add-message-status-reason.mjs`.
- Teste de rota/unidade (padrão do projeto, `createRouteTestApp()`): simular um `messages.update` com `status` de erro e `messageStubParameters: ["463"]` e verificar que a mensagem correspondente vira `failed` + `statusReason = "account_restricted"`, e que uma escrita de `sent` posterior **não** sobrescreve.
- Conferir no `npx vitest list --project unit` que qualquer teste novo é coletado (globs fechados — ver CLAUDE.md).
- **Sem verificação visual em navegador** (regra do CLAUDE.md): validar a UI por leitura de código.
