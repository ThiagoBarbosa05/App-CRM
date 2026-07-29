# PDV Restaurante — Polish de UX/UI na página de Mesas

## Contexto

A página principal do PDV Restaurante (`client/src/pages/restaurant-pdv/table-map.tsx`, componente `TableMapGrid`, renderizado por `mesas.tsx`) é o ponto de entrada do garçom/gestor: mostra o grid de mesas, um banner de status de caixa e a lista de últimas vendas fechadas. O layout funciona, mas foi construído incrementalmente e acumulou inconsistências: grid de colunas por breakpoints fixos (saltos bruscos em vez de adaptação fluida), padding que não segue o padrão do `PageHeader` compartilhado do CRM, textos secundários com opacidade sobre fundo colorido (risco de contraste), e estados de carregamento que são só texto (`"Carregando mesas..."`, `"Carregando vendas..."`) em vez de skeletons.

Este é um polish visual/responsivo pontual — sem mudança de arquitetura, sem features novas, sem novos componentes fora do arquivo.

## Escopo

**Dentro do escopo:** `client/src/pages/restaurant-pdv/table-map.tsx` — grid de mesas, card/label de contagem no `PageHeader`, banner de caixa fechado, seção "Últimas vendas fechadas".

**Fora do escopo:** `client/src/components/restaurant-pdv/pdv-header.tsx` (barra superior fixa) e qualquer outra página do PDV (comanda, admin panel, etc).

## Mudanças

### 1. Responsividade — grid fluido

Trocar o grid de colunas por breakpoint:
```
grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5
```
por um grid fluido baseado em largura mínima do card, que adapta o número de colunas ao espaço real disponível sem depender de breakpoints específicos:
```
grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3 sm:gap-4
```

Padding externo do container da página (`w-full space-y-6 p-4`) passa a seguir o padrão de espaçamento do `PageHeader` já usado no resto do CRM (`px-5 sm:px-6`):
```
w-full space-y-5 sm:space-y-6 px-4 py-4 sm:px-6 sm:py-6
```

Banner de "caixa fechado": o botão de ação (`Abrir caixa`) ganha `w-full sm:w-auto` para alvo de toque melhor em telas estreitas.

### 2. Espaçamento

- Espaçamento vertical entre seções: `space-y-6` → `space-y-5 sm:space-y-6`.
- Gap interno do grid de mesas: `gap-3` → `gap-3 sm:gap-4` (já coberto acima).

### 3. Cores — contraste

Mantém a semântica atual (laranja = mesa ocupada, azul = aguardando pagamento). Troca textos secundários dentro dos cards de mesa que hoje usam opacidade sobre fundo colorido (`opacity-70`, `opacity-80`) por tons explícitos da paleta, que garantem contraste consistente em light e dark:

- Label "Mesa", contador de pessoas, tempo decorrido: `opacity-70`/`opacity-80` → `text-orange-700 dark:text-orange-300` (cards ocupados) / `text-blue-700 dark:text-blue-300` (cards aguardando pagamento).

Nenhuma outra cor muda — banner âmbar de caixa fechado, badge "Pagar" azul, e cores de valores na tabela de vendas (verde) ficam como estão.

### 4. Skeletons de carregamento

Dois componentes de skeleton definidos inline em `table-map.tsx` (mesmo padrão do `RecentSalesSection`, que já é inline no arquivo), usando `<Skeleton>` de `@/components/ui/skeleton` (já usado em 70+ lugares do CRM):

- **`TableGridSkeleton`** — renderiza ~8 placeholders no mesmo grid fluido, cada um imitando a forma do card de mesa real: linha grande (número), linha pequena (label "Mesa"), duas linhas menores (pessoas/tempo). Substitui `<p>Carregando mesas...</p>` no `isLoading` do `useQuery` de `/api/restaurant-pdv/tables/map`.
- **`RecentSalesSkeleton`** — renderiza ~3 linhas de skeleton imitando as colunas da tabela de vendas fechadas (mesa, horário, pagamento, total). Substitui `<p>Carregando vendas...</p>` no `isLoading` do `useQuery` de `/api/restaurant-pdv/cash-sessions/current/orders`, dentro de `RecentSalesSection`.

## Fora de escopo / não muda

- Nenhuma mudança de arquitetura, estado, queries ou lógica de negócio.
- Nenhum componente novo em arquivo separado — os skeletons ficam inline, seguindo o padrão já existente no arquivo.
- `pdv-header.tsx` não é tocado.
- Cores semânticas (laranja/azul) e demais elementos visuais (badge "Pagar", banner âmbar, cores da tabela de vendas) não mudam de significado, só o contraste do texto secundário dentro dos cards de mesa.

## Verificação

1. `npm run check` com o tsconfig temporário (ver `CLAUDE.md`) cobrindo `table-map.tsx`.
2. Leitura de código para confirmar que o grid fluido, o padding e os skeletons foram aplicados corretamente — conforme regra do projeto, pular verificação visual em navegador para mudanças de UI.
