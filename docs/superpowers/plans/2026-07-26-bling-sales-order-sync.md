# Envio de Pedido de Venda ao Bling no Fechamento da Comanda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quando uma comanda do PDV Restaurante fecha, criar automaticamente um pedido de venda
na conta Bling vinculada à unidade, sem nunca bloquear o fechamento — divergências (item ou
cliente sem vínculo no Bling) ficam sinalizadas para um admin resolver depois.

**Architecture:** Uma função pura (`resolveBlingSalesOrderPayload`) monta e valida o payload do
Bling a partir de dados já carregados; um serviço de orquestração (`sendOrderToBling`) busca esses
dados, chama a função pura, e executa a chamada HTTP ao Bling dentro de uma transação com
`FOR UPDATE SKIP LOCKED` (evita corrida entre a tentativa imediata pós-fechamento e o cron de
retry). Estado atual fica em `restaurant_orders`; histórico de tentativas em uma tabela de
auditoria nova, dedicada (não reaproveita `restaurant_order_audit_log`, que exige ator humano).

**Tech Stack:** Express + Drizzle ORM (Postgres/Neon), `node-cron`, Vitest, React 18 + TanStack
Query + wouter no frontend.

## Global Constraints

- Nunca usar `npm run db:push` — toda alteração de schema é um script `.mjs` com SQL direto,
  seguindo o padrão de `scripts/add-pdv-units-bling-connection.mjs`.
- `npm run check` completo estoura memória nesta máquina — usar `tsconfig.tmp.json` temporário na
  raiz do repo, incluindo `server/types/express.d.ts` + os arquivos tocados, depois apagar.
- TypeScript `strict: true`, nunca `any`. ESM only. Sempre `async/await`.
- Sem teste visual em navegador para mudanças de UI deste projeto (regra do `CLAUDE.md`) — validar
  lendo o código e via `npm run check`.
- Testes de rota: montar o app com `createRouteTestApp()` / `createMockAuthMiddleware()` de
  `server/test/create-route-test-app.ts`. Testes de lógica pura em
  `server/services/__tests__/*.unit.test.ts` (projeto `unit` do Vitest, sem banco).
- `bling_product_mappings.bling_product_id` é o campo que vai para `itens[].produto.id` do Bling —
  nunca `product_id` (esse é o id do produto no CRM).

---

### Task 1: Migração — `pdv_units.default_client_id`

**Files:**
- Create: `scripts/add-pdv-units-default-client.mjs`
- Modify: `shared/schema.ts` (tabela `pdvUnits`, ~linha 2399-2417)

**Interfaces:**
- Produces: coluna `pdv_units.default_client_id` (varchar, nullable, FK de verdade para
  `clients.id` — diferente de `bling_connection_id`/`merged_into_order_id`, que são referências
  soltas por serem snapshots de um ponto no tempo; `default_client_id` é config viva, então ganha
  FK real, mesmo padrão de `blingContactMappings.clientId`). Campo `defaultClientId` em
  `PdvUnit`/`InsertPdvUnit`.

- [ ] **Step 1: Escrever o script de migração**

```js
// scripts/add-pdv-units-default-client.mjs
/**
 * Consumidor Final da unidade — usado no envio de pedido de venda ao Bling
 * quando a comanda fecha sem cliente vinculado.
 *
 * Uso:
 *   node scripts/add-pdv-units-default-client.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE pdv_units
  ADD COLUMN IF NOT EXISTS default_client_id varchar REFERENCES clients(id)
`;
console.log(
  "[migration] Coluna default_client_id adicionada em pdv_units (ou já existente).",
);

console.log("[migration] Concluído.");
```

- [ ] **Step 2: Rodar a migração**

Run: `node scripts/add-pdv-units-default-client.mjs`
Expected: `[migration] Coluna default_client_id adicionada em pdv_units (ou já existente).` seguido
de `[migration] Concluído.`

- [ ] **Step 3: Confirmar a coluna no banco**

Run:
```bash
node -e "import('dotenv/config').then(async()=>{const{neon}=await import('@neondatabase/serverless');const s=neon(process.env.DATABASE_URL);console.log(await s\`SELECT column_name, data_type FROM information_schema.columns WHERE table_name='pdv_units' AND column_name='default_client_id'\`)})"
```
Expected: uma linha `{ column_name: 'default_client_id', data_type: 'character varying' }`.

- [ ] **Step 4: Adicionar o campo em `shared/schema.ts`**

Em `shared/schema.ts`, no bloco `export const pdvUnits = pgTable("pdv_units", { ... })`, logo
depois de `blingConnectionId: varchar("bling_connection_id"),`:

```ts
  blingConnectionId: varchar("bling_connection_id"),
  // Consumidor Final da unidade — usado ao enviar pedido de venda ao Bling
  // quando a comanda fecha sem cliente vinculado. FK real (não é snapshot).
  defaultClientId: varchar("default_client_id").references(() => clients.id),
  isActive: boolean("is_active").notNull().default(true),
```

`InsertPdvUnit`/`PdvUnit` são derivados de `pdvUnits` via `createInsertSchema`/`$inferSelect`
logo abaixo — nenhuma outra edição de schema necessária para o tipo fluir.

- [ ] **Step 5: Checar tipos**

Criar `tsconfig.tmp.json` na raiz (ver Global Constraints), incluindo `shared/schema.ts`.
Run: `npx tsc -p tsconfig.tmp.json`
Expected: sem erros novos em `shared/schema.ts` (erros pré-existentes em `server/db.ts`/
`server/storage.ts` são esperados e não relacionados). Apagar `tsconfig.tmp.json` depois.

- [ ] **Step 6: Commit**

```bash
git add scripts/add-pdv-units-default-client.mjs shared/schema.ts
git commit -m "feat: adiciona default_client_id em pdv_units para consumidor final do Bling"
```

---

### Task 2: Migração — status de sync em `restaurant_orders` + tabela de auditoria

**Files:**
- Create: `scripts/add-bling-sales-order-sync.mjs`
- Modify: `shared/schema.ts` (tabela `restaurantOrders`, ~linha 2567-2658; novo bloco de tabela
  após `restaurantOrderAuditLog`, ~linha 2772)

**Interfaces:**
- Produces: colunas `restaurant_orders.bling_sync_status` (`'pendente'|'enviado'|'bloqueado'|'erro'|null`),
  `bling_sales_order_id` (text, nullable), `bling_sync_error` (text, nullable),
  `bling_sync_attempts` (integer, not null, default 0), `bling_sync_attempted_at` (timestamp,
  nullable). Nova tabela `restaurant_order_bling_sync_log` e tipo Drizzle
  `restaurantOrderBlingSyncLog` / `RestaurantOrderBlingSyncLog`.

- [ ] **Step 1: Escrever o script de migração**

```js
// scripts/add-bling-sales-order-sync.mjs
/**
 * Estado de sincronizacao do pedido de venda no Bling por comanda, mais a
 * tabela de auditoria de tentativas (separada de restaurant_order_audit_log,
 * que exige um ator humano — aqui o "ator" é o job/tentativa automatica).
 *
 * Uso:
 *   node scripts/add-bling-sales-order-sync.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS bling_sync_status text
  CHECK (bling_sync_status IN ('pendente','enviado','bloqueado','erro'))
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sales_order_id text
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_error text
`;
await sql`
  ALTER TABLE restaurant_orders
  ADD COLUMN IF NOT EXISTS bling_sync_attempts integer NOT NULL DEFAULT 0
`;
await sql`
  ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_attempted_at timestamp
`;
console.log(
  "[migration] Colunas de sync Bling adicionadas em restaurant_orders (ou já existentes).",
);

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_order_bling_sync_log (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id varchar NOT NULL REFERENCES restaurant_orders(id),
    unit_id varchar REFERENCES pdv_units(id),
    attempted_at timestamp NOT NULL DEFAULT now(),
    result text NOT NULL CHECK (result IN ('enviado','bloqueado','erro')),
    reason text,
    bling_sales_order_id text,
    created_at timestamp NOT NULL DEFAULT now()
  )
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_order_idx
  ON restaurant_order_bling_sync_log (order_id)
`;
await sql`
  CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_unit_idx
  ON restaurant_order_bling_sync_log (unit_id, result)
`;
console.log(
  "[migration] Tabela restaurant_order_bling_sync_log criada (ou já existente).",
);

console.log("[migration] Concluído.");
```

- [ ] **Step 2: Rodar a migração**

Run: `node scripts/add-bling-sales-order-sync.mjs`
Expected: as duas mensagens de sucesso + `[migration] Concluído.`

- [ ] **Step 3: Confirmar no banco**

Run:
```bash
node -e "import('dotenv/config').then(async()=>{const{neon}=await import('@neondatabase/serverless');const s=neon(process.env.DATABASE_URL);console.log(await s\`SELECT column_name FROM information_schema.columns WHERE table_name='restaurant_orders' AND column_name LIKE 'bling_sync%' OR column_name='bling_sales_order_id'\`);console.log(await s\`SELECT to_regclass('restaurant_order_bling_sync_log')\`)})"
```
Expected: 5 colunas listadas e `to_regclass` retornando o nome da tabela (não null).

- [ ] **Step 4: Adicionar os campos em `restaurantOrders` (`shared/schema.ts`)**

Logo depois de `blingConnectionId: varchar("bling_connection_id"),` na tabela `restaurantOrders`
(dentro do bloco que já tem o comentário `// snapshot de system_settings...`):

```ts
    // snapshot de system_settings.restaurant_pdv_bling_connection_id no momento
    // da abertura — referência solta (sem FK), mesmo padrão de mergedIntoOrderId
    blingConnectionId: varchar("bling_connection_id"),
    // Estado atual do envio do pedido de venda ao Bling — null enquanto a
    // comanda está aberta, vira 'pendente' no fechamento. Histórico completo
    // de tentativas fica em restaurant_order_bling_sync_log.
    blingSyncStatus: text("bling_sync_status", {
      enum: ["pendente", "enviado", "bloqueado", "erro"],
    }),
    blingSalesOrderId: text("bling_sales_order_id"),
    blingSyncError: text("bling_sync_error"),
    blingSyncAttempts: integer("bling_sync_attempts").notNull().default(0),
    blingSyncAttemptedAt: timestamp("bling_sync_attempted_at"),
    notes: text("notes"),
```

(Remove a linha `notes: text("notes"),` duplicada — ela já existe logo abaixo no arquivo original;
o bloco acima substitui o trecho entre `blingConnectionId` e `notes`, mantendo `notes` uma única
vez.)

- [ ] **Step 5: Criar a tabela `restaurantOrderBlingSyncLog` em `shared/schema.ts`**

Logo depois do bloco `export const restaurantOrderAuditLog = pgTable(...)` (antes de
`export const insertRestaurantTableSchema = ...`):

```ts
// Histórico de tentativas de envio do pedido de venda ao Bling — separado de
// restaurant_order_audit_log porque o "ator" aqui é o job/tentativa
// automática, não um usuário (aquela tabela exige actor_id NOT NULL).
export const restaurantOrderBlingSyncLog = pgTable(
  "restaurant_order_bling_sync_log",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: varchar("order_id")
      .references(() => restaurantOrders.id)
      .notNull(),
    unitId: varchar("unit_id").references(() => pdvUnits.id),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
    result: text("result", { enum: ["enviado", "bloqueado", "erro"] }).notNull(),
    reason: text("reason"),
    blingSalesOrderId: text("bling_sales_order_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index("restaurant_order_bling_sync_log_order_idx").on(table.orderId),
    unitResultIdx: index("restaurant_order_bling_sync_log_unit_idx").on(
      table.unitId,
      table.result,
    ),
  }),
);
export type RestaurantOrderBlingSyncLog = typeof restaurantOrderBlingSyncLog.$inferSelect;
export type InsertRestaurantOrderBlingSyncLog = typeof restaurantOrderBlingSyncLog.$inferInsert;
```

- [ ] **Step 6: Checar tipos**

`tsconfig.tmp.json` incluindo `shared/schema.ts`. Run: `npx tsc -p tsconfig.tmp.json`.
Expected: sem erros novos. Apagar `tsconfig.tmp.json`.

- [ ] **Step 7: Commit**

```bash
git add scripts/add-bling-sales-order-sync.mjs shared/schema.ts
git commit -m "feat: adiciona estado de sync Bling em restaurant_orders e tabela de auditoria"
```

---

### Task 3: Função pura `resolveBlingSalesOrderPayload` (TDD)

**Files:**
- Create: `server/services/bling-sales-order.service.ts`
- Test: `server/services/__tests__/bling-sales-order.unit.test.ts`

**Interfaces:**
- Consumes: `RestaurantOrder`, `RestaurantOrderItem` de `../../shared/schema`;
  `BlingPedidoVendaPayload`, `BlingPedidoVendaItemPayload` de `../integrations/bling`.
- Produces:
  ```ts
  export interface ResolveBlingSalesOrderInput {
    order: RestaurantOrder;
    items: RestaurantOrderItem[];
    blingProductIdByProductId: Map<string, string>;
    contactBlingId: string | null;
    sellerBlingId: string | null;
  }
  export type ResolveBlingSalesOrderResult =
    | { ok: true; payload: BlingPedidoVendaPayload }
    | { ok: false; reason: string };
  export function resolveBlingSalesOrderPayload(
    input: ResolveBlingSalesOrderInput,
  ): ResolveBlingSalesOrderResult;
  ```
  Usado por `sendOrderToBling` (Task 4).

- [ ] **Step 1: Escrever os testes (falhando)**

```ts
// server/services/__tests__/bling-sales-order.unit.test.ts
import { describe, expect, it } from "vitest";
import {
  resolveBlingSalesOrderPayload,
  type ResolveBlingSalesOrderInput,
} from "../bling-sales-order.service";
import type { RestaurantOrder, RestaurantOrderItem } from "../../../shared/schema";

/**
 * O que está sob teste: a regra de "não mandar pedido divergente" — qualquer
 * item ou contato sem correspondência no Bling bloqueia a comanda inteira em
 * vez de mandar um pedido incompleto.
 */

function makeOrder(overrides: Partial<RestaurantOrder> = {}): RestaurantOrder {
  return {
    id: "order-1",
    orderNumber: 1,
    tableId: "table-1",
    tableNumber: 5,
    peopleCount: 2,
    waiterId: "waiter-1",
    cashSessionId: "session-1",
    status: "fechada",
    paymentRequestedAt: null,
    paymentMethod: "pix",
    subtotal: "100.00",
    serviceFeePercent: "10.00",
    serviceFeeAmount: "10.00",
    total: "110.00",
    discountPercent: null,
    discountAmount: null,
    discountReason: null,
    discountAppliedBy: null,
    clientId: null,
    clientName: null,
    mergedIntoOrderId: null,
    blingConnectionId: "conn-1",
    notes: null,
    unitId: "unit-1",
    openedAt: new Date("2026-07-26T20:00:00Z"),
    closedAt: new Date("2026-07-26T21:30:00Z"),
    createdAt: new Date("2026-07-26T20:00:00Z"),
    updatedAt: new Date("2026-07-26T21:30:00Z"),
    blingSyncStatus: "pendente",
    blingSalesOrderId: null,
    blingSyncError: null,
    blingSyncAttempts: 0,
    blingSyncAttemptedAt: null,
    ...overrides,
  };
}

function makeItem(overrides: Partial<RestaurantOrderItem> = {}): RestaurantOrderItem {
  return {
    id: "item-1",
    orderId: "order-1",
    menuItemId: null,
    productId: "product-1",
    name: "Vinho Tinto",
    notes: null,
    unitPrice: "100.00",
    quantity: 1,
    status: "ativo",
    cancelReason: null,
    cancelledBy: null,
    cancelledAt: null,
    createdAt: new Date("2026-07-26T20:05:00Z"),
    updatedAt: new Date("2026-07-26T20:05:00Z"),
    ...overrides,
  };
}

function baseInput(
  overrides: Partial<ResolveBlingSalesOrderInput> = {},
): ResolveBlingSalesOrderInput {
  return {
    order: makeOrder(),
    items: [makeItem()],
    blingProductIdByProductId: new Map([["product-1", "9001"]]),
    contactBlingId: "5001",
    sellerBlingId: null,
    ...overrides,
  };
}

describe("resolveBlingSalesOrderPayload", () => {
  it("monta o payload quando item e contato estão resolvidos", () => {
    const result = resolveBlingSalesOrderPayload(baseInput());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.contato).toEqual({ id: 5001 });
    expect(result.payload.itens).toEqual([
      { produto: { id: 9001 }, descricao: "Vinho Tinto", quantidade: 1, valor: 100 },
    ]);
    expect(result.payload.parcelas).toEqual([
      { dataVencimento: "2026-07-26", valor: 110 },
    ]);
    expect(result.payload.data).toBe("2026-07-26");
  });

  it("bloqueia quando um item avulso não tem productId", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({
        items: [makeItem({ productId: null, name: "Caipirinha avulsa" })],
      }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("Caipirinha avulsa");
  });

  it("bloqueia quando o produto não tem bling_product_id mapeado para a conexão", () => {
    const result = resolveBlingSalesOrderPayload(
      baseInput({ blingProductIdByProductId: new Map() }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("Vinho Tinto");
  });

  it("bloqueia quando não há contato Bling resolvido (sem cliente e sem consumidor final)", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ contactBlingId: null }));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("esperava ok:false");
    expect(result.reason).toContain("contato Bling");
  });

  it("inclui vendedor no payload quando sellerBlingId está presente", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ sellerBlingId: "7001" }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.vendedor).toEqual({ id: 7001 });
  });

  it("omite vendedor quando sellerBlingId é null", () => {
    const result = resolveBlingSalesOrderPayload(baseInput({ sellerBlingId: null }));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava ok:true");
    expect(result.payload.vendedor).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run --project unit server/services/__tests__/bling-sales-order.unit.test.ts`
Expected: FAIL — `Cannot find module '../bling-sales-order.service'`.

- [ ] **Step 3: Implementar `resolveBlingSalesOrderPayload`**

```ts
// server/services/bling-sales-order.service.ts
import { format } from "date-fns";
import type { RestaurantOrder, RestaurantOrderItem } from "../../shared/schema";
import type {
  BlingPedidoVendaItemPayload,
  BlingPedidoVendaPayload,
} from "../integrations/bling";

export interface ResolveBlingSalesOrderInput {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
  /** bling_product_mappings.bling_product_id, por product_id do CRM. */
  blingProductIdByProductId: Map<string, string>;
  contactBlingId: string | null;
  sellerBlingId: string | null;
}

export type ResolveBlingSalesOrderResult =
  | { ok: true; payload: BlingPedidoVendaPayload }
  | { ok: false; reason: string };

/**
 * Monta o payload de POST /pedidos/vendas a partir dos dados já carregados da
 * comanda. Nunca lança — qualquer vínculo faltando (item sem produto Bling,
 * contato não resolvido) vira `{ ok: false, reason }`, que o chamador trata
 * como divergência bloqueada, sem retry automático.
 */
export function resolveBlingSalesOrderPayload(
  input: ResolveBlingSalesOrderInput,
): ResolveBlingSalesOrderResult {
  const { order, items, blingProductIdByProductId, contactBlingId, sellerBlingId } = input;

  if (!contactBlingId) {
    return {
      ok: false,
      reason:
        "Nenhum contato Bling resolvido — vincule um cliente à comanda ou configure o Consumidor Final da unidade",
    };
  }

  const unresolvedItemNames: string[] = [];
  const itens: BlingPedidoVendaItemPayload[] = [];

  for (const item of items) {
    const blingProductId = item.productId
      ? blingProductIdByProductId.get(item.productId)
      : undefined;

    if (!blingProductId) {
      unresolvedItemNames.push(item.name);
      continue;
    }

    itens.push({
      produto: { id: Number(blingProductId) },
      descricao: item.name,
      quantidade: item.quantity,
      valor: Number(item.unitPrice),
    });
  }

  if (unresolvedItemNames.length > 0) {
    return {
      ok: false,
      reason: `Item(ns) sem produto vinculado ao Bling: ${unresolvedItemNames.join(", ")}`,
    };
  }

  if (!order.closedAt) {
    return { ok: false, reason: "Comanda sem data de fechamento" };
  }
  if (!order.total) {
    return { ok: false, reason: "Comanda sem total calculado" };
  }

  const closedDate = format(new Date(order.closedAt), "yyyy-MM-dd");

  const payload: BlingPedidoVendaPayload = {
    data: closedDate,
    dataSaida: closedDate,
    dataPrevista: closedDate,
    contato: { id: Number(contactBlingId) },
    itens,
    parcelas: [{ dataVencimento: closedDate, valor: Number(order.total) }],
    ...(sellerBlingId ? { vendedor: { id: Number(sellerBlingId) } } : {}),
  };

  return { ok: true, payload };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run --project unit server/services/__tests__/bling-sales-order.unit.test.ts`
Expected: `6 passed`.

- [ ] **Step 5: Confirmar que o arquivo é coletado pelo projeto `unit`**

Run: `npx vitest list --project unit | grep bling-sales-order`
Expected: o caminho do arquivo aparece na lista.

- [ ] **Step 6: Commit**

```bash
git add server/services/bling-sales-order.service.ts server/services/__tests__/bling-sales-order.unit.test.ts
git commit -m "feat: adiciona resolveBlingSalesOrderPayload com regra de bloqueio por divergência"
```

---

### Task 4: Orquestração `sendOrderToBling`

**Files:**
- Modify: `server/services/bling-sales-order.service.ts` (adiciona a função de orquestração ao
  mesmo arquivo da Task 3)

**Interfaces:**
- Consumes: `resolveBlingSalesOrderPayload` (Task 3); `blingConnectionsService.getById` /
  `.refreshConnection` (`./bling-connections.service`); `decryptToken`
  (`../lib/token-crypto`); `createBlingPedidoVenda` (`../integrations/bling`); tabelas
  `restaurantOrders`, `restaurantOrderItems`, `blingProductMappings`, `blingContactMappings`,
  `blingSellerMappings`, `pdvUnits`, `restaurantOrderBlingSyncLog` de `../../shared/schema`.
- Produces: `export async function sendOrderToBling(orderId: string): Promise<void>` — usado pelo
  fechamento da comanda (Task 5), pelo cron (Task 5) e pelo endpoint de reenvio manual (Task 6).
  Nunca lança — todo erro é capturado e vira estado gravado no banco.

- [ ] **Step 1: Adicionar os imports e a função de orquestração**

No topo de `server/services/bling-sales-order.service.ts`, junto aos imports existentes:

```ts
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  restaurantOrders,
  restaurantOrderItems,
  restaurantOrderBlingSyncLog,
  blingProductMappings,
  blingContactMappings,
  blingSellerMappings,
  pdvUnits,
} from "../../shared/schema";
import { blingConnectionsService } from "./bling-connections.service";
import { decryptToken } from "../lib/token-crypto";
import { createBlingPedidoVenda } from "../integrations/bling";
import type { DbExecutor } from "../db";
```

No final do arquivo, depois de `resolveBlingSalesOrderPayload`:

```ts
const MAX_SYNC_ATTEMPTS = 5;

async function resolveContactBlingId(
  tx: DbExecutor,
  order: RestaurantOrder,
  connectionId: string,
): Promise<string | null> {
  if (order.clientId) {
    const [row] = await tx
      .select({ blingContactId: blingContactMappings.blingContactId })
      .from(blingContactMappings)
      .where(
        and(
          eq(blingContactMappings.connectionId, connectionId),
          eq(blingContactMappings.clientId, order.clientId),
        ),
      )
      .limit(1);
    if (row) return row.blingContactId;
  }

  if (order.unitId) {
    const [unit] = await tx
      .select({ defaultClientId: pdvUnits.defaultClientId })
      .from(pdvUnits)
      .where(eq(pdvUnits.id, order.unitId))
      .limit(1);

    if (unit?.defaultClientId) {
      const [row] = await tx
        .select({ blingContactId: blingContactMappings.blingContactId })
        .from(blingContactMappings)
        .where(
          and(
            eq(blingContactMappings.connectionId, connectionId),
            eq(blingContactMappings.clientId, unit.defaultClientId),
          ),
        )
        .limit(1);
      if (row) return row.blingContactId;
    }
  }

  return null;
}

async function resolveSellerBlingId(
  tx: DbExecutor,
  order: RestaurantOrder,
  connectionId: string,
): Promise<string | null> {
  const [row] = await tx
    .select({ blingVendedorId: blingSellerMappings.blingVendedorId })
    .from(blingSellerMappings)
    .where(
      and(
        eq(blingSellerMappings.connectionId, connectionId),
        eq(blingSellerMappings.userId, order.waiterId),
      ),
    )
    .limit(1);
  return row?.blingVendedorId ?? null;
}

async function recordSyncResult(
  tx: DbExecutor,
  order: RestaurantOrder,
  params: {
    result: "enviado" | "bloqueado" | "erro";
    reason: string | null;
    blingSalesOrderId?: string | null;
    attempts?: number;
    finalStatus?: "enviado" | "bloqueado" | "erro";
  },
): Promise<void> {
  const finalStatus = params.finalStatus ?? params.result;

  await tx
    .update(restaurantOrders)
    .set({
      blingSyncStatus: finalStatus,
      blingSalesOrderId: params.blingSalesOrderId ?? order.blingSalesOrderId,
      blingSyncError: params.reason,
      blingSyncAttempts: params.attempts ?? order.blingSyncAttempts,
      blingSyncAttemptedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(restaurantOrders.id, order.id));

  await tx.insert(restaurantOrderBlingSyncLog).values({
    orderId: order.id,
    unitId: order.unitId,
    result: params.result,
    reason: params.reason,
    blingSalesOrderId: params.blingSalesOrderId ?? null,
  });
}

/**
 * Tenta enviar o pedido de venda da comanda fechada ao Bling. Usada tanto na
 * tentativa imediata pós-fechamento quanto no cron de retry e no reenvio
 * manual do admin — sempre o mesmo caminho de código.
 *
 * `FOR UPDATE SKIP LOCKED`: se duas chamadas colidirem na mesma comanda
 * (tentativa imediata + cron, ou dois ticks do cron), quem chegar primeiro
 * processa; a outra pula a linha em vez de esperar ou duplicar o pedido de
 * venda no Bling.
 */
export async function sendOrderToBling(orderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(restaurantOrders)
      .where(and(eq(restaurantOrders.id, orderId), eq(restaurantOrders.status, "fechada")))
      .for("update", { skipLocked: true });

    if (!order) return;

    if (!order.blingConnectionId) {
      await recordSyncResult(tx, order, {
        result: "bloqueado",
        reason: "Comanda sem conta Bling vinculada (unidade sem catálogo configurado)",
      });
      return;
    }
    const connectionId = order.blingConnectionId;

    const items = await tx
      .select()
      .from(restaurantOrderItems)
      .where(
        and(
          eq(restaurantOrderItems.orderId, orderId),
          eq(restaurantOrderItems.status, "ativo"),
        ),
      );

    const productIds = items
      .map((item) => item.productId)
      .filter((id): id is string => !!id);

    const mappingRows =
      productIds.length > 0
        ? await tx
            .select({
              productId: blingProductMappings.productId,
              blingProductId: blingProductMappings.blingProductId,
            })
            .from(blingProductMappings)
            .where(
              and(
                eq(blingProductMappings.connectionId, connectionId),
                inArray(blingProductMappings.productId, productIds),
              ),
            )
        : [];

    const blingProductIdByProductId = new Map(
      mappingRows.map((row) => [row.productId, row.blingProductId]),
    );

    const [contactBlingId, sellerBlingId] = await Promise.all([
      resolveContactBlingId(tx, order, connectionId),
      resolveSellerBlingId(tx, order, connectionId),
    ]);

    const resolved = resolveBlingSalesOrderPayload({
      order,
      items,
      blingProductIdByProductId,
      contactBlingId,
      sellerBlingId,
    });

    if (!resolved.ok) {
      await recordSyncResult(tx, order, { result: "bloqueado", reason: resolved.reason });
      return;
    }

    try {
      const connection = await blingConnectionsService.getById(connectionId);
      if (!connection?.accessTokenEncrypted) {
        throw new Error("Conexão Bling sem token de acesso");
      }

      let accessToken = decryptToken(connection.accessTokenEncrypted);
      const onTokenRefresh = async (): Promise<string> => {
        await blingConnectionsService.refreshConnection(connectionId);
        const refreshed = await blingConnectionsService.getById(connectionId);
        if (!refreshed?.accessTokenEncrypted) {
          throw new Error("Não foi possível renovar o token do Bling");
        }
        accessToken = decryptToken(refreshed.accessTokenEncrypted);
        return accessToken;
      };

      const { id: blingSalesOrderId } = await createBlingPedidoVenda(
        accessToken,
        resolved.payload,
        onTokenRefresh,
      );

      await recordSyncResult(tx, order, {
        result: "enviado",
        reason: null,
        blingSalesOrderId: String(blingSalesOrderId),
        attempts: order.blingSyncAttempts,
      });
    } catch (err) {
      const attempts = order.blingSyncAttempts + 1;
      const finalStatus = attempts >= MAX_SYNC_ATTEMPTS ? "bloqueado" : "erro";
      await recordSyncResult(tx, order, {
        result: "erro",
        reason: (err as Error).message,
        attempts,
        finalStatus,
      });
    }
  });
}
```

- [ ] **Step 2: Checar tipos**

`tsconfig.tmp.json` incluindo `server/types/express.d.ts` e
`server/services/bling-sales-order.service.ts`.
Run: `npx tsc -p tsconfig.tmp.json`
Expected: sem erros no arquivo. Apagar `tsconfig.tmp.json`.

- [ ] **Step 3: Rodar a suíte de testes unitários para garantir que nada quebrou**

Run: `npx vitest run --project unit server/services/__tests__/bling-sales-order.unit.test.ts`
Expected: `6 passed` (a função pura não muda de comportamento).

- [ ] **Step 4: Verificação manual contra o banco real**

Este passo é orquestração pesada em banco — não vale a pena mockar tudo para um teste automatizado
(mesmo raciocínio do `CLAUDE.md`: "lógica pura testa melhor que serviço inteiro"). Validar
manualmente: pegar o id de uma comanda fechada existente sem `bling_sync_status` (ou criar uma de
teste) e rodar:

```bash
npx tsx -e "
import('./server/services/bling-sales-order.service.ts').then(async (m) => {
  await m.sendOrderToBling('<ID_DA_COMANDA>');
  console.log('ok');
  process.exit(0);
}).catch((e) => { console.error(e); process.exit(1); });
"
```

(`node -e` sozinho não entende `.ts` — precisa do `tsx`, mesmo padrão já usado nesta sessão para
verificar `pdv-units.service.ts` contra o banco real.)

Conferir depois no banco que `restaurant_orders.bling_sync_status` e
`restaurant_order_bling_sync_log` refletem o resultado esperado (bloqueado se a unidade não tiver
`bling_connection_id`, que é o estado atual de ambas as unidades cadastradas hoje).

- [ ] **Step 5: Commit**

```bash
git add server/services/bling-sales-order.service.ts
git commit -m "feat: adiciona sendOrderToBling com lock FOR UPDATE SKIP LOCKED"
```

---

### Task 5: Disparo imediato no fechamento + cron de retry

**Files:**
- Modify: `server/services/restaurant-pdv.service.ts` (`closeOrder`, ~linha 708-844)
- Create: `server/jobs/bling-sales-order-sync-scheduler.ts`
- Modify: `server/index.ts` (registro do job)

**Interfaces:**
- Consumes: `sendOrderToBling` (Task 4).
- Produces: nenhuma interface nova — efeito colateral (chamada em segundo plano).

- [ ] **Step 1: Disparar `sendOrderToBling` após o commit do fechamento**

Em `server/services/restaurant-pdv.service.ts`, adicionar o import no topo:

```ts
import { sendOrderToBling } from "./bling-sales-order.service";
```

No método `closeOrder`, o corpo atual termina com:

```ts
      return updated;
    });

    return closed;
  },
```

Trocar para:

```ts
      return updated;
    });

    // Fire-and-forget: o fechamento nunca espera nem falha por causa do
    // Bling. Falha vira `bling_sync_status = 'erro'`/`'bloqueado'`, coberta
    // pelo cron de retry (bling-sales-order-sync-scheduler.ts).
    sendOrderToBling(closed.id).catch((err) => {
      console.error(
        `[Bling Sync] Falha ao iniciar envio da comanda ${closed.id}:`,
        err,
      );
    });

    return closed;
  },
```

- [ ] **Step 2: Criar o job de retry**

```ts
// server/jobs/bling-sales-order-sync-scheduler.ts
import cron from "node-cron";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { restaurantOrders } from "../../shared/schema";
import { sendOrderToBling } from "../services/bling-sales-order.service";

const MAX_SYNC_ATTEMPTS = 5;

async function retryPendingBlingSyncs(): Promise<void> {
  try {
    const pending = await db
      .select({ id: restaurantOrders.id })
      .from(restaurantOrders)
      .where(
        and(
          eq(restaurantOrders.status, "fechada"),
          inArray(restaurantOrders.blingSyncStatus, ["pendente", "erro"]),
          lt(restaurantOrders.blingSyncAttempts, MAX_SYNC_ATTEMPTS),
        ),
      );

    if (pending.length === 0) return;

    console.log(`[Bling Sales Order Sync] ${pending.length} comanda(s) pendente(s) de envio.`);

    for (const order of pending) {
      await sendOrderToBling(order.id);
    }
  } catch (error) {
    console.error("[Bling Sales Order Sync] Erro na varredura de retry:", error);
  }
}

cron.schedule(
  "*/5 * * * *",
  async () => {
    await retryPendingBlingSyncs();
  },
  {
    timezone: "America/Sao_Paulo",
  },
);
```

- [ ] **Step 3: Registrar o job em `server/index.ts`**

Junto aos outros `import "./jobs/..."` (perto de `import "./jobs/bling-token-refresh-scheduler";`):

```ts
import "./jobs/bling-token-refresh-scheduler";
import "./jobs/bling-sales-order-sync-scheduler";
```

- [ ] **Step 4: Checar tipos**

`tsconfig.tmp.json` incluindo `server/types/express.d.ts`,
`server/services/restaurant-pdv.service.ts`, `server/jobs/bling-sales-order-sync-scheduler.ts`.
Run: `npx tsc -p tsconfig.tmp.json`
Expected: sem erros novos. Apagar `tsconfig.tmp.json`.

- [ ] **Step 5: Rodar a suíte de testes de rota do PDV para garantir que `closeOrder` não quebrou**

Run: `npx vitest run --project unit server/routes/__tests__/restaurant-pdv-close-order.routes.test.ts`
Expected: todos os testes existentes continuam passando (o `sendOrderToBling` real vai lançar
dentro do `.catch` silencioso se faltar `DATABASE_URL`/mocks no ambiente de teste — isso é
esperado e não deve derrubar o teste da rota, já que o erro é engolido pelo `.catch`).

- [ ] **Step 6: Commit**

```bash
git add server/services/restaurant-pdv.service.ts server/jobs/bling-sales-order-sync-scheduler.ts server/index.ts
git commit -m "feat: dispara envio ao Bling no fechamento da comanda + cron de retry"
```

---

### Task 6: Endpoints admin — listar pendências e reenviar (TDD)

**Files:**
- Create: `server/controllers/restaurant-pdv/list-bling-sync-pending.controller.ts`
- Create: `server/controllers/restaurant-pdv/retry-bling-sync.controller.ts`
- Modify: `server/controllers/restaurant-pdv/index.ts`
- Modify: `server/routes/restaurant-pdv.routes.ts`
- Test: `server/routes/__tests__/bling-sync-pending.routes.test.ts`

**Interfaces:**
- Produces: `GET /api/restaurant-pdv/admin/bling-sync-pending` → lista de comandas com
  `bling_sync_status IN ('bloqueado','erro')`, com dados da unidade e histórico de tentativas.
  `POST /api/restaurant-pdv/admin/orders/:id/retry-bling-sync` → zera tentativas e chama
  `sendOrderToBling` de novo.

- [ ] **Step 1: Escrever os testes de rota (falhando)**

```ts
// server/routes/__tests__/bling-sync-pending.routes.test.ts
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createMockAuthMiddleware } from "../../test/create-route-test-app";
import { restaurantPdvRouter } from "../restaurant-pdv.routes";

const { listPendingMock, updateOrderMock, sendOrderToBlingMock } = vi.hoisted(() => ({
  listPendingMock: vi.fn(),
  updateOrderMock: vi.fn(),
  sendOrderToBlingMock: vi.fn(),
}));

vi.mock("../../services/bling-sync-admin.service", () => ({
  blingSyncAdminService: {
    listPending: listPendingMock,
    resetForRetry: updateOrderMock,
  },
}));

vi.mock("../../services/bling-sales-order.service", () => ({
  sendOrderToBling: sendOrderToBlingMock,
}));

function appAs(role: string) {
  return createRouteTestApp({
    router: restaurantPdvRouter,
    basePath: "/restaurant-pdv",
    middlewares: [createMockAuthMiddleware({ role })],
  });
}

beforeEach(() => {
  listPendingMock.mockReset().mockResolvedValue([]);
  updateOrderMock.mockReset().mockResolvedValue(undefined);
  sendOrderToBlingMock.mockReset().mockResolvedValue(undefined);
});

describe("GET /restaurant-pdv/admin/bling-sync-pending", () => {
  it("lista comandas bloqueadas/com erro", async () => {
    listPendingMock.mockResolvedValue([
      {
        id: "order-1",
        tableNumber: 5,
        unitId: "unit-1",
        unitName: "Matriz",
        blingSyncStatus: "bloqueado",
        blingSyncError: "Item(ns) sem produto vinculado ao Bling: Caipirinha avulsa",
      },
    ]);

    const response = await request(appAs("admin")).get(
      "/restaurant-pdv/admin/bling-sync-pending",
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].blingSyncStatus).toBe("bloqueado");
  });

  it("nega acesso ao garçom", async () => {
    const response = await request(appAs("garcom")).get(
      "/restaurant-pdv/admin/bling-sync-pending",
    );
    expect(response.status).toBe(403);
  });
});

describe("POST /restaurant-pdv/admin/orders/:id/retry-bling-sync", () => {
  it("zera tentativas e reenvia", async () => {
    const response = await request(appAs("gerente")).post(
      "/restaurant-pdv/admin/orders/order-1/retry-bling-sync",
    );

    expect(response.status).toBe(200);
    expect(updateOrderMock).toHaveBeenCalledWith("order-1");
    expect(sendOrderToBlingMock).toHaveBeenCalledWith("order-1");
  });

  it("nega acesso ao garçom", async () => {
    const response = await request(appAs("garcom")).post(
      "/restaurant-pdv/admin/orders/order-1/retry-bling-sync",
    );
    expect(response.status).toBe(403);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run --project unit server/routes/__tests__/bling-sync-pending.routes.test.ts`
Expected: FAIL — `Cannot find module '../../services/bling-sync-admin.service'`.

- [ ] **Step 3: Criar o service de suporte ao admin**

```ts
// server/services/bling-sync-admin.service.ts
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { restaurantOrders, pdvUnits } from "../../shared/schema";

export interface PendingBlingSyncOrder {
  id: string;
  tableNumber: number;
  unitId: string | null;
  unitName: string | null;
  blingSyncStatus: "bloqueado" | "erro";
  blingSyncError: string | null;
  blingSyncAttempts: number;
  closedAt: Date | null;
}

export const blingSyncAdminService = {
  async listPending(): Promise<PendingBlingSyncOrder[]> {
    const rows = await db
      .select({
        id: restaurantOrders.id,
        tableNumber: restaurantOrders.tableNumber,
        unitId: restaurantOrders.unitId,
        unitName: pdvUnits.name,
        blingSyncStatus: restaurantOrders.blingSyncStatus,
        blingSyncError: restaurantOrders.blingSyncError,
        blingSyncAttempts: restaurantOrders.blingSyncAttempts,
        closedAt: restaurantOrders.closedAt,
      })
      .from(restaurantOrders)
      .leftJoin(pdvUnits, eq(pdvUnits.id, restaurantOrders.unitId))
      .where(inArray(restaurantOrders.blingSyncStatus, ["bloqueado", "erro"]))
      .orderBy(desc(restaurantOrders.closedAt));

    return rows as PendingBlingSyncOrder[];
  },

  async resetForRetry(orderId: string): Promise<void> {
    await db
      .update(restaurantOrders)
      .set({ blingSyncStatus: "pendente", blingSyncAttempts: 0, blingSyncError: null })
      .where(eq(restaurantOrders.id, orderId));
  },
};
```

- [ ] **Step 4: Criar os controllers**

```ts
// server/controllers/restaurant-pdv/list-bling-sync-pending.controller.ts
import { Request, Response } from "express";
import { blingSyncAdminService } from "../../services/bling-sync-admin.service";

export const listBlingSyncPendingController = async (_req: Request, res: Response) => {
  try {
    const pending = await blingSyncAdminService.listPending();
    return res.json(pending);
  } catch (error) {
    console.error("[Bling Sync] Erro ao listar pendências:", error);
    return res.status(500).json({ message: "Erro ao listar pendências de sincronização" });
  }
};
```

```ts
// server/controllers/restaurant-pdv/retry-bling-sync.controller.ts
import { Request, Response } from "express";
import { blingSyncAdminService } from "../../services/bling-sync-admin.service";
import { sendOrderToBling } from "../../services/bling-sales-order.service";

export const retryBlingSyncController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await blingSyncAdminService.resetForRetry(id);
    await sendOrderToBling(id);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(`[Bling Sync] Erro ao reenviar comanda ${req.params.id}:`, error);
    return res.status(500).json({ message: "Erro ao reenviar para o Bling" });
  }
};
```

- [ ] **Step 5: Exportar no barrel e registrar as rotas**

Em `server/controllers/restaurant-pdv/index.ts`, adicionar:

```ts
export { listBlingSyncPendingController } from "./list-bling-sync-pending.controller";
export { retryBlingSyncController } from "./retry-bling-sync.controller";
```

Em `server/routes/restaurant-pdv.routes.ts`, importar os dois novos controllers junto aos demais
(linha do `import { ... } from "../controllers/restaurant-pdv";`) e registrar as rotas logo depois
de `restaurantPdvRouter.get("/admin/units-overview", ...)` (antes do `DELETE /admin/orders/:id`,
mesma seção "sem contexto de unidade"):

```ts
restaurantPdvRouter.get(
  "/admin/bling-sync-pending",
  requireGestor,
  listBlingSyncPendingController,
);
restaurantPdvRouter.post(
  "/admin/orders/:id/retry-bling-sync",
  requireGestor,
  retryBlingSyncController,
);
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

Run: `npx vitest run --project unit server/routes/__tests__/bling-sync-pending.routes.test.ts`
Expected: `4 passed`.

- [ ] **Step 7: Checar tipos**

`tsconfig.tmp.json` incluindo `server/types/express.d.ts` e todos os arquivos criados/modificados
nesta task. Run: `npx tsc -p tsconfig.tmp.json`. Expected: sem erros novos.

- [ ] **Step 8: Commit**

```bash
git add server/services/bling-sync-admin.service.ts server/controllers/restaurant-pdv/list-bling-sync-pending.controller.ts server/controllers/restaurant-pdv/retry-bling-sync.controller.ts server/controllers/restaurant-pdv/index.ts server/routes/restaurant-pdv.routes.ts server/routes/__tests__/bling-sync-pending.routes.test.ts
git commit -m "feat: adiciona endpoints admin para listar e reenviar pendências de sync Bling"
```

---

### Task 7: Aviso no Painel Admin (`pendingBlingSyncCount`)

**Files:**
- Modify: `server/controllers/restaurant-pdv/admin-units-overview.controller.ts`
- Modify: `client/src/pages/restaurant-pdv/admin-panel.tsx`

**Interfaces:**
- Produces: `UnitOverview.stats.pendingBlingSyncCount: number` na resposta de
  `GET /api/restaurant-pdv/admin/units-overview`.

- [ ] **Step 1: Adicionar a contagem no controller**

Em `admin-units-overview.controller.ts`, importar `restaurantOrders` já está feito. Adicionar a
query de contagem junto ao `Promise.all` existente (que hoje busca `openSessions`, `openOrders`,
`tableCounts`):

```ts
    const [openSessions, openOrders, tableCounts, pendingBlingSyncCounts] = await Promise.all([
      // ... openSessions, openOrders, tableCounts inalterados ...
      db
        .select({
          unitId: restaurantOrders.unitId,
          total: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(restaurantOrders)
        .where(
          and(
            inArray(restaurantOrders.blingSyncStatus, ["bloqueado", "erro"]),
            inArray(restaurantOrders.unitId, unitIds),
          ),
        )
        .groupBy(restaurantOrders.unitId),
    ]);
```

Logo depois de `const tableCountByUnit: Record<string, number> = {};` (e seu loop de
preenchimento), adicionar:

```ts
    const pendingBlingSyncByUnit: Record<string, number> = {};
    for (const p of pendingBlingSyncCounts) {
      if (p.unitId) pendingBlingSyncByUnit[p.unitId] = p.total;
    }
```

E no `stats` retornado dentro do `.map`:

```ts
        stats: {
          totalTables: tableCountByUnit[unit.id] ?? 0,
          occupiedTables: orders.length,
          cashStatus: session ? "aberto" : "fechado",
          pendingBlingSyncCount: pendingBlingSyncByUnit[unit.id] ?? 0,
        },
```

- [ ] **Step 2: Atualizar o tipo e exibir o aviso em `admin-panel.tsx`**

Em `client/src/pages/restaurant-pdv/admin-panel.tsx`, atualizar a interface:

```ts
interface UnitOverview {
  unit: { id: string; name: string; cnpj: string | null };
  cashSession: { id: string; openedAt: string; status: string } | null;
  openOrders: OpenOrder[];
  stats: {
    totalTables: number;
    occupiedTables: number;
    cashStatus: "aberto" | "fechado";
    pendingBlingSyncCount: number;
  };
}
```

Dentro de `UnitCard`, logo depois do bloco `{unit.cnpj && (...)}`, adicionar o aviso:

```tsx
        {stats.pendingBlingSyncCount > 0 && (
          <button
            type="button"
            onClick={() => navigate("/pdv-restaurante/admin/bling-pendencias")}
            className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
          >
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {stats.pendingBlingSyncCount}{" "}
            {stats.pendingBlingSyncCount === 1 ? "comanda" : "comandas"} com pendência no Bling
          </button>
        )}
```

`UnitCard` precisa receber `navigate` — como já está no mesmo módulo que usa `useLocation()` no
componente pai (`AdminPanel`), passar como prop:

```tsx
function UnitCard({
  overview,
  onOpenOrder,
  onCancelOrder,
  navigate,
}: {
  overview: UnitOverview;
  onOpenOrder: (unitId: string, orderId: string) => void;
  onCancelOrder: (order: OpenOrder, unitName: string) => void;
  navigate: (path: string) => void;
}) {
```

E no local onde `<UnitCard ... />` é renderizado dentro de `AdminPanel`, adicionar `navigate={navigate}`.

Adicionar `AlertTriangle` ao import de `lucide-react` já existente no topo do arquivo.

- [ ] **Step 3: Checar tipos**

`tsconfig.tmp.json` incluindo `server/types/express.d.ts`,
`server/controllers/restaurant-pdv/admin-units-overview.controller.ts`,
`client/src/pages/restaurant-pdv/admin-panel.tsx`.
Run: `npx tsc -p tsconfig.tmp.json`. Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add server/controllers/restaurant-pdv/admin-units-overview.controller.ts client/src/pages/restaurant-pdv/admin-panel.tsx
git commit -m "feat: mostra aviso de pendencia de sync Bling no painel multi-unidade"
```

---

### Task 8: Página "Pendências Bling" com reenvio

**Files:**
- Create: `client/src/pages/restaurant-pdv/admin-bling-sync.tsx`
- Modify: `client/src/App.tsx` (nova rota dentro de `RestaurantPdvSection`)

**Interfaces:**
- Consumes: `GET /api/restaurant-pdv/admin/bling-sync-pending`,
  `POST /api/restaurant-pdv/admin/orders/:id/retry-bling-sync` (Task 6).

- [ ] **Step 1: Criar a página**

```tsx
// client/src/pages/restaurant-pdv/admin-bling-sync.tsx
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { AlertTriangle, RefreshCw, ShieldAlert } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingBlingSyncOrder {
  id: string;
  tableNumber: number;
  unitId: string | null;
  unitName: string | null;
  blingSyncStatus: "bloqueado" | "erro";
  blingSyncError: string | null;
  blingSyncAttempts: number;
  closedAt: string | null;
}

const PENDING_KEY = ["/api/restaurant-pdv/admin/bling-sync-pending"];

export default function AdminBlingSyncPage() {
  const queryClient = useQueryClient();

  const { data: pending = [], isLoading } = useQuery<PendingBlingSyncOrder[]>({
    queryKey: PENDING_KEY,
    refetchInterval: 30_000,
  });

  const retryMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest("POST", `/api/restaurant-pdv/admin/orders/${orderId}/retry-bling-sync`),
    onSuccess: () => {
      toast({ title: "Reenvio disparado" });
      queryClient.invalidateQueries({ queryKey: PENDING_KEY });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao reenviar", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="w-full space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={ShieldAlert}
            color="text-amber-600 dark:text-amber-400"
            bgColor="bg-amber-50 dark:bg-amber-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Pendências de sincronização com o Bling</PageHeader.Title>
            <PageHeader.Description>
              Comandas fechadas cujo pedido de venda não pôde ser criado automaticamente no Bling.
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : pending.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-10 text-muted-foreground">
          <ShieldAlert className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhuma pendência no momento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((order) => (
            <div
              key={order.id}
              className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900 dark:bg-amber-950/20"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    Mesa {order.tableNumber} — {order.unitName ?? "Unidade desconhecida"}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {order.blingSyncStatus === "bloqueado" ? "Bloqueado" : "Erro"}
                    {order.blingSyncAttempts > 0 && ` · ${order.blingSyncAttempts} tentativa(s)`}
                  </Badge>
                </div>
                {order.blingSyncError && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{order.blingSyncError}</p>
                )}
                {order.closedAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Fechada em{" "}
                    {format(new Date(order.closedAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                disabled={retryMutation.isPending}
                onClick={() => retryMutation.mutate(order.id)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reenviar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota**

Em `client/src/App.tsx`, importar junto aos outros componentes do PDV:

```ts
import AdminBlingSyncPage from "@/pages/restaurant-pdv/admin-bling-sync";
```

Dentro de `RestaurantPdvSection`'s `<Switch>` (junto de `/caixa`, `/relatorios`, `/configuracoes`,
`/admin`):

```tsx
<Route path="/pdv-restaurante/admin/bling-pendencias" component={AdminBlingSyncPage} />
```

- [ ] **Step 3: Checar tipos**

`tsconfig.tmp.json` incluindo `client/src/App.tsx` e
`client/src/pages/restaurant-pdv/admin-bling-sync.tsx`.
Run: `npx tsc -p tsconfig.tmp.json`. Expected: sem erros novos.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/restaurant-pdv/admin-bling-sync.tsx client/src/App.tsx
git commit -m "feat: adiciona pagina de pendencias de sync Bling com reenvio manual"
```

---

### Task 9: Campo "Cliente Consumidor Final" no diálogo de unidade

**Files:**
- Modify: `server/controllers/restaurant-pdv/pdv-units.controller.ts` (`createUnitSchema`)
- Modify: `server/services/pdv-units.service.ts` (`listUnitsWithCatalog`)
- Modify: `client/src/pages/restaurant-pdv/settings.tsx` (`UnitDialog`)

**Interfaces:**
- Produces: `defaultClientId` persistido via `POST/PUT /api/restaurant-pdv/units`;
  `PdvUnitWithCatalog.defaultClientName: string | null` na listagem.

- [ ] **Step 1: Aceitar `defaultClientId` no controller**

Em `pdv-units.controller.ts`, adicionar ao `createUnitSchema` (mesmo padrão já usado para
`blingConnectionId`):

```ts
const createUnitSchema = z.object({
  name: z.string().min(1, "Nome da unidade é obrigatório"),
  cnpj: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  footerMessage: z.string().optional().nullable(),
  blingConnectionId: z.string().optional().nullable(),
  defaultClientId: z.string().optional().nullable(),
  defaultServiceFeePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  waiterCommissionPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});
```

Em `createPdvUnitController`, incluir no objeto passado a `createUnit`:

```ts
    const unit = await pdvUnitsService.createUnit({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      footerMessage: parsed.data.footerMessage ?? null,
      blingConnectionId: parsed.data.blingConnectionId ?? null,
      defaultClientId: parsed.data.defaultClientId ?? null,
      defaultServiceFeePercent: parsed.data.defaultServiceFeePercent ?? "10.00",
      waiterCommissionPercent: parsed.data.waiterCommissionPercent ?? "0.00",
      isActive: true,
    });
```

`updatePdvUnitController` já repassa `parsed.data` inteiro para `updateUnit` — passa a incluir
`defaultClientId` automaticamente assim que o schema aceitar o campo.

- [ ] **Step 2: Trazer o nome do cliente na listagem**

Em `server/services/pdv-units.service.ts`, `listUnitsWithCatalog` já faz dois `leftJoin` (em
`blingConnections` e no subquery `counts`). Adicionar um terceiro, em `clients`:

```ts
import { pdvUnits, blingConnections, blingProductMappings, clients } from "../../shared/schema";
```

```ts
  async listUnitsWithCatalog(activeOnly = false): Promise<PdvUnitWithCatalog[]> {
    const counts = db
      .select({
        connectionId: blingProductMappings.connectionId,
        total: sql<number>`count(*)::int`.as("total"),
      })
      .from(blingProductMappings)
      .groupBy(blingProductMappings.connectionId)
      .as("counts");

    const rows = await db
      .select({
        unit: pdvUnits,
        blingAccountName: sql<
          string | null
        >`coalesce(${blingConnections.blingAccountName}, ${blingConnections.name})`,
        blingProductCount: sql<number>`coalesce(${counts.total}, 0)`,
        defaultClientName: clients.name,
      })
      .from(pdvUnits)
      .leftJoin(blingConnections, eq(blingConnections.id, pdvUnits.blingConnectionId))
      .leftJoin(counts, eq(counts.connectionId, pdvUnits.blingConnectionId))
      .leftJoin(clients, eq(clients.id, pdvUnits.defaultClientId))
      .where(activeOnly ? eq(pdvUnits.isActive, true) : undefined)
      .orderBy(pdvUnits.name);

    return rows.map(({ unit, blingAccountName, blingProductCount, defaultClientName }) => ({
      ...unit,
      blingAccountName,
      blingProductCount,
      defaultClientName,
    }));
  },
```

E atualizar o tipo logo acima:

```ts
export type PdvUnitWithCatalog = PdvUnit & {
  blingAccountName: string | null;
  blingProductCount: number;
  defaultClientName: string | null;
};
```

- [ ] **Step 3: Campo de busca no diálogo da unidade**

Em `client/src/pages/restaurant-pdv/settings.tsx`:

Atualizar `PdvUnitWithCatalog` local (usado pelo `useQuery` de `UNITS_KEY`):

```ts
type PdvUnitWithCatalog = PdvUnit & {
  blingAccountName: string | null;
  blingProductCount: number;
  defaultClientName: string | null;
};
```

Adicionar `defaultClientId` ao `unitFormSchema`:

```ts
const unitFormSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  cnpj: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  footerMessage: z.string().optional(),
  blingConnectionId: z.string().optional(),
  defaultClientId: z.string().optional(),
  defaultServiceFeePercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Percentual inválido")
    .optional()
    .default("10.00"),
  waiterCommissionPercent: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Percentual inválido")
    .optional()
    .default("0.00"),
});
```

`UnitDialog` recebe `unit: PdvUnitWithCatalog | null` (já é o tipo efetivo vindo da listagem — só
o parâmetro de tipo da função precisa ser ajustado se hoje for `PdvUnit | null`). No `useForm`
`values`, adicionar `defaultClientId: unit?.defaultClientId ?? ""`. No `mutation.mutationFn`,
incluir `defaultClientId: data.defaultClientId || null,` junto ao `payload`.

Adicionar estado e busca de cliente (mesmo padrão de debounce de
`open-table-dialog.tsx:59-73,99-107`, reaproveitando `GET /api/restaurant-pdv/clients/search`),
dentro de `UnitDialog`:

```ts
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedClientSearch, setDebouncedClientSearch] = useState("");
  const [selectedClientName, setSelectedClientName] = useState(unit?.defaultClientName ?? "");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedClientSearch(clientSearch), 350);
    return () => clearTimeout(timer);
  }, [clientSearch]);

  interface ClientSearchResult {
    id: string;
    name: string;
    phone: string | null;
    cpf: string | null;
    email: string | null;
  }

  const { data: clientResults = [] } = useQuery<ClientSearchResult[]>({
    queryKey: ["/api/restaurant-pdv/clients/search", debouncedClientSearch],
    queryFn: async () => {
      if (debouncedClientSearch.trim().length < 2) return [];
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/clients/search?q=${encodeURIComponent(debouncedClientSearch.trim())}`,
      );
      return res.json();
    },
    enabled: debouncedClientSearch.trim().length >= 2,
  });
```

(`useEffect` e `useQuery` já estão importados no arquivo; adicionar `useEffect` ao import do
`"react"` se ainda não estiver.)

E o campo no formulário, logo depois do `FormField` de `blingConnectionId`:

```tsx
            <FormField
              control={form.control}
              name="defaultClientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cliente Consumidor Final</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        placeholder="Buscar cliente por nome, telefone ou CPF…"
                        value={field.value ? selectedClientName : clientSearch}
                        onChange={(e) => {
                          field.onChange("");
                          setSelectedClientName("");
                          setClientSearch(e.target.value);
                        }}
                      />
                      {!field.value && clientResults.length > 0 && (
                        <div className="absolute z-10 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                          {clientResults.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted border-b last:border-b-0"
                              onClick={() => {
                                field.onChange(client.id);
                                setSelectedClientName(client.name);
                                setClientSearch("");
                              }}
                            >
                              <span className="font-medium">{client.name}</span>
                              {(client.phone || client.cpf) && (
                                <span className="text-xs text-muted-foreground">
                                  {client.phone ?? client.cpf}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Usado no pedido de venda do Bling quando a comanda fecha sem cliente vinculado.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
```

- [ ] **Step 4: Checar tipos**

`tsconfig.tmp.json` incluindo `server/types/express.d.ts`,
`server/controllers/restaurant-pdv/pdv-units.controller.ts`,
`server/services/pdv-units.service.ts`, `client/src/pages/restaurant-pdv/settings.tsx`.
Run: `npx tsc -p tsconfig.tmp.json`. Expected: sem erros novos.

- [ ] **Step 5: Rodar os testes de rota existentes de `pdv-units`**

Run: `npx vitest run --project unit server/routes/__tests__/pdv-units.routes.test.ts`
Expected: continuam passando (os 9 testes já escritos hoje não cobrem `defaultClientId`
diretamente, mas não devem quebrar).

- [ ] **Step 6: Commit**

```bash
git add server/controllers/restaurant-pdv/pdv-units.controller.ts server/services/pdv-units.service.ts client/src/pages/restaurant-pdv/settings.tsx
git commit -m "feat: adiciona cliente consumidor final por unidade PDV"
```

---

## Self-Review

**Cobertura da spec:**
- Modelo de dados (`pdv_units.default_client_id`, campos de sync em `restaurant_orders`, tabela
  de auditoria) → Tasks 1 e 2.
- Resolução de itens/contato, regra de bloqueio sem impedir fechamento → Tasks 3 e 4.
- Tentativa imediata + cron de retry, lock `FOR UPDATE SKIP LOCKED`, limite de 5 tentativas →
  Tasks 4 e 5.
- Auditoria e visibilidade no painel admin (badge + página + reenvio) → Tasks 6, 7 e 8.
- Campo "Cliente Consumidor Final" no diálogo de unidade → Task 9.
- Fora de escopo (forma de pagamento, loja, edição pós-envio, export automático de cliente): não
  implementados em nenhuma task — conforme a spec.

**Consistência de tipos:** `resolveBlingSalesOrderPayload`/`sendOrderToBling` usam os mesmos nomes
em todas as tasks que os consomem (Task 4 chama a função da Task 3 sem alterar assinatura; Task 5
e Task 6 chamam `sendOrderToBling` com a mesma assinatura `(orderId: string) => Promise<void>`
definida na Task 4).
