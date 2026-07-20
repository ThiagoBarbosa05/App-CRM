# Cursor pagination — aba Eventos do Dashboard

## Contexto

A aba "Eventos" do dashboard ([events-dashboard.tsx](../../../client/src/components/events-dashboard.tsx)) hoje busca **todos** os eventos do usuário via `GET /api/events` (`storage.getEvents`, [storage.ts:5788](../../../server/storage.ts:5788)), sem paginação nem filtro no servidor — a `queryKey` é fixa em `["/api/events"]` e nem usa `startDate`/`endDate`. O filtro por período (Hoje/Este mês/Mês passado/Período, controlado em [dashboard.tsx](../../../client/src/pages/dashboard.tsx)) e o corte de 50 itens acontecem inteiramente no client, ordenados só de forma ascendente por `eventDate` — sem separar o que ainda vai acontecer do que já passou.

Resultado: dentro do período selecionado, eventos já finalizados aparecem misturados (ou até sozinhos) sem nenhuma prioridade para o que ainda vai acontecer, e a lista nunca pagina — só mostra o que sobrou depois do filtro de mês.

Objetivo: substituir o filtro por período nesta aba por duas listas paginadas por cursor — **Próximos eventos** e **Eventos passados** — carregadas sob demanda via botão "Carregar mais".

## Decisões já validadas com o usuário

- A paginação por cursor **substitui** os filtros de período (Hoje/Este mês/Mês passado/Período) especificamente na aba Eventos. Esses filtros continuam controlando as outras abas do dashboard normalmente.
- Layout: duas sub-abas dentro da aba Eventos — **Próximos** (padrão) e **Passados** — cada uma com sua própria paginação e botão "Carregar mais" (não infinite scroll).
- Tamanho de página: **9 itens** (encaixa nas 3 linhas do grid `md:2 xl:3` colunas já existente).
- Corte futuro/passado por `event_date` diretamente (`DATE(event_date) >= hoje` vs `< hoje`), não pelo campo `status` — não depende do cron `update-expired-events-scheduler.ts`, que só roda 1x/dia em produção.

## Cursor composto `(at, id)`

Reaproveita os helpers já existentes em [cursor-pagination.ts](../../../server/lib/cursor-pagination.ts) (`encodeCursor`, `decodeCursor`, `clampLimit`), criados para a paginação do chat WhatsApp. `id` de `events` é UUID não sequencial, então o cursor precisa ser composto `(eventDate, id)` com comparação de tupla, pelo mesmo motivo já documentado nesse arquivo (evita duplicatas/pulos quando dois eventos têm o mesmo `event_date`).

## Backend

### `GET /api/events` ([events.routes.ts:72](../../../server/routes/events.routes.ts:72))

- Três novos query params opcionais: `mode` (`"upcoming" | "past"`), `cursor`, `limit`.
- **Sem `mode`**: comportamento idêntico ao atual — retorna `Event[]` puro. Preserva os outros três consumidores do endpoint que pedem a lista completa sem paginação: [events-management.tsx](../../../client/src/components/events-management.tsx), [client-filters.tsx](../../../client/src/components/client-filters.tsx), [event-participants-modal.tsx](../../../client/src/components/event-participants-modal.tsx).
- **Com `mode`**: chama o novo `storage.getEventsPaginated(...)` e responde `{ events: Event[], nextCursor: string | null }`.
- `limit` passa por `clampLimit(raw, { fallback: 9, max: 50 })`.
- `cursor` passa por `decodeCursor` — cursor inválido/malformado vira "sem cursor" (primeira página), nunca 500.

### `storage.getEventsPaginated` (novo método em [storage.ts](../../../server/storage.ts), próximo a `getEvents`)

```ts
getEventsPaginated(params: {
  userId?: string;
  userRole?: string;
  mode: "upcoming" | "past";
  cursor: Cursor | null;
  limit: number;
}): Promise<{ events: Event[]; nextCursor: string | null }>
```

- Reaproveita a mesma `select` de `getEvents` (todos os campos calculados de participantes/receita via subqueries) — só muda `WHERE`/`ORDER BY`/`LIMIT`.
- Filtro de escopo por usuário: igual a `getEvents` hoje (`eq(events.createdBy, userId)` quando não-admin).
- **`upcoming`**: `WHERE DATE(event_date) >= DATE(now())`, mais a condição de cursor `(event_date, id) > (cursor.at, cursor.id)` (comparação de tupla SQL) quando há cursor. `ORDER BY event_date ASC, id ASC`.
- **`past`**: `WHERE DATE(event_date) < DATE(now())`, mais a condição de cursor `(event_date, id) < (cursor.at, cursor.id)` quando há cursor. `ORDER BY event_date DESC, id DESC`.
- Busca `limit + 1` linhas: se vierem `limit + 1`, `hasMore = true`, descarta a última e usa a fronteira (linha `limit`) para montar `nextCursor`; senão `nextCursor = null`.
- Anexos continuam buscados por evento via `getEventAttachments` (mesmo padrão N+1 de `getEvents` hoje — fora de escopo otimizar aqui, e o volume por página cai de "todos os eventos" para 9, o que já reduz o custo na prática).
- `getEvents` original **não é alterado** — usado como está pelos três consumidores fora desta aba.

### `DATE(now())` — timezone

Usa o mesmo padrão já empregado em `updateExpiredEvents` ([storage.ts:5985](../../../server/storage.ts:5985)): `new Date()` normalizado para meia-noite local do processo Node, comparado via `DATE(event_date) < DATE(${todayStr})`. Mantém consistência com a lógica de expiração já existente em vez de introduzir uma nova convenção de timezone só para esta feature.

## Frontend — [events-dashboard.tsx](../../../client/src/components/events-dashboard.tsx)

- Remove as props `startDate`, `endDate`, `datePreset` da interface `EventsDashboardProps` — não fazem mais sentido nesta aba. Atualiza a chamada em [dashboard.tsx:446](../../../client/src/pages/dashboard.tsx:446) para `<EventsDashboard />`.
- Adiciona `Tabs` internas (mesmo componente `@/components/ui/tabs` já usado no resto do dashboard): **Próximos** (valor padrão) / **Passados**.
- Cada sub-aba usa `useInfiniteQuery`:
  - `queryKey: ["/api/events", mode]`.
  - `queryFn`: `GET /api/events?mode=<mode>&cursor=<pageParam>&limit=9`.
  - `initialPageParam: undefined`, `getNextPageParam: (last) => last.nextCursor ?? undefined`.
  - Achata `data.pages.flatMap(p => p.events)` para renderizar no grid existente.
- Botão "Carregar mais" abaixo do grid, visível só quando `hasNextPage`; estado de loading (`isFetchingNextPage`) desabilita o botão e mostra spinner/texto "Carregando...".
- Título/descrição do card deixam de depender de `datePreset`; passam a refletir a sub-aba ativa: "Próximos Eventos" / "Eventos planejados e ativos que ainda vão acontecer" para `upcoming`, "Eventos Passados" / "Eventos que já aconteceram" para `past`.
- Estado vazio por aba: "Nenhum evento futuro encontrado" (upcoming) / "Nenhum evento passado encontrado" (past).
- Ajuste cosmético no card: a faixa lateral colorida hoje usa `daysUntil <= 7 ? amarelo : roxo` como fallback, o que pinta **todo** evento passado de amarelo (`daysUntil` negativo é sempre `<= 7`). Passa a checar `daysUntil < 0 ? cinza : ...` antes das outras condições, já que "vence em X dias" não se aplica a eventos passados. O texto "📅 Em X dias" (só aparece se `daysUntil > 0`) já não precisa de ajuste.
- O restante do card (imagem, badges, carousel de anexos, botão "Ver Detalhes do Evento" que abre a impressão de participantes) permanece exatamente como está.

## Erros e casos de borda

- Cursor inválido/malformado no request → backend trata como "sem cursor" via `decodeCursor`, nunca 500.
- `fetchNextPage()` falha → mostra toast de erro (padrão já usado no componente via `useToast`), sem descartar os eventos já carregados.
- Evento sem nenhum resultado na sub-aba → estado vazio já descrito acima.
- Evento com `event_date` exatamente hoje conta como `upcoming` (`DATE(event_date) >= DATE(now())` inclui o dia de hoje).

## Fora de escopo

- Não otimiza o N+1 de `getEventAttachments` por evento (mesmo padrão de `getEvents` hoje).
- Não altera `getEvents` nem os três consumidores que pedem a lista completa sem paginação.
- Não implementa infinite scroll automático — decisão explícita do usuário por botão "Carregar mais".
- Não altera a lógica do cron `update-expired-events-scheduler.ts` (continua atualizando `status` para `finalizado`, mas a aba Eventos do dashboard não depende mais desse campo para decidir futuro/passado).
