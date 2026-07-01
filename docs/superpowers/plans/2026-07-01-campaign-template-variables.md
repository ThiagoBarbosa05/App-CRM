# Campaign Template Variables & Header Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user filling in a Meta WhatsApp template for a campaign (`client/src/pages/whatsapp/create-campaign.tsx`) provide body/header variable values — with per-client personalization tokens like `{{nome}}` — and pick header media (image/video/document), the same way it already works in the bot editor and the chat template-send feature.

**Architecture:** Variable values and header media are stored per-campaign on new columns in the `campaigns` table (not on the shared `whatsapp_templates` row, which stays untouched to avoid corrupting birthday/post-call template configs). At dispatch time, the existing `interpolate()` function and a newly-extracted `buildClientVariables()` helper (both in `whatsapp-bot-engine.service.ts`) resolve tokens per-recipient, mirroring exactly how the bot engine already personalizes messages.

**Tech Stack:** React 18 + TypeScript (frontend), Express + Drizzle ORM + Neon Postgres (backend), Meta WhatsApp Cloud API.

## Global Constraints

- `strict: true` TypeScript — never use `any`. Always `async/await`, never `.then()` chains.
- Never run `npm run db:push`. Schema changes are applied with a manual SQL script under `scripts/`, following the exact pattern of `scripts/add-bot-session-campaign-cols.mjs` (uses `@neondatabase/serverless`, reads `DATABASE_URL` from `.env`).
- Run `npm run check` after every task that touches TypeScript and confirm it introduces no new errors (the repo already has pre-existing unrelated errors in `server/storage.ts` — ignore those, only watch for new ones in files you touched).
- The project's automated test runner (`vitest`) is currently broken against the installed `vite` version (known issue, not in scope here) — do not attempt to fix it or rely on it; verify manually instead (browser + `npm run check`).
- Before running the DB migration script against the real database, or before restarting/killing any running dev server, stop and ask the user for confirmation first.
- Follow existing code style exactly: no comments except where a subtle invariant needs explaining, PT-BR user-facing strings and UI copy (matches the rest of the app).

---

### Task 1: Migration script — add campaign template param columns

**Files:**
- Create: `scripts/add-campaign-template-params-cols.mjs`

**Interfaces:**
- Produces: 4 new nullable columns on the `campaigns` Postgres table — `meta_template_body_params` (jsonb), `meta_template_header_params` (jsonb), `meta_template_header_media_storage_key` (text), `meta_template_header_media_type` (text). Task 2 maps these into Drizzle.

- [ ] **Step 1: Write the migration script**

```js
/**
 * Adiciona colunas de variáveis/mídia de template (por campanha) à tabela
 * campaigns, usadas para personalizar o corpo/cabeçalho de templates Meta
 * enviados por campanhas de WhatsApp.
 *
 * Uso (banco de produção):
 *   node scripts/add-campaign-template-params-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-campaign-template-params-cols.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS meta_template_body_params jsonb,
    ADD COLUMN IF NOT EXISTS meta_template_header_params jsonb,
    ADD COLUMN IF NOT EXISTS meta_template_header_media_storage_key text,
    ADD COLUMN IF NOT EXISTS meta_template_header_media_type text
`;

const cols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'campaigns' AND column_name LIKE 'meta_template%'
  ORDER BY column_name
`;
console.log("[migration] Colunas meta_template* em campaigns:", cols.map((c) => c.column_name));
```

- [ ] **Step 2: Ask the user for confirmation, then run it**

Ask: "Vou rodar `node scripts/add-campaign-template-params-cols.mjs` contra o banco configurado em `DATABASE_URL`. Posso prosseguir?" Only after explicit yes:

Run: `node scripts/add-campaign-template-params-cols.mjs`
Expected output: `[migration] Colunas meta_template* em campaigns: [ 'meta_template_body_params', 'meta_template_header_media_storage_key', 'meta_template_header_media_type', 'meta_template_header_params' ]`

- [ ] **Step 3: Commit**

```bash
git add scripts/add-campaign-template-params-cols.mjs
git commit -m "feat: add migration for campaign template params/header media columns"
```

---

### Task 2: Schema — add new columns to `campaigns` in Drizzle

**Files:**
- Modify: `shared/schema.ts:3998-4028` (the `campaigns` table definition)

**Interfaces:**
- Consumes: nothing new.
- Produces: `campaigns.metaTemplateBodyParams`, `campaigns.metaTemplateHeaderParams` (both `unknown` jsonb columns, cast to `string[]` where read), `campaigns.metaTemplateHeaderMediaStorageKey: string | null`, `campaigns.metaTemplateHeaderMediaType: "image" | "video" | "document" | null`. Tasks 4 and 5 write/read these.

- [ ] **Step 1: Add the columns to the Drizzle table**

In `shared/schema.ts`, inside `export const campaigns = pgTable("campaigns", { ... })`, right after the `waTriggerDecision: text("wa_trigger_decision"),` line, add:

```ts
  metaTemplateBodyParams: jsonb("meta_template_body_params"),
  metaTemplateHeaderParams: jsonb("meta_template_header_params"),
  metaTemplateHeaderMediaStorageKey: text("meta_template_header_media_storage_key"),
  metaTemplateHeaderMediaType: text("meta_template_header_media_type", {
    enum: ["image", "video", "document"],
  }),
```

(`jsonb` and `text` are already imported at the top of `shared/schema.ts` — the `whatsappTemplates` table a few hundred lines above uses the exact same helpers.)

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "shared/schema"`
Expected: no output (no new errors attributable to this file).

- [ ] **Step 3: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: add campaign template params/header media columns to schema"
```

---

### Task 3: Extract `buildClientVariables` helper in the bot engine

**Files:**
- Modify: `server/services/whatsapp-bot-engine.service.ts:1-40` (imports), `:282-284` (near `interpolate`), `:1071-1091` (inline block inside `startBotSession`)

**Interfaces:**
- Consumes: `Client` type from `@shared/schema` (`export type Client = typeof clients.$inferSelect;`, already exported).
- Produces: `export function buildClientVariables(client: Client | null, phone: string): Record<string, string>` — used by Task 5's dispatcher.

- [ ] **Step 1: Import the `Client` type**

In `server/services/whatsapp-bot-engine.service.ts`, in the existing `@shared/schema` import block (around line 13), add `Client` next to `clients`:

```ts
  clients,
  type Client,
  CONTACT_FIELD_WHITELIST,
```

- [ ] **Step 2: Add the exported helper right after `interpolate`**

Immediately after the existing `interpolate` function (around line 284):

```ts
/** Monta o mapa de variáveis de personalização a partir dos dados de um cliente. */
export function buildClientVariables(client: Client | null, phone: string): Record<string, string> {
  const vars: Record<string, string> = { telefone: phone };
  if (!client) return vars;
  if (client.name) vars.nome = client.name;
  if (client.email) vars.email = client.email;
  if (client.cpf) vars.cpf = client.cpf;
  if (client.birthday) vars.aniversario = client.birthday;
  if (client.city) vars.cidade = client.city;
  if (client.state) vars.estado = client.state;
  if (client.fixedPhone) vars.telefone_fixo = client.fixedPhone;
  if (client.address) vars.endereco = client.address;
  if (client.neighborhood) vars.bairro = client.neighborhood;
  return vars;
}
```

- [ ] **Step 3: Replace the inline block in `startBotSession` with a call to the helper**

Find this block (around line 1071-1091):

```ts
  // Injeta campos do cliente como variáveis iniciais da sessão
  const clientVars: Record<string, string> = { telefone: phone };
  const [convRow] = await db
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .limit(1);
  if (convRow?.clientId) {
    const [client] = await db.select().from(clients).where(eq(clients.id, convRow.clientId)).limit(1);
    if (client) {
      if (client.name)         clientVars.nome          = client.name;
      if (client.email)        clientVars.email         = client.email;
      if (client.cpf)          clientVars.cpf           = client.cpf;
      if (client.birthday)     clientVars.aniversario   = client.birthday;
      if (client.city)         clientVars.cidade        = client.city;
      if (client.state)        clientVars.estado        = client.state;
      if (client.fixedPhone)   clientVars.telefone_fixo = client.fixedPhone;
      if (client.address)      clientVars.endereco      = client.address;
      if (client.neighborhood) clientVars.bairro        = client.neighborhood;
    }
  }
```

Replace it with:

```ts
  // Injeta campos do cliente como variáveis iniciais da sessão
  const [convRow] = await db
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .limit(1);
  let clientRow: Client | null = null;
  if (convRow?.clientId) {
    const [client] = await db.select().from(clients).where(eq(clients.id, convRow.clientId)).limit(1);
    clientRow = client ?? null;
  }
  const clientVars = buildClientVariables(clientRow, phone);
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "whatsapp-bot-engine"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/services/whatsapp-bot-engine.service.ts
git commit -m "refactor: extract buildClientVariables helper from startBotSession"
```

---

### Task 4: Campaign creation route accepts header params/media

**Files:**
- Modify: `server/routes/campaigns.routes.ts:42-133`

**Interfaces:**
- Consumes: `buildClientVariables` not needed here (creation only stores raw param arrays, no interpolation happens at creation time).
- Produces: `POST /api/campaigns` now accepts `metaTemplateHeaderParams?: string[]` and `metaTemplateHeaderMedia?: { storageKey: string; mediaType: "image"|"video"|"document" }`, and stores all 4 new fields on the created `campaigns` row. Task 6's hook and Task 5's dispatcher rely on this.

- [ ] **Step 1: Accept the new fields in the request body destructuring**

In `server/routes/campaigns.routes.ts`, in the `router.post("/", ...)` handler, extend the destructuring (currently ending at `metaTemplateBodyParams,` around line 62) and its type annotation (around line 83):

```ts
    const {
      name,
      description,
      type,
      elevenLabsAgentId,
      elevenLabsVoiceId,
      startDate,
      endDate,
      umblerEnabled,
      umblerChannelId,
      umblerBotId,
      umblerBotTriggerName,
      umblerMessageText,
      umblerTriggerDecision,
      waEnabled,
      waTemplateId,
      waBotId,
      metaTemplateName,
      metaTemplateLanguage,
      metaTemplateCategory,
      metaTemplateBodyParams,
      metaTemplateHeaderParams,
      metaTemplateHeaderMedia,
    } = req.body as {
      name: string;
      description?: string;
      type: "humano" | "ia";
      elevenLabsAgentId?: string;
      elevenLabsVoiceId?: string;
      startDate?: string;
      endDate?: string;
      umblerEnabled?: boolean;
      umblerChannelId?: string;
      umblerBotId?: string;
      umblerBotTriggerName?: string;
      umblerMessageText?: string;
      umblerTriggerDecision?: string;
      waEnabled?: boolean;
      waTemplateId?: string;
      waBotId?: string;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      metaTemplateCategory?: string;
      metaTemplateBodyParams?: string[];
      metaTemplateHeaderParams?: string[];
      metaTemplateHeaderMedia?: { storageKey: string; mediaType: "image" | "video" | "document" };
    };
```

- [ ] **Step 2: Stop passing `bodyParams` into `ensureLocalTemplateForMeta`**

Find (around line 96-102):

```ts
      const local = await ensureLocalTemplateForMeta({
        name: metaTemplateName,
        languageCode: metaTemplateLanguage || "pt_BR",
        category: metaTemplateCategory,
        bodyParams: metaTemplateBodyParams,
        createdBy: userId,
      });
```

Replace with (drop the `bodyParams` line — this is what stops per-campaign values from leaking into the shared `whatsapp_templates` row used by birthday/post-call templates):

```ts
      const local = await ensureLocalTemplateForMeta({
        name: metaTemplateName,
        languageCode: metaTemplateLanguage || "pt_BR",
        category: metaTemplateCategory,
        createdBy: userId,
      });
```

- [ ] **Step 3: Store the new fields on the `campaigns` insert**

Find the `.values({...})` block (around line 106-126) and add the 4 fields right after `waBotId: waBotId ?? null,`:

```ts
        waTemplateId: resolvedTemplateId,
        waBotId: waBotId ?? null,
        metaTemplateBodyParams: metaTemplateBodyParams ?? null,
        metaTemplateHeaderParams: metaTemplateHeaderParams ?? null,
        metaTemplateHeaderMediaStorageKey: metaTemplateHeaderMedia?.storageKey ?? null,
        metaTemplateHeaderMediaType: metaTemplateHeaderMedia?.mediaType ?? null,
        createdBy: userId ?? null,
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "campaigns.routes"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/routes/campaigns.routes.ts
git commit -m "feat: accept header params/media on campaign creation"
```

---

### Task 5: Dispatcher builds header/body components with per-client interpolation

**Files:**
- Modify: `server/services/whatsapp-campaign.service.ts` (imports at top, the template branch inside `executeCampaign` around lines 124-175, and the `buildBodyParams` function around lines 204-215)

**Interfaces:**
- Consumes: `buildClientVariables(client: Client | null, phone: string)` and `interpolate(text: string, variables: Record<string,string>)` from Task 3 (both exported from `./whatsapp-bot-engine.service`); `getPublicR2Url(storageKey: string)` from `../lib/r2`; `campaigns.metaTemplateBodyParams/HeaderParams/HeaderMediaStorageKey/HeaderMediaType` from Task 2.
- Produces: `executeCampaign` now sends templates with correctly interpolated body/header text and header media, for both immediate and scheduled campaigns.

- [ ] **Step 1: Update imports**

At the top of `server/services/whatsapp-campaign.service.ts`, replace:

```ts
import { db } from "server/db";
import { campaigns, whatsappCampaignMessages, whatsappTemplates, whatsappBots, whatsappMessages } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { formatPhoneToDigits } from "../lib/format-phone";
import { startBotSession } from "./whatsapp-bot-engine.service";
import { findOrCreateConversation } from "./whatsapp-conversations.service";
```

with:

```ts
import { db } from "server/db";
import { campaigns, whatsappCampaignMessages, whatsappTemplates, whatsappBots, whatsappMessages, clients } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { sendTemplateMessage } from "../integrations/whatsapp";
import { getWhatsappSettingsRaw } from "./whatsapp-settings.service";
import { formatPhoneToDigits } from "../lib/format-phone";
import { startBotSession, buildClientVariables, interpolate } from "./whatsapp-bot-engine.service";
import { findOrCreateConversation } from "./whatsapp-conversations.service";
import { getPublicR2Url } from "../lib/r2";
```

- [ ] **Step 2: Replace the template-branch dispatch loop**

Find (around lines 124-175, the `else { // ── Template campaign ...` branch):

```ts
  } else {
    // ── Template campaign: enviar mensagem de template para cada contato ──────
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, campaign.waTemplateId!));

    if (!template) throw new Error(`Template ${campaign.waTemplateId} não encontrado`);

    for (const msg of pendingMessages) {
      if (!msg.phoneNumber) {
        console.warn(`[WaCampaign] Mensagem ${msg.id} sem phoneNumber — pulando`);
        skipped++;
        continue;
      }
      const phoneE164 = formatPhoneToDigits(msg.phoneNumber);
      const bodyParams = buildBodyParams(template.bodyParams, msg.contactName);
      const components =
        bodyParams.length > 0 ? [{ type: "body", parameters: bodyParams }] : undefined;

      try {
```

Replace the highlighted middle section (keep everything else in the loop, including the `try`/`catch` body untouched) so it reads:

```ts
  } else {
    // ── Template campaign: enviar mensagem de template para cada contato ──────
    const [template] = await db
      .select()
      .from(whatsappTemplates)
      .where(eq(whatsappTemplates.id, campaign.waTemplateId!));

    if (!template) throw new Error(`Template ${campaign.waTemplateId} não encontrado`);

    for (const msg of pendingMessages) {
      if (!msg.phoneNumber) {
        console.warn(`[WaCampaign] Mensagem ${msg.id} sem phoneNumber — pulando`);
        skipped++;
        continue;
      }
      const phoneE164 = formatPhoneToDigits(msg.phoneNumber);

      let clientRow: typeof clients.$inferSelect | undefined;
      if (msg.contactId) {
        [clientRow] = await db.select().from(clients).where(eq(clients.id, msg.contactId));
      }
      const clientVars = buildClientVariables(clientRow ?? null, phoneE164);
      const components = buildTemplateComponents(campaign, clientVars);

      try {
```

- [ ] **Step 3: Replace `buildBodyParams` with `buildTemplateComponents`**

Find the existing helper (around line 204-215):

```ts
function buildBodyParams(
  bodyParams: unknown,
  contactName: string,
): { type: string; text: string }[] {
  if (!Array.isArray(bodyParams)) return [];

  return bodyParams.map((param: unknown) => {
    const key = typeof param === "string" ? param : String(param);
    const value = key === "nome" ? contactName.split(" ")[0] : key;
    return { type: "text", text: value };
  });
}
```

Replace it entirely with:

```ts
function buildTemplateComponents(
  campaign: typeof campaigns.$inferSelect,
  variables: Record<string, string>,
): object[] | undefined {
  const components: object[] = [];

  if (campaign.metaTemplateHeaderMediaStorageKey && campaign.metaTemplateHeaderMediaType) {
    components.push({
      type: "header",
      parameters: [
        {
          type: campaign.metaTemplateHeaderMediaType,
          [campaign.metaTemplateHeaderMediaType]: {
            link: getPublicR2Url(campaign.metaTemplateHeaderMediaStorageKey),
          },
        },
      ],
    });
  } else if (
    Array.isArray(campaign.metaTemplateHeaderParams) &&
    campaign.metaTemplateHeaderParams.length > 0
  ) {
    components.push({
      type: "header",
      parameters: (campaign.metaTemplateHeaderParams as string[]).map((p) => ({
        type: "text",
        text: interpolate(p, variables),
      })),
    });
  }

  if (Array.isArray(campaign.metaTemplateBodyParams) && campaign.metaTemplateBodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: (campaign.metaTemplateBodyParams as string[]).map((p) => ({
        type: "text",
        text: interpolate(p, variables),
      })),
    });
  }

  return components.length > 0 ? components : undefined;
}
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "whatsapp-campaign.service"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add server/services/whatsapp-campaign.service.ts
git commit -m "feat: personalize campaign template body/header via client variables"
```

---

### Task 6: Extend `useCreateCampaignWithDispatch` hook payload

**Files:**
- Modify: `client/src/hooks/use-whatsapp.ts:310-353`

**Interfaces:**
- Consumes: nothing new.
- Produces: mutation input type gains `metaTemplateHeaderParams?: string[]` and `metaTemplateHeaderMedia?: { storageKey: string; mediaType: "image"|"video"|"document" }`, forwarded verbatim to `POST /api/campaigns`. Task 9 (create-campaign.tsx submit) relies on this.

- [ ] **Step 1: Extend the mutation input type and POST body**

Find (around line 310-336):

```ts
export function useCreateCampaignWithDispatch() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      waTemplateId?: string;
      waBotId?: string;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      metaTemplateCategory?: string;
      metaTemplateBodyParams?: string[];
      clientIds: string[];
      scheduledAt?: string; // ISO; se no futuro, a campanha fica agendada
    }) => {
      const campaignRes = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        description: data.description,
        type: "humano",
        waEnabled: true,
        waTemplateId: data.waTemplateId ?? null,
        waBotId: data.waBotId ?? null,
        metaTemplateName: data.metaTemplateName,
        metaTemplateLanguage: data.metaTemplateLanguage,
        metaTemplateCategory: data.metaTemplateCategory,
        metaTemplateBodyParams: data.metaTemplateBodyParams,
      });
```

Replace with:

```ts
export function useCreateCampaignWithDispatch() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      waTemplateId?: string;
      waBotId?: string;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      metaTemplateCategory?: string;
      metaTemplateBodyParams?: string[];
      metaTemplateHeaderParams?: string[];
      metaTemplateHeaderMedia?: { storageKey: string; mediaType: "image" | "video" | "document" };
      clientIds: string[];
      scheduledAt?: string; // ISO; se no futuro, a campanha fica agendada
    }) => {
      const campaignRes = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        description: data.description,
        type: "humano",
        waEnabled: true,
        waTemplateId: data.waTemplateId ?? null,
        waBotId: data.waBotId ?? null,
        metaTemplateName: data.metaTemplateName,
        metaTemplateLanguage: data.metaTemplateLanguage,
        metaTemplateCategory: data.metaTemplateCategory,
        metaTemplateBodyParams: data.metaTemplateBodyParams,
        metaTemplateHeaderParams: data.metaTemplateHeaderParams,
        metaTemplateHeaderMedia: data.metaTemplateHeaderMedia,
      });
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "use-whatsapp"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/use-whatsapp.ts
git commit -m "feat: forward header params/media in campaign creation hook"
```

---

### Task 7: Variable-token infrastructure + preview in `create-campaign.tsx`

**Files:**
- Modify: `client/src/pages/whatsapp/create-campaign.tsx:1-113` (imports/types area) and `:496-519` (`TemplatePreview`)

**Interfaces:**
- Consumes: `parseTemplateVars`, `getTemplateBodyText`, `getTemplateHeaderText`, `renderTemplateText` from `@/lib/whatsapp-template` (already imported).
- Produces: `type TemplateHeaderMediaValue`, `CLIENT_VARIABLE_TOKENS`, `CLIENT_VARIABLE_LABELS`, `ClientVariableMenu` component, and an updated `TemplatePreview` that takes `bodyParams`/`headerParams` props. Task 8 renders `ClientVariableMenu` inside the new config form; Task 9 renders the updated `TemplatePreview`.

- [ ] **Step 1: Add new imports**

At the top of `client/src/pages/whatsapp/create-campaign.tsx`, add to the `lucide-react` import list (`User` icon) and add the dropdown-menu import:

```ts
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Users,
  FileText,
  Info,
  Send,
  Search,
  X,
  MessageCircle,
  Loader2,
  Bot,
  AlertTriangle,
  PhoneOff,
  Clock,
  User,
} from "lucide-react";
```

and, near the other `@/components/ui/*` imports:

```ts
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { AttachFileDialog } from "@/components/media-library/attach-file-dialog";
```

- [ ] **Step 2: Add the token constants and media type, right after the existing `Client` type (around line 57)**

```ts
type TemplateHeaderMediaValue = { storageKey: string; mediaType: "image" | "video" | "document" };

const CLIENT_VARIABLE_TOKENS = [
  { label: "Nome", value: "{{nome}}" },
  { label: "E-mail", value: "{{email}}" },
  { label: "Telefone", value: "{{telefone}}" },
  { label: "Telefone fixo", value: "{{telefone_fixo}}" },
  { label: "CPF", value: "{{cpf}}" },
  { label: "Cidade", value: "{{cidade}}" },
  { label: "Estado", value: "{{estado}}" },
  { label: "Endereço", value: "{{endereco}}" },
  { label: "Bairro", value: "{{bairro}}" },
  { label: "Aniversário", value: "{{aniversario}}" },
];

const CLIENT_VARIABLE_LABELS: Record<string, string> = {
  nome: "Nome do cliente",
  email: "E-mail do cliente",
  telefone: "Telefone do cliente",
  telefone_fixo: "Telefone fixo do cliente",
  cpf: "CPF do cliente",
  cidade: "Cidade do cliente",
  estado: "Estado do cliente",
  endereco: "Endereço do cliente",
  bairro: "Bairro do cliente",
  aniversario: "Aniversário do cliente",
};

function ClientVariableMenu({ onSelect }: { onSelect: (token: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-primary hover:underline"
        >
          <User className="h-3 w-3" />
          Inserir dado
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto">
        {CLIENT_VARIABLE_TOKENS.map((v) => (
          <DropdownMenuItem key={v.value} onClick={() => onSelect(v.value)}>
            <span className="text-xs">{v.label}</span>
            <span className="ml-2 text-[10px] text-muted-foreground font-mono">{v.value}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: Update `TemplatePreview` to render real values with friendly token labels**

Find (around line 496-519):

```tsx
// Pré-visualização estilo bolha WhatsApp
function TemplatePreview({ meta }: { meta: MetaTemplate }) {
  const replacements: Record<string, string> = { nome: "[primeiro nome]" };
  const fallback = (v: string) => `[${v}]`;
  const header = renderTemplateText(getTemplateHeaderText(meta), replacements, fallback);
  const body = renderTemplateText(getTemplateBodyText(meta), replacements, fallback);

  return (
```

Replace with:

```tsx
// Pré-visualização estilo bolha WhatsApp
function TemplatePreview({
  meta,
  bodyParams,
  headerParams,
}: {
  meta: MetaTemplate;
  bodyParams: string[];
  headerParams: string[];
}) {
  const friendlyValue = (raw: string): string => {
    const trimmed = raw.trim();
    const match = /^\{\{(\w+)\}\}$/.exec(trimmed);
    if (match) return `[${CLIENT_VARIABLE_LABELS[match[1]] ?? match[1]}]`;
    return trimmed || "[valor não preenchido]";
  };

  const groups = parseTemplateVars(meta);
  const bodyGroup = groups.find((g) => g.componentType === "body");
  const headerGroup = groups.find((g) => g.componentType === "header" && g.format === "text");

  const bodyReplacements: Record<string, string> = {};
  (bodyGroup?.vars ?? []).forEach((name, i) => {
    bodyReplacements[name] = friendlyValue(bodyParams[i] ?? "");
  });
  const headerReplacements: Record<string, string> = {};
  (headerGroup?.vars ?? []).forEach((name, i) => {
    headerReplacements[name] = friendlyValue(headerParams[i] ?? "");
  });

  const fallback = (v: string) => `[${v}]`;
  const header = renderTemplateText(getTemplateHeaderText(meta), headerReplacements, fallback);
  const body = renderTemplateText(getTemplateBodyText(meta), bodyReplacements, fallback);

  return (
```

(the rest of the function body — the JSX return — stays exactly as-is, no changes needed there).

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "whatsapp/create-campaign"`
Expected: errors about `TemplatePreview` being called with the old 1-prop signature (from the still-unmodified call site) — this is expected and gets fixed in Task 9. Confirm the errors are ONLY about the call site (`meta.only`) missing `bodyParams`/`headerParams`, not about the code you just wrote.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/whatsapp/create-campaign.tsx
git commit -m "feat: add client-variable tokens and richer template preview"
```

---

### Task 8: Template configuration form (variables + header media picker)

**Files:**
- Modify: `client/src/pages/whatsapp/create-campaign.tsx` (new `TemplateConfigForm` component, added right before `StepTemplateOrBot`, around line 521)

**Interfaces:**
- Consumes: `parseTemplateVars` (from `@/lib/whatsapp-template`), `ClientVariableMenu`, `TemplatePreview`, `TemplateHeaderMediaValue` (Task 7), `AttachFileDialog` (from `@/components/media-library/attach-file-dialog`, props: `open`, `onOpenChange`, `lockedType?: "image"|"video"|"document"`, `onAttach: (item: MediaLibraryItem) => void` where `MediaLibraryItem` has `storageKey: string; mediaType: "image"|"video"|"document"`).
- Produces: `function TemplateConfigForm(props): JSX.Element` — used by Task 9 inside `StepTemplateOrBot`.

- [ ] **Step 1: Write `TemplateConfigForm`**

Add this new function right before `function StepTemplateOrBot(...)` (around line 521, after the `TemplatePreview` function from Task 7):

```tsx
function TemplateConfigForm({
  template,
  onChangeTemplate,
  bodyParams,
  onBodyParamsChange,
  headerParams,
  onHeaderParamsChange,
  headerMedia,
  onHeaderMediaChange,
}: {
  template: MetaTemplate;
  onChangeTemplate: () => void;
  bodyParams: string[];
  onBodyParamsChange: (values: string[]) => void;
  headerParams: string[];
  onHeaderParamsChange: (values: string[]) => void;
  headerMedia: TemplateHeaderMediaValue | null;
  onHeaderMediaChange: (media: TemplateHeaderMediaValue | null) => void;
}) {
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const groups = parseTemplateVars(template);
  const bodyGroup = groups.find((g) => g.componentType === "body");
  const headerGroup = groups.find((g) => g.componentType === "header");
  const headerIsMedia = !!headerGroup && headerGroup.format !== "text";

  const setBodyValue = (i: number, value: string) => {
    const next = [...bodyParams];
    next[i] = value;
    onBodyParamsChange(next);
  };
  const setHeaderValue = (i: number, value: string) => {
    const next = [...headerParams];
    next[i] = value;
    onHeaderParamsChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-muted/30">
        <div className="min-w-0">
          <p className="font-semibold font-mono text-sm truncate">{template.name}</p>
          <div className="flex gap-1.5 mt-1">
            <Badge variant="outline" className="text-xs">
              {CATEGORY_LABELS[template.category] ?? template.category}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono">{template.language}</Badge>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onChangeTemplate}>
          Trocar template
        </Button>
      </div>

      {bodyGroup && bodyGroup.vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Variáveis do corpo:</p>
          {bodyGroup.vars.map((name, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground font-mono">{`{{${name}}}`}</label>
                <ClientVariableMenu onSelect={(token) => setBodyValue(i, token)} />
              </div>
              <Input
                value={bodyParams[i] ?? ""}
                onChange={(e) => setBodyValue(i, e.target.value)}
                placeholder="Texto fixo ou {{nome}}, {{email}}..."
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {headerGroup && !headerIsMedia && headerGroup.vars.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium">Variáveis do cabeçalho:</p>
          {headerGroup.vars.map((name, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground font-mono">{`{{${name}}}`}</label>
                <ClientVariableMenu onSelect={(token) => setHeaderValue(i, token)} />
              </div>
              <Input
                value={headerParams[i] ?? ""}
                onChange={(e) => setHeaderValue(i, e.target.value)}
                placeholder="Texto fixo ou {{nome}}, {{email}}..."
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {headerIsMedia && headerGroup && (
        <div className="space-y-2">
          <p className="text-xs font-medium">
            Mídia do cabeçalho (
            {headerGroup.format === "image" ? "imagem" : headerGroup.format === "video" ? "vídeo" : "documento"}
            ):
          </p>
          {headerMedia ? (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border">
              <span className="text-sm text-muted-foreground truncate">Arquivo selecionado</span>
              <Button type="button" variant="outline" size="sm" onClick={() => setMediaDialogOpen(true)}>
                Trocar
              </Button>
            </div>
          ) : (
            <Button type="button" variant="outline" onClick={() => setMediaDialogOpen(true)} className="gap-2">
              <FileText className="h-4 w-4" />
              Selecionar arquivo
            </Button>
          )}
          <AttachFileDialog
            open={mediaDialogOpen}
            onOpenChange={setMediaDialogOpen}
            lockedType={headerGroup.format as "image" | "video" | "document"}
            onAttach={(item) =>
              onHeaderMediaChange({ storageKey: item.storageKey, mediaType: item.mediaType })
            }
          />
        </div>
      )}

      <TemplatePreview meta={template} bodyParams={bodyParams} headerParams={headerParams} />
    </div>
  );
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep -i "whatsapp/create-campaign"`
Expected: same pre-existing errors as Task 7 (call sites not wired yet — fixed in Task 9), no NEW errors inside `TemplateConfigForm` itself.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/whatsapp/create-campaign.tsx
git commit -m "feat: add template variable/header-media configuration form"
```

---

### Task 9: Wire state, validation, and submission in the parent page

**Files:**
- Modify: `client/src/pages/whatsapp/create-campaign.tsx` — `StepTemplateOrBot` (around line 523-703), `WhatsAppCreateCampaign` (around line 812-1011)

**Interfaces:**
- Consumes: `TemplateConfigForm` (Task 8), `TemplateHeaderMediaValue` (Task 7), `useCreateCampaignWithDispatch` payload fields `metaTemplateHeaderParams`/`metaTemplateHeaderMedia` (Task 6).
- Produces: fully working step 3 UI with blocking validation and correct submission payload — the end-user-visible deliverable of this whole plan.

- [ ] **Step 1: Add new props to `StepTemplateOrBot` and swap the template tab's browse view for the config form when a template is selected**

Find the `StepTemplateOrBot` function signature (around line 523-533):

```tsx
function StepTemplateOrBot({
  selectedTemplate,
  selectedBotId,
  onSelectTemplate,
  onSelectBot,
}: {
  selectedTemplate: MetaTemplate | null;
  selectedBotId: string;
  onSelectTemplate: (t: MetaTemplate | null) => void;
  onSelectBot: (id: string) => void;
}) {
```

Replace with:

```tsx
function StepTemplateOrBot({
  selectedTemplate,
  selectedBotId,
  onSelectTemplate,
  onSelectBot,
  bodyParams,
  onBodyParamsChange,
  headerParams,
  onHeaderParamsChange,
  headerMedia,
  onHeaderMediaChange,
}: {
  selectedTemplate: MetaTemplate | null;
  selectedBotId: string;
  onSelectTemplate: (t: MetaTemplate | null) => void;
  onSelectBot: (id: string) => void;
  bodyParams: string[];
  onBodyParamsChange: (values: string[]) => void;
  headerParams: string[];
  onHeaderParamsChange: (values: string[]) => void;
  headerMedia: TemplateHeaderMediaValue | null;
  onHeaderMediaChange: (media: TemplateHeaderMediaValue | null) => void;
}) {
```

Then find the `<TabsContent value="template">` block (around line 559-634):

```tsx
      <TabsContent value="template">
        {templatesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : approvedTemplates.length === 0 ? (
```

Change the opening condition so the config form takes priority. Replace the first line of the block with:

```tsx
      <TabsContent value="template">
        {selectedTemplate ? (
          <TemplateConfigForm
            template={selectedTemplate}
            onChangeTemplate={() => onSelectTemplate(null)}
            bodyParams={bodyParams}
            onBodyParamsChange={onBodyParamsChange}
            headerParams={headerParams}
            onHeaderParamsChange={onHeaderParamsChange}
            headerMedia={headerMedia}
            onHeaderMediaChange={onHeaderMediaChange}
          />
        ) : templatesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : approvedTemplates.length === 0 ? (
```

And remove the now-redundant preview line at the very end of that same `TabsContent` (it was only reachable from the browse view before, and `TemplateConfigForm` already renders its own `TemplatePreview`):

```tsx
        {selectedTemplate && <TemplatePreview meta={selectedTemplate} />}
      </TabsContent>
```

becomes just:

```tsx
      </TabsContent>
```

- [ ] **Step 2: Add parent state, reset-on-switch handlers, validation, and submit payload**

In `WhatsAppCreateCampaign` (around line 812-831), find:

```ts
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const createMutation = useCreateCampaignWithDispatch();

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return selectedClientIds.length > 0;
    if (step === 3) return selectedTemplate !== null || selectedBotId.length > 0;
    return true;
  }, [step, title, selectedClientIds, selectedTemplate, selectedBotId]);
```

Replace with:

```ts
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MetaTemplate | null>(null);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [templateBodyParams, setTemplateBodyParams] = useState<string[]>([]);
  const [templateHeaderParams, setTemplateHeaderParams] = useState<string[]>([]);
  const [templateHeaderMedia, setTemplateHeaderMedia] = useState<TemplateHeaderMediaValue | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");

  const createMutation = useCreateCampaignWithDispatch();

  const handleSelectTemplate = (t: MetaTemplate | null) => {
    setSelectedTemplate(t);
    setTemplateBodyParams([]);
    setTemplateHeaderParams([]);
    setTemplateHeaderMedia(
      t?.headerMedia ? { storageKey: t.headerMedia.storageKey, mediaType: t.headerMedia.mediaType } : null,
    );
  };

  const handleSelectBot = (id: string) => {
    setSelectedBotId(id);
    setTemplateBodyParams([]);
    setTemplateHeaderParams([]);
    setTemplateHeaderMedia(null);
  };

  const templateVarsComplete = useMemo(() => {
    if (!selectedTemplate) return true;
    const groups = parseTemplateVars(selectedTemplate);
    const bodyGroup = groups.find((g) => g.componentType === "body");
    const headerGroup = groups.find((g) => g.componentType === "header");
    const bodyOk =
      !bodyGroup || bodyGroup.vars.every((_, i) => (templateBodyParams[i] ?? "").trim().length > 0);
    if (!headerGroup) return bodyOk;
    if (headerGroup.format !== "text") return bodyOk && templateHeaderMedia !== null;
    const headerOk = headerGroup.vars.every((_, i) => (templateHeaderParams[i] ?? "").trim().length > 0);
    return bodyOk && headerOk;
  }, [selectedTemplate, templateBodyParams, templateHeaderParams, templateHeaderMedia]);

  const canNext = useMemo(() => {
    if (step === 1) return title.trim().length > 0;
    if (step === 2) return selectedClientIds.length > 0;
    if (step === 3) return (selectedTemplate !== null && templateVarsComplete) || selectedBotId.length > 0;
    return true;
  }, [step, title, selectedClientIds, selectedTemplate, selectedBotId, templateVarsComplete]);
```

- [ ] **Step 3: Fix `handleSubmit` to send real values instead of variable names**

Find (around line 838-874):

```ts
  const handleSubmit = useCallback(() => {
    const scheduledIso =
      scheduledAt && new Date(scheduledAt).getTime() > Date.now()
        ? new Date(scheduledAt).toISOString()
        : undefined;

    const bodyParams = selectedTemplate
      ? parseTemplateVars(selectedTemplate)
          .filter((g) => g.componentType === "body")
          .flatMap((g) => g.vars)
      : undefined;

    createMutation.mutate(
      {
        name: title,
        description,
        metaTemplateName: selectedTemplate?.name,
        metaTemplateLanguage: selectedTemplate?.language,
        metaTemplateCategory: selectedTemplate?.category,
        metaTemplateBodyParams: bodyParams,
        waBotId: selectedBotId || undefined,
        clientIds: selectedClientIds,
        scheduledAt: scheduledIso,
      },
      {
        onSuccess: (data) => {
          toast({
            title: scheduledIso ? "Campanha agendada!" : "Campanha enfileirada!",
            description: scheduledIso
              ? "Será disparada automaticamente no horário escolhido."
              : "O disparo será processado em segundo plano.",
          });
          navigate(`/whatsapp/campanhas/${data.campaignId}`);
        },
      },
    );
  }, [createMutation, title, description, selectedTemplate, selectedBotId, selectedClientIds, scheduledAt, toast, navigate]);
```

Replace with:

```ts
  const handleSubmit = useCallback(() => {
    const scheduledIso =
      scheduledAt && new Date(scheduledAt).getTime() > Date.now()
        ? new Date(scheduledAt).toISOString()
        : undefined;

    createMutation.mutate(
      {
        name: title,
        description,
        metaTemplateName: selectedTemplate?.name,
        metaTemplateLanguage: selectedTemplate?.language,
        metaTemplateCategory: selectedTemplate?.category,
        metaTemplateBodyParams:
          selectedTemplate && templateBodyParams.length > 0 ? templateBodyParams : undefined,
        metaTemplateHeaderParams:
          selectedTemplate && templateHeaderParams.length > 0 ? templateHeaderParams : undefined,
        metaTemplateHeaderMedia: selectedTemplate && templateHeaderMedia ? templateHeaderMedia : undefined,
        waBotId: selectedBotId || undefined,
        clientIds: selectedClientIds,
        scheduledAt: scheduledIso,
      },
      {
        onSuccess: (data) => {
          toast({
            title: scheduledIso ? "Campanha agendada!" : "Campanha enfileirada!",
            description: scheduledIso
              ? "Será disparada automaticamente no horário escolhido."
              : "O disparo será processado em segundo plano.",
          });
          navigate(`/whatsapp/campanhas/${data.campaignId}`);
        },
      },
    );
  }, [
    createMutation,
    title,
    description,
    selectedTemplate,
    templateBodyParams,
    templateHeaderParams,
    templateHeaderMedia,
    selectedBotId,
    selectedClientIds,
    scheduledAt,
    toast,
    navigate,
  ]);
```

- [ ] **Step 4: Wire the new props into the `StepTemplateOrBot` render call**

Find (around line 936-943):

```tsx
              {step === 3 && (
                <StepTemplateOrBot
                  selectedTemplate={selectedTemplate}
                  selectedBotId={selectedBotId}
                  onSelectTemplate={setSelectedTemplate}
                  onSelectBot={setSelectedBotId}
                />
              )}
```

Replace with:

```tsx
              {step === 3 && (
                <StepTemplateOrBot
                  selectedTemplate={selectedTemplate}
                  selectedBotId={selectedBotId}
                  onSelectTemplate={handleSelectTemplate}
                  onSelectBot={handleSelectBot}
                  bodyParams={templateBodyParams}
                  onBodyParamsChange={setTemplateBodyParams}
                  headerParams={templateHeaderParams}
                  onHeaderParamsChange={setTemplateHeaderParams}
                  headerMedia={templateHeaderMedia}
                  onHeaderMediaChange={setTemplateHeaderMedia}
                />
              )}
```

- [ ] **Step 5: Verify types compile with zero new errors**

Run: `npx tsc --noEmit 2>&1 | grep -i "whatsapp/create-campaign"`
Expected: no output at all now (the errors from Tasks 7-8 about the old call sites are gone).

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/whatsapp/create-campaign.tsx
git commit -m "feat: fill template variables and header media in campaign creation"
```

---

### Task 10: Manual end-to-end verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full-repo type check**

Run: `npm run check`
Expected: same set of pre-existing errors as before this plan started (all in unrelated files like `server/storage.ts`), zero new ones.

- [ ] **Step 2: Browser walkthrough — template with body variables only**

Start the dev server (ask the user first if one is already running on the port). Log in, go to "Nova campanha", fill title, pick any clients, go to step 3, select an approved template that has `{{1}}`/`{{2}}`-style body variables:
- Confirm the browse list is replaced by the config card with "Trocar template".
- Fill one variable with literal text, and another via the "Inserir dado" dropdown (e.g. `{{nome}}`).
- Confirm the preview shows the literal text as-is and `[Nome do cliente]` for the token.
- Clear a variable back to empty and confirm "Próximo" becomes disabled; refill it and confirm it re-enables.

- [ ] **Step 3: Browser walkthrough — template with header media**

Pick (or temporarily note) a template whose header requires an image/video/document. Confirm:
- The "Selecionar arquivo" button opens `AttachFileDialog` locked to the right type.
- After attaching, the button becomes "Trocar" with "Arquivo selecionado" text.
- "Próximo" is disabled until media is attached.

- [ ] **Step 4: Inspect the network payload**

With the browser's network tab (or the Playwright `browser_network_request` tool), submit the campaign and inspect the `POST /api/campaigns` request body. Confirm it contains real filled-in values for `metaTemplateBodyParams`/`metaTemplateHeaderParams` (not variable names) and a `metaTemplateHeaderMedia: { storageKey, mediaType }` object when applicable.

- [ ] **Step 5: Confirm the bot tab still works unaffected**

Switch to the "Bot" tab in step 3, pick a bot, confirm "Próximo" enables correctly and no template state leaks in (`templateBodyParams` etc. reset to empty — this was set up in Task 9 Step 2's `handleSelectBot`).

- [ ] **Step 6: Report results to the user**

Summarize what was tested and what wasn't (no real campaign dispatch was triggered — that would send live WhatsApp messages).
