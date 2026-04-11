# Client Analytics Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a seção de análises da página de clientes respeitar exatamente os mesmos filtros ativos da listagem.

**Architecture:** Centralizar a construção do filtro de clientes no backend para reutilizar a mesma regra nas consultas da listagem e dos relatórios. Propagar os filtros ativos do frontend para os endpoints de relatórios e restringir as consultas comerciais ao conjunto filtrado de clientes.

**Tech Stack:** React, TanStack Query, Express, TypeScript, Drizzle ORM, PostgreSQL

---

### Task 1: Cobrir o bug com teste de backend

**Files:**
- Modify: `server/controllers/reports/get-client-reports.controller.ts`
- Create: `server/controllers/reports/get-client-reports.controller.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("applies the same client filters to client reports", async () => {
  // build request with x-user headers and query { categoria: "VIP", origem: "Indicação" }
  // mock db/repository layer to assert only matching clients are aggregated
  // expect totalClients and grouped stats to include only filtered clients
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- server/controllers/reports/get-client-reports.controller.test.ts`
Expected: FAIL because the controller currently ignores those filters.

- [ ] **Step 3: Implement the minimal backend filtering support**

```ts
const filters = clientsService.normalizeReportFilters(req.query);
const filteredClientScope = await reportsClientFiltersRepository.buildFilteredClientIds({
  userId,
  userRole,
  filterUserId,
  filters,
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- server/controllers/reports/get-client-reports.controller.test.ts`
Expected: PASS.

### Task 2: Reutilizar a regra de filtros no backend

**Files:**
- Modify: `server/repositories/clients.repository.ts`
- Modify: `server/services/clients.service.ts`
- Modify: `server/controllers/reports/get-client-reports.controller.ts`

- [ ] **Step 1: Extrair a construção de condições de filtro de clientes**

```ts
private buildClientFilterConditions(
  userId?: string,
  userRole?: string,
  filters: ClientFilters = {},
  overrideResponsavelId?: string,
) {
  // return shared conditions used by listing and reports
}
```

- [ ] **Step 2: Reusar essa função em `getClients` e `getClientsCount`**

```ts
const conditions = this.buildClientFilterConditions(userId, userRole, filters);
```

- [ ] **Step 3: Expor uma forma de obter o escopo filtrado para relatórios**

```ts
async getFilteredClientIds(...) {
  return this.db.select({ id: clients.id }).from(clients).where(and(...conditions));
}
```

- [ ] **Step 4: Aplicar esse escopo em `/api/reports/clients`**

```ts
const filteredIds = await clientsRepository.getFilteredClientIds(...);
// use inArray(clients.id, filteredIds) in all report queries
```

### Task 3: Propagar filtros da página para os relatórios de clientes

**Files:**
- Modify: `client/src/hooks/useReports.ts`
- Modify: `client/src/pages/clients.tsx`

- [ ] **Step 1: Expandir o contrato do hook `useClientReports`**

```ts
useClientReports({
  filterUserId,
  search: debouncedSearchQuery,
  filters: clientFilters,
  purchaseStatusDays,
});
```

- [ ] **Step 2: Incluir todos os filtros na `queryKey` e na URL**

```ts
if (filters.categoria) params.set("categoria", filters.categoria);
if (filters.purchaseStatus && filters.purchaseStatus !== "all") {
  params.set("purchaseStatus", filters.purchaseStatus);
  params.set("purchaseStatusDays", String(purchaseStatusDays));
}
```

- [ ] **Step 3: Validar manualmente o card de relatórios na página**

Run: abrir `/clientes`, aplicar filtros e confirmar que categoria, origem, responsável, marcadores e cobertura de dados refletem a mesma base filtrada da tabela.

### Task 4: Propagar filtros da página para a análise comercial

**Files:**
- Modify: `client/src/components/reports/client-commercial-grid.tsx`
- Modify: `client/src/components/reports/client-reports-grid.tsx`
- Modify: `client/src/pages/clients.tsx`
- Modify: `server/controllers/users/get-top-clients.controller.ts`
- Modify: `server/controllers/users/get-portfolio-stats.controller.ts`
- Modify: `server/controllers/users/get-inactive-clients.controller.ts`
- Modify: `server/services/seller-dashboard.service.ts`

- [ ] **Step 1: Passar os filtros ativos para `ClientCommercialGrid` e `TopClientesCard`**

```ts
<ClientCommercialGrid
  startDate={startDate}
  endDate={endDate}
  userId={filterUserId}
  search={debouncedSearchQuery}
  filters={clientFilters}
  purchaseStatusDays={purchaseStatusDays}
/>
```

- [ ] **Step 2: Enviar os filtros em todas as queries comerciais**

```ts
const qs = buildClientAnalyticsSearchParams({ startDate, endDate, userId, search, filters, purchaseStatusDays });
```

- [ ] **Step 3: Restringir as queries comerciais ao conjunto filtrado de clientes**

```ts
const scopedClientIds = await clientsRepository.getFilteredClientIds(...);
// use scoped ids in top clients, inactive clients, portfolio stats and new clients
```

- [ ] **Step 4: Garantir que `Top Clientes do Mês` use o mesmo escopo filtrado**

```ts
<TopClientesCard userId={userId} search={search} filters={filters} purchaseStatusDays={purchaseStatusDays} />
```

### Task 5: Verificação final

**Files:**
- Modify: any touched files above

- [ ] **Step 1: Run targeted verification for the new behavior**

Run: `npm run check`
Expected: typecheck sem erros.

- [ ] **Step 2: Run the new/updated focused tests**

Run: `npm run test -- server/controllers/reports/get-client-reports.controller.test.ts`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: abrir `/clientes`, aplicar pelo menos estes cenários:
- categoria + origem
- responsável + marcador
- status de compra ativo/inativo
- busca por nome/telefone

Expected: tabela e seção `Análises` exibem o mesmo recorte lógico de clientes.
