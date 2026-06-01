# Plano de Migração: Umbler Talk → WhatsApp Business API (Cloud API)

**Data:** 2026-05-31  
**Escopo:** Migração completa de todas as integrações com Umbler Talk para a WhatsApp Cloud API (Meta)

---

## 1. Mapeamento de Funcionalidades

| Funcionalidade Atual (Umbler)         | Equivalente na WA Cloud API                          | Complexidade |
|--------------------------------------|------------------------------------------------------|--------------|
| Criar/sincronizar contato            | Eliminado — WA usa número de telefone como ID        | Baixa        |
| Buscar contato por telefone          | Verificação via `/contacts` (optional)               | Baixa        |
| Atualizar/deletar contato            | Gerenciado internamente no CRM (sem API equivalente) | Média        |
| Tags de contato                      | Gerenciado internamente no DB do CRM                 | Média        |
| Campo personalizado (cashback)       | Gerenciado internamente no DB do CRM                 | Média        |
| Criar chat                           | Eliminado — WA envia direto para o número            | Baixa        |
| Enviar mensagem de texto             | `POST /{phone_number_id}/messages` type: text        | Baixa        |
| Enviar template message              | `POST /{phone_number_id}/messages` type: template    | Baixa        |
| Upload de arquivo                    | `POST /media` + usar media_id na mensagem            | Média        |
| Bulk send session / campanhas        | Loop de envio com templates aprovados                | Alta         |
| Agendar mensagem                     | Job interno (node-cron) + WA API no momento certo    | Média        |
| Bots de aniversário                  | Template message agendada via cron interno           | Alta         |
| Mensagem pós-chamada                 | Template message disparada por evento de chamada     | Média        |
| Sync de tags (worker)                | Eliminado ou migrado para CRM interno                | Alta         |
| Snapshots de contatos (umblerSync)   | Refatorar para não depender do Umbler                | Alta         |
| Webhooks de status                   | **Novo:** endpoint receptor de webhooks WA           | Alta         |

---

## 2. Pré-requisitos (Antes de Qualquer Código)

### 2.1 Conta Meta Business

1. Acesse **Meta for Developers** → `developers.facebook.com`
2. Crie um **App** do tipo "Business"
3. Adicione o produto **WhatsApp** ao app
4. Acesse **WhatsApp > Configuração** e anote:
   - `PHONE_NUMBER_ID` — ID do número de telefone da empresa
   - `WHATSAPP_BUSINESS_ACCOUNT_ID` (WABA ID)
   - `ACCESS_TOKEN` — token de acesso permanente (via System User no Meta Business Suite)

### 2.2 Número de Telefone

- Utilize um número real homologado no WhatsApp Business Account
- O número **não pode** estar ativo em outro app/dispositivo WA
- Verifique o número via OTP no painel Meta

### 2.3 Templates de Mensagem

- Todos os templates devem ser **aprovados pelo Meta** antes de uso
- Categoria: `MARKETING`, `UTILITY`, ou `AUTHENTICATION`
- Migrar os templates existentes do Umbler para o **Meta Template Manager**
- URL: `business.facebook.com/wa/manage/message-templates/`

### 2.4 Webhook de Verificação

- O endpoint de webhook precisa estar **publicamente acessível** (HTTPS)
- Configure um `VERIFY_TOKEN` secreto para verificação inicial do Meta

---

## 3. Variáveis de Ambiente

Substituir no `.env`:

```bash
# Remover (Umbler)
# UMBLER_API_KEY=...
# UMBLER_ORGANIZATION_ID=...
# UMBLER_ENDPOINT=...

# Adicionar (WhatsApp Cloud API)
WA_PHONE_NUMBER_ID=          # ID do número de telefone (ex: 106540352242922)
WA_ACCESS_TOKEN=             # Token de acesso permanente do System User
WA_WEBHOOK_VERIFY_TOKEN=     # Token secreto para verificação do webhook
WA_WABA_ID=                  # WhatsApp Business Account ID
WA_API_VERSION=v21.0         # Versão da Graph API (manter atualizado)
```

---

## 4. Passo a Passo de Implementação

---

### ETAPA 1 — Criar o Cliente da WA Cloud API

**Arquivo:** `server/integrations/whatsapp.ts`

Este arquivo substitui `server/integrations/umbler.ts` como camada de acesso à API.

```typescript
const BASE_URL = `https://graph.facebook.com/${process.env.WA_API_VERSION}`;
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;

const headers = {
  "Authorization": `Bearer ${ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};

// ── Enviar mensagem de texto simples ──────────────────────────────────────────
export async function sendTextMessage(to: string, text: string) {
  const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,               // formato E.164, ex: "5511999999999"
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// ── Enviar template message ───────────────────────────────────────────────────
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  components?: object[],
) {
  const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components && { components }),
      },
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// ── Upload de mídia ───────────────────────────────────────────────────────────
export async function uploadMedia(
  file: Buffer,
  filename: string,
  contentType: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", new Blob([file], { type: contentType }), filename);
  formData.append("messaging_product", "whatsapp");
  formData.append("type", contentType);

  const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    body: formData,
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.id; // media_id para usar em mensagens
}

// ── Enviar mensagem com mídia ─────────────────────────────────────────────────
export async function sendMediaMessage(
  to: string,
  mediaId: string,
  mediaType: "image" | "document" | "video" | "audio",
  caption?: string,
) {
  const response = await fetch(`${BASE_URL}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: mediaType,
      [mediaType]: {
        id: mediaId,
        ...(caption && { caption }),
      },
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

// ── Listar templates aprovados ────────────────────────────────────────────────
export async function getApprovedTemplates() {
  const wabaid = process.env.WA_WABA_ID;
  const response = await fetch(
    `${BASE_URL}/${wabaid}/message_templates?status=APPROVED&limit=100`,
    { headers },
  );

  if (!response.ok) throw new Error(await response.text());
  return response.json();
}
```

---

### ETAPA 2 — Webhook de Entrada (Recepção de Status e Mensagens)

**Arquivo:** `server/routes/whatsapp-webhook.routes.ts`

A WA Cloud API notifica sua aplicação via POST sobre:
- Status de entrega de mensagens enviadas (`sent`, `delivered`, `read`, `failed`)
- Mensagens recebidas de clientes

```typescript
import { Router } from "express";

const router = Router();

// GET — verificação inicial do webhook pelo Meta
router.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WA_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST — receber notificações de status e mensagens
router.post("/webhook/whatsapp", (req, res) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    return res.sendStatus(404);
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Atualização de status de mensagem enviada
      for (const status of value.statuses ?? []) {
        handleMessageStatus(status);
      }

      // Mensagens recebidas
      for (const message of value.messages ?? []) {
        handleIncomingMessage(message, value.metadata);
      }
    }
  }

  res.sendStatus(200); // responder 200 rapidamente
});

async function handleMessageStatus(status: {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  timestamp: string;
  errors?: any[];
}) {
  // Atualizar status na tabela umblerCampaignMessages ou calls
  // substituindo o campo umblerMessageStatus
  console.log(`[WA Webhook] Message ${status.id} → ${status.status}`);
  // TODO: db.update(calls).set({ waMessageStatus: status.status }).where(...)
}

async function handleIncomingMessage(
  message: { from: string; type: string; text?: { body: string }; id: string },
  metadata: { phone_number_id: string; display_phone_number: string },
) {
  console.log(`[WA Webhook] Mensagem recebida de ${message.from}: ${message.text?.body}`);
  // TODO: lógica de resposta automática, CRM actions, etc.
}

export default router;
```

**Registrar em** `server/routes/index.ts`:
```typescript
import whatsappWebhookRouter from "./whatsapp-webhook.routes";
app.use("/api", whatsappWebhookRouter);
```

**Configurar no painel Meta:**
- URL do Callback: `https://seu-dominio.com/api/webhook/whatsapp`
- Token de verificação: valor de `WA_WEBHOOK_VERIFY_TOKEN`
- Campos assinados: `messages`

---

### ETAPA 3 — Migrar Envio de Mensagem Pós-Chamada

**Arquivo atual:** `server/services/umbler-post-call.service.ts`  
**Arquivo novo:** `server/services/whatsapp-post-call.service.ts`

```typescript
import { sendTemplateMessage } from "../integrations/whatsapp";

export async function sendPostCallMessage(
  clientPhone: string,
  clientName: string,
  templateName: string, // nome do template aprovado no Meta
): Promise<"enviado" | "falhou"> {
  try {
    // Formatar número E.164 (remover caracteres especiais)
    const to = clientPhone.replace(/\D/g, "");

    await sendTemplateMessage(to, templateName, "pt_BR", [
      {
        type: "body",
        parameters: [
          { type: "text", parameter_name: "nome", text: clientName },
        ],
      },
    ]);

    return "enviado";
  } catch (error) {
    console.error("[WA Post-Call] Falha ao enviar:", error);
    return "falhou";
  }
}
```

---

### ETAPA 4 — Migrar Automação de Aniversário

**Arquivo atual:** `server/jobs/send-birthday-mensage.ts`  
**Arquivo novo:** `server/jobs/send-birthday-message.ts`

A lógica de "bot de aniversário" do Umbler é substituída por envio direto de template aprovado:

```typescript
import { db } from "server/db";
import { clients } from "@shared/schema";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIMEZONE = "America/Sao_Paulo";
const BIRTHDAY_TEMPLATE = "aniversario_cliente"; // nome do template aprovado

export async function sendBirthdayMessages() {
  const today = toZonedTime(new Date(), TIMEZONE);
  const todayMMDD = format(today, "MM-dd");

  // Buscar clientes com aniversário hoje
  const birthdayClients = await db.query.clients.findMany({
    where: (c, { sql }) =>
      sql`TO_CHAR(${c.birthDate}, 'MM-DD') = ${todayMMDD}`,
  });

  console.log(`[Birthday] ${birthdayClients.length} aniversariantes hoje`);

  for (const client of birthdayClients) {
    if (!client.phone) continue;

    try {
      const to = client.phone.replace(/\D/g, "");
      await sendTemplateMessage(to, BIRTHDAY_TEMPLATE, "pt_BR", [
        {
          type: "body",
          parameters: [
            { type: "text", parameter_name: "nome", text: client.name },
          ],
        },
      ]);
      console.log(`[Birthday] ✓ Mensagem enviada para ${client.name}`);

      // Rate limiting: aguardar entre envios para não exceder limite
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`[Birthday] ✗ Falha para ${client.name}:`, error);
    }
  }
}
```

---

### ETAPA 5 — Migrar Campanhas (Bulk Send)

**Arquivos atuais:** `server/controllers/campaigns/`

A campanha no Umbler usava `bulk-send-session` + `scheduled-messages`. Na WA Cloud API, você faz um loop controlado de envio de template messages.

**Regras importantes da Meta para envio em massa:**
- Só é permitido enviar templates para usuários que **já interagiram** ou em janela de 24h após último contato
- Templates de marketing exigem opt-in do usuário
- Limite de taxa: varia por nível da conta (Tier 1: 1.000/dia → Tier 4: ilimitado)

**Lógica de campanha:**

```typescript
// server/services/whatsapp-campaign.service.ts
import { db } from "server/db";
import { umblerCampaignMessages } from "@shared/schema";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { eq } from "drizzle-orm";

const DELAY_BETWEEN_MESSAGES_MS = 1000; // 1 segundo entre envios

export async function executeCampaign(campaignId: number) {
  const messages = await db.query.umblerCampaignMessages.findMany({
    where: (m, { eq }) => eq(m.campaignId, campaignId) && eq(m.status, "scheduled"),
  });

  for (const msg of messages) {
    try {
      const to = msg.phoneNumber.replace(/\D/g, "");
      
      await sendTemplateMessage(to, msg.templateName, "pt_BR");

      await db
        .update(umblerCampaignMessages)
        .set({ status: "sent" })
        .where(eq(umblerCampaignMessages.id, msg.id));

      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MESSAGES_MS));
    } catch (error) {
      await db
        .update(umblerCampaignMessages)
        .set({ status: "failed" })
        .where(eq(umblerCampaignMessages.id, msg.id));
    }
  }
}
```

---

### ETAPA 6 — Migrar Tags e Sincronização de Contatos

**Situação atual:** O worker `umbler-sync.worker.ts` sincroniza tags de contatos do Umbler para o CRM.

**Na WA Cloud API não existe sistema de tags** — o WhatsApp não é um CRM. A solução é:

1. **Remover a dependência do Umbler para tags**
2. Gerenciar tags diretamente no banco de dados do CRM
3. Adicionar tabela `contactTags` (se ainda não existir) em `shared/schema.ts`

```typescript
// Em shared/schema.ts — adicionar se não existir
export const contactTags = pgTable("contact_tags", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
```

4. Deprecar/remover os arquivos:
   - `server/jobs/umbler-sync.worker.ts`
   - `server/jobs/umbler-sync-scheduler.ts`
   - `server/services/umbler-sync.service.ts`
   - `server/repositories/umbler-sync.repository.ts`
   - `server/routes/umbler-sync.routes.ts`

---

### ETAPA 7 — Schema: Atualizar Campos Relacionados ao Umbler

Em `shared/schema.ts`, renomear/adaptar campos:

```typescript
// Tabela calls — substituir umblerMessageStatus
umblerMessageStatus: text("umbler_message_status")
// → renomear para:
waMessageStatus: text("wa_message_status")

// Tabelas de campanha — remover campos de bot/channel do Umbler
// umblerBotId, umblerChannelId, umblerBotTriggerName → remover ou ignorar
// umblerEnabled → renomear para waEnabled
// umblerChannelId → remover (WA não tem channels da mesma forma)
// umblerMessageText → manter (conteúdo da mensagem)
// Adicionar:
waTemplateName: text("wa_template_name"),   // nome do template no Meta
waTemplateLanguage: text("wa_template_language").default("pt_BR"),
```

Executar após alterações:
```bash
npm run db:push
```

---

### ETAPA 8 — Atualizar Rotas (umbler.routes.ts)

**Arquivo atual:** `server/routes/umbler.routes.ts` (20+ endpoints)

Criar `server/routes/whatsapp.routes.ts` substituindo os endpoints relevantes:

| Endpoint Umbler                        | Novo Endpoint WA                     | Observação                                |
|----------------------------------------|--------------------------------------|-------------------------------------------|
| `GET /umbler/channels`                 | Remover                              | WA usa phone_number_id fixo               |
| `GET /umbler/bot`                      | Remover                              | Não há equivalente                        |
| `GET /umbler/contacts/:phone`          | Remover ou redirecionar ao DB local  | WA não tem busca de contatos              |
| `POST /umbler/contacts/create`         | Remover                              | WA identifica por telefone                |
| `PUT /umbler/contacts/:id`             | Remover ou atualizar DB local        | Sem equivalente direto                    |
| `DELETE /umbler/contacts/:id`          | Remover                              | Sem equivalente                           |
| `POST /umbler/chats`                   | Remover                              | WA envia direto, sem criar chat           |
| `POST /umbler/messages`                | `POST /whatsapp/messages`            | Substituição direta                       |
| `POST /umbler/template-messages`       | `POST /whatsapp/template-messages`   | Substituição direta                       |
| `POST /umbler/campaigns`               | `POST /whatsapp/campaigns`           | Manter lógica, adaptar execução           |
| `GET /umbler/campaigns`                | `GET /whatsapp/campaigns`            | Manter                                    |
| `GET /umbler/campaigns/:id/stats`      | `GET /whatsapp/campaigns/:id/stats`  | Manter                                    |

---

### ETAPA 9 — Atualizar Frontend

**Arquivos de UI a atualizar:**
- `client/src/pages/umbler-contacts.tsx` → adaptar para mostrar contatos do CRM
- `client/src/components/umbler-sync-management.tsx` → remover ou substituir
- `client/src/hooks/use-umbler-*.ts` → atualizar endpoints referenciados

**No frontend, os hooks precisarão apontar para as novas rotas:**
```typescript
// Antes:
const { data } = useQuery({ queryKey: ["/api/umbler/channels"] });

// Depois (exemplo):
const { data } = useQuery({ queryKey: ["/api/whatsapp/templates"] });
```

---

### ETAPA 10 — Testes e Homologação

1. **Sandbox Meta:** Use o número de teste fornecido pelo Meta para desenvolvimento inicial
2. **Verificar webhook:** Use a ferramenta de teste de webhooks no painel Meta
3. **Templates:** Teste cada template com o número de sandbox antes de produção
4. **Rate limits:** Valide o comportamento com os limites de cada tier
5. **Migração gradual:** Considere manter Umbler ativo temporariamente em paralelo

---

## 5. Limites e Considerações da WA Cloud API

| Aspecto                  | Detalhe                                                              |
|--------------------------|----------------------------------------------------------------------|
| **Janela de mensagens**  | 24h após último contato do cliente para mensagens livres             |
| **Templates**            | Fora da janela de 24h, obrigatório usar templates aprovados          |
| **Rate limit (Tier 1)**  | 1.000 conversas únicas por dia                                       |
| **Rate limit (Tier 2)**  | 10.000 conversas únicas por dia                                      |
| **Rate limit (Tier 3)**  | 100.000 conversas únicas por dia                                     |
| **Media**                | URLs públicas ou upload via `/media` endpoint                        |
| **Formato de telefone**  | Obrigatório E.164 sem `+` (ex: `5511999999999`)                      |
| **Custo**                | Cobrado por conversa (24h window), varia por categoria e país        |
| **Opt-in**               | Marketing templates exigem opt-in explícito documentado              |

---

## 6. Ordem de Execução Recomendada

```
[ ] 1. Configurar Meta App + número de telefone
[ ] 2. Criar/migrar templates no Meta Template Manager
[ ] 3. Adicionar variáveis de ambiente (WA_*)
[ ] 4. Implementar server/integrations/whatsapp.ts (Etapa 1)
[ ] 5. Implementar webhook receiver (Etapa 2)
[ ] 6. Migrar post-call service (Etapa 3)
[ ] 7. Migrar job de aniversário (Etapa 4)
[ ] 8. Migrar campanhas (Etapa 5)
[ ] 9. Deprecar sync worker do Umbler (Etapa 6)
[ ] 10. Atualizar schema DB (Etapa 7)
[ ] 11. Refatorar rotas (Etapa 8)
[ ] 12. Atualizar frontend (Etapa 9)
[ ] 13. Testes e homologação (Etapa 10)
[ ] 14. Remover código Umbler após estabilização
```

---

## 7. Arquivos para Remover/Deprecar (após estabilização)

```
server/integrations/umbler.ts
server/integrations/interfaces/ (criar equivalentes WA se necessário)
server/services/umbler-sync.service.ts
server/services/umbler-post-call.service.ts  (substituído)
server/jobs/umbler-sync.worker.ts
server/jobs/umbler-sync-scheduler.ts
server/jobs/send-birthday-mensage.ts         (substituído)
server/repositories/umbler-sync.repository.ts
server/routes/umbler.routes.ts               (substituído)
server/routes/umbler-sync.routes.ts
client/src/components/umbler-sync-management.tsx
client/src/hooks/use-umbler-*.ts
```

---

## 8. Referências

- Documentação oficial: `developers.facebook.com/docs/whatsapp/cloud-api`
- Gerenciamento de templates: `business.facebook.com/wa/manage/message-templates/`
- Webhooks reference: `developers.facebook.com/docs/whatsapp/webhooks`
- Graph API Explorer: `developers.facebook.com/tools/explorer/`
- Limites de taxa: `developers.facebook.com/docs/whatsapp/messaging-limits`
