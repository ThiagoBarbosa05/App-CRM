# PDV Mesas UX/UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish responsividade, espaçamento, contraste de cores e estados de carregamento na página "Mesas" do PDV Restaurante, sem mudar arquitetura, queries ou comportamento.

**Architecture:** Mudança contida em um único arquivo, `client/src/pages/restaurant-pdv/table-map.tsx`. Apenas classes Tailwind e dois componentes de skeleton inline (mesmo padrão já usado no arquivo para `RecentSalesSection`). Nenhum arquivo novo, nenhuma mudança de estado ou lógica de negócio.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, `@/components/ui/skeleton` (Shadcn `Skeleton`, já usado em 70+ lugares do CRM).

## Global Constraints

- Escopo travado em `client/src/pages/restaurant-pdv/table-map.tsx` — não tocar `pdv-header.tsx` nem outras páginas do PDV.
- Manter semântica de cores: laranja = mesa ocupada, azul = aguardando pagamento.
- Sem componentes novos em arquivos separados — skeletons ficam inline no mesmo arquivo.
- Não rodar `npm run db:push` nem iniciar servidor de preview — mudança de UI valida-se por leitura de código + `npm run check` (regra do projeto em `CLAUDE.md`).
- `strict: true`, sem `any`, ESM only — já satisfeito pelo arquivo existente, apenas preservar.

---

### Task 1: Grid fluido, padding e botão responsivo do banner de caixa

**Files:**
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:276` (container da página)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:330-338` (botões "Abrir caixa" no banner)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:346` (grid de mesas)

**Interfaces:**
- Não introduz nem consome interfaces novas — só classes Tailwind em JSX existente.

- [ ] **Step 1: Ajustar padding e espaçamento do container raiz**

Em `client/src/pages/restaurant-pdv/table-map.tsx:276`, trocar:

```tsx
  return (
    <div className="w-full space-y-6 p-4">
```

por:

```tsx
  return (
    <div className="w-full space-y-5 px-4 py-4 sm:space-y-6 sm:px-6 sm:py-6">
```

- [ ] **Step 2: Tornar os botões "Abrir caixa" do banner full-width em mobile**

Em `client/src/pages/restaurant-pdv/table-map.tsx:329-339`, trocar:

```tsx
          {isGestor && (
            <Button size="sm" onClick={() => navigate("/pdv-restaurante/caixa")}>
              Abrir caixa
            </Button>
          )}
          {isGarcom && (
            <Button size="sm" onClick={() => setOpenCashOpen(true)}>
              <Wallet className="mr-1.5 h-4 w-4" />
              Abrir caixa
            </Button>
          )}
```

por:

```tsx
          {isGestor && (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => navigate("/pdv-restaurante/caixa")}
            >
              Abrir caixa
            </Button>
          )}
          {isGarcom && (
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => setOpenCashOpen(true)}
            >
              <Wallet className="mr-1.5 h-4 w-4" />
              Abrir caixa
            </Button>
          )}
```

- [ ] **Step 3: Trocar grid de colunas fixas por grid fluido**

Em `client/src/pages/restaurant-pdv/table-map.tsx:346`, trocar:

```tsx
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
```

por:

```tsx
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:gap-4">
```

- [ ] **Step 4: Verificar tipos**

Criar `tsconfig.tmp.json` na raiz do repo:

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/pages/restaurant-pdv/table-map.tsx"],
  "exclude": ["node_modules"]
}
```

Rodar:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro em `table-map.tsx` (mudanças são só classes Tailwind, sem impacto de tipo).

Apagar `tsconfig.tmp.json` depois de confirmar.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/restaurant-pdv/table-map.tsx
git commit -m "feat: grid fluido e padding responsivo na página de mesas do PDV"
```

---

### Task 2: Contraste de cores nos cards de mesa

**Files:**
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:363-379`

**Interfaces:**
- Consome: variável local `isAguardando` (já existente em `table-map.tsx:348`, `const isAguardando = table.status === "aguardando_pagamento";`) para decidir a classe de cor.

- [ ] **Step 1: Trocar opacidade por tons explícitos nos textos secundários do card de mesa**

Em `client/src/pages/restaurant-pdv/table-map.tsx:363-379`, trocar:

```tsx
                  <span className="mt-0.5 text-xs font-medium opacity-70">
                    Mesa
                  </span>

                  <div className="mt-3 space-y-1">
                    {table.peopleCount != null && (
                      <div className="flex items-center gap-1 text-xs opacity-80">
                        <Users className="h-3 w-3" />
                        {table.peopleCount} pessoa(s)
                      </div>
                    )}
                    {table.openedAt && (
                      <div className="flex items-center gap-1 text-xs opacity-70">
                        <Clock className="h-3 w-3" />
                        {elapsedLabel(table.openedAt)}
                      </div>
                    )}
                  </div>
```

por:

```tsx
                  <span
                    className={cn(
                      "mt-0.5 text-xs font-medium",
                      isAguardando
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-orange-700 dark:text-orange-300",
                    )}
                  >
                    Mesa
                  </span>

                  <div className="mt-3 space-y-1">
                    {table.peopleCount != null && (
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          isAguardando
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-orange-700 dark:text-orange-300",
                        )}
                      >
                        <Users className="h-3 w-3" />
                        {table.peopleCount} pessoa(s)
                      </div>
                    )}
                    {table.openedAt && (
                      <div
                        className={cn(
                          "flex items-center gap-1 text-xs",
                          isAguardando
                            ? "text-blue-700 dark:text-blue-300"
                            : "text-orange-700 dark:text-orange-300",
                        )}
                      >
                        <Clock className="h-3 w-3" />
                        {elapsedLabel(table.openedAt)}
                      </div>
                    )}
                  </div>
```

`cn` já está importado em `table-map.tsx:5` (`import { cn } from "@/lib/utils";`) — nenhum import novo necessário.

- [ ] **Step 2: Verificar tipos**

Criar `tsconfig.tmp.json` (mesmo conteúdo do Task 1, Step 4) e rodar:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar `tsconfig.tmp.json` depois.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/restaurant-pdv/table-map.tsx
git commit -m "fix: contraste de texto secundário nos cards de mesa do PDV"
```

---

### Task 3: Skeletons de carregamento (grid de mesas e vendas fechadas)

**Files:**
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:1-22` (imports)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx` (novo componente `RecentSalesSkeleton`, antes de `RecentSalesSection`)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:73-75` (uso em `RecentSalesSection`)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx` (novo componente `TableGridSkeleton`, antes de `TableMapGrid`)
- Modify: `client/src/pages/restaurant-pdv/table-map.tsx:343-345` (uso em `TableMapGrid`)

**Interfaces:**
- Consome: `Skeleton` de `@/components/ui/skeleton` (componente existente, `{ className?: string } & React.HTMLAttributes<HTMLDivElement>`).
- Consome: `cn` de `@/lib/utils` (já importado).
- Produces: `RecentSalesSkeleton()` e `TableGridSkeleton()` — componentes sem props, só para uso interno neste arquivo.

- [ ] **Step 1: Importar `Skeleton`**

Em `client/src/pages/restaurant-pdv/table-map.tsx:6`, logo após o import de `Button`, adicionar:

```tsx
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 2: Criar `RecentSalesSkeleton` e usá-lo em `RecentSalesSection`**

Em `client/src/pages/restaurant-pdv/table-map.tsx`, logo antes da função `RecentSalesSection` (linha 53), adicionar:

```tsx
function RecentSalesSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Mesa</th>
            <th className="px-3 py-2 text-left font-medium">Horário</th>
            <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">
              Pagamento
            </th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 3 }).map((_, idx) => (
            <tr
              key={idx}
              className={cn(
                "border-b last:border-0",
                idx % 2 === 0 ? "bg-background" : "bg-muted/20",
              )}
            >
              <td className="px-3 py-2.5">
                <Skeleton className="h-4 w-14" />
              </td>
              <td className="px-3 py-2.5">
                <Skeleton className="h-4 w-10" />
              </td>
              <td className="px-3 py-2.5 hidden sm:table-cell">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="px-3 py-2.5 text-right">
                <Skeleton className="ml-auto h-4 w-16" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

Em `client/src/pages/restaurant-pdv/table-map.tsx:73-75`, dentro de `RecentSalesSection`, trocar:

```tsx
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando vendas...</p>
      ) : orders.length === 0 ? (
```

por:

```tsx
      {isLoading ? (
        <RecentSalesSkeleton />
      ) : orders.length === 0 ? (
```

- [ ] **Step 3: Criar `TableGridSkeleton` e usá-lo em `TableMapGrid`**

Em `client/src/pages/restaurant-pdv/table-map.tsx`, logo antes da função `TableMapGrid` (linha 154), adicionar:

```tsx
function TableGridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:gap-4">
      {Array.from({ length: 8 }).map((_, idx) => (
        <div key={idx} className="rounded-xl border-2 border-border p-4">
          <Skeleton className="h-7 w-8" />
          <Skeleton className="mt-2 h-3 w-10" />
          <div className="mt-3 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

Em `client/src/pages/restaurant-pdv/table-map.tsx:343-345`, dentro de `TableMapGrid`, trocar:

```tsx
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando mesas...</p>
      ) : tables.length === 0 ? null : (
```

por:

```tsx
      {isLoading ? (
        <TableGridSkeleton />
      ) : tables.length === 0 ? null : (
```

- [ ] **Step 4: Verificar tipos**

Criar `tsconfig.tmp.json` (mesmo conteúdo do Task 1, Step 4) e rodar:

```bash
npx tsc -p tsconfig.tmp.json
```

Esperado: nenhum erro. Apagar `tsconfig.tmp.json` depois.

- [ ] **Step 5: Ler o arquivo final e conferir visualmente a estrutura**

Reler `client/src/pages/restaurant-pdv/table-map.tsx` por completo e confirmar:
- `RecentSalesSkeleton` está definido antes de `RecentSalesSection` e é usado no branch `isLoading`.
- `TableGridSkeleton` está definido antes de `TableMapGrid` e é usado no branch `isLoading` do grid.
- Nenhum outro `isLoading`/texto de carregamento ficou esquecido.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/restaurant-pdv/table-map.tsx
git commit -m "feat: skeletons de carregamento no grid de mesas e vendas fechadas do PDV"
```

---

## Verificação final (após as 3 tasks)

1. Rodar `npx tsc -p tsconfig.tmp.json` (recriando o arquivo temporário se já foi apagado) cobrindo `client/src/pages/restaurant-pdv/table-map.tsx` — deve passar sem erros.
2. Ler o arquivo final inteiro e confirmar que as 4 mudanças da spec (grid fluido, espaçamento, contraste de cor, skeletons) estão todas presentes.
3. Pular verificação visual em navegador (preview/browser), conforme regra do projeto em `CLAUDE.md` para mudanças de UI.
