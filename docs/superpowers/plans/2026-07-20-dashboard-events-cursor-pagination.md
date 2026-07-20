# Cursor Pagination — Aba Eventos do Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a listagem client-side sem paginação da aba "Eventos" do dashboard por duas listas paginadas por cursor (keyset) — **Próximos** e **Passados** — carregadas via botão "Carregar mais".

**Architecture:** `GET /api/events` ganha `mode`/`cursor`/`limit` opcionais; sem eles, resposta idêntica à atual (array puro), preservando os 3 outros consumidores do endpoint. Com `mode`, chama um novo método de storage (`getEventsPaginated`) que faz keyset pagination por `(event_date, id)`, reaproveitando os helpers `encodeCursor`/`decodeCursor`/`clampLimit` já existentes em `server/lib/cursor-pagination.ts` (criados para a paginação do chat WhatsApp). No front, `events-dashboard.tsx` ganha sub-abas Próximos/Passados, cada uma com seu `useInfiniteQuery`.

**Tech Stack:** Express + Drizzle ORM (Postgres/Neon) no backend; React + TanStack Query (`useInfiniteQuery`) + Radix Tabs no frontend. Vitest + Supertest para os testes de rota.

## Global Constraints

- `strict: true` no TypeScript — nunca usar `any`.
- Sempre `async/await`, nunca `.then()`.
- Rodar `npm run check` antes de finalizar (ver nota no CLAUDE.md sobre OOM — usar o `tsconfig.tmp.json` isolado quando necessário).
- Pular verificação visual em browser para esta mudança de UI — validar só via leitura de código e `npm run check` (regra explícita do projeto).
- Não modificar `getEvents` (o método sem paginação) nem os 3 consumidores que dependem dele sem `mode`: `events-management.tsx`, `client-filters.tsx`, `event-participants-modal.tsx`.
- Página de 9 itens, teto de 50 no `limit`.
- Corte futuro/passado por `DATE(event_date)` comparado a `DATE(hoje)`, não pelo campo `status`.

---

## Task 1: Storage — `getEventsPaginated` (keyset pagination)

**Files:**
- Modify: `server/storage.ts:619` (assinatura na interface `IStorage`)
- Modify: `server/storage.ts:5900` (novo método logo após `getEvents`, classe `DatabaseStorage`)

**Interfaces:**
- Consumes: `Cursor`, `encodeCursor`, `clampLimit` de `server/lib/cursor-pagination.ts` (já existem, não precisam ser criados).
- Produces: `storage.getEventsPaginated(params: { userId?: string; userRole?: string; mode: "upcoming" | "past"; cursor: Cursor | null; limit: number }): Promise<{ events: Event[]; nextCursor: string | null }>` — usado pela rota na Task 2.

Não há teste unitário isolado para este método (é um método de classe que fala direto com o banco via Drizzle, no mesmo padrão de `getEvents`, que também não tem teste dedicado — só é exercitado indiretamente pelos testes de rota da Task 2, que mockam `storage`). A correção da query é validada por leitura + `npm run check` nesta task, e pelo comportamento observado via os testes de rota na Task 2.

- [ ] **Step 1: Adicionar o import do tipo `Cursor` e dos helpers no topo de `server/storage.ts`**

Abra `server/storage.ts` e localize o bloco de imports de `@shared/schema` (linhas 1-60 aproximadamente). Logo abaixo do último `import` do arquivo (antes da declaração de `IStorage`), adicione:

```ts
import type { Cursor } from "./lib/cursor-pagination";
import { encodeCursor } from "./lib/cursor-pagination";
```

- [ ] **Step 2: Adicionar a assinatura na interface `IStorage`**

Em `server/storage.ts:619`, logo abaixo de `getEvents(userId?: string, userRole?: string): Promise<Event[]>;`, adicione:

```ts
  getEventsPaginated(params: {
    userId?: string;
    userRole?: string;
    mode: "upcoming" | "past";
    cursor: Cursor | null;
    limit: number;
  }): Promise<{ events: Event[]; nextCursor: string | null }>;
```

- [ ] **Step 3: Implementar o método na classe `DatabaseStorage`**

Localize o fim do método `getEvents` em `server/storage.ts` (fecha em `server/storage.ts:5900`, logo antes de `async getEventBySlug`). Adicione o novo método logo depois do fechamento de `getEvents` e antes de `getEventBySlug`:

```ts
  async getEventsPaginated(params: {
    userId?: string;
    userRole?: string;
    mode: "upcoming" | "past";
    cursor: Cursor | null;
    limit: number;
  }): Promise<{ events: Event[]; nextCursor: string | null }> {
    try {
      const { userId, userRole, mode, cursor, limit } = params;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      const baseQuery = this.db
        .select({
          id: events.id,
          name: events.name,
          description: events.description,
          imageUrl: events.imageUrl,
          eventDate: events.eventDate,
          registrationDeadline: events.registrationDeadline,
          location: events.location,
          pricePerPerson: events.pricePerPerson,
          maxCapacity: events.maxCapacity,
          category: events.category,
          status: events.status,
          notes: events.notes,
          wineRevenue: events.wineRevenue,
          slug: events.slug,
          landingPageHtmlKey: events.landingPageHtmlKey,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          creatorName: users.name,
          participantCount: sql<number>`(
            SELECT COALESCE(SUM(${eventParticipants.numberOfParticipants}), 0)::int
            FROM ${eventParticipants}
            WHERE ${eventParticipants.eventId} = ${events.id}
            AND ${eventParticipants.status} != 'cancelado'
          )`,
          paidParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'pagar_na_hora')
          )`,
          eventRevenue: sql<number>`(
            SELECT COALESCE(SUM(
              CASE
                WHEN ep.custom_price IS NOT NULL THEN ep.custom_price::numeric
                ELSE ep.number_of_participants::numeric * "events"."price_per_person"::numeric
              END
            ), 0)
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'pagar_na_hora')
          )`,
          pendingParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'pendente'
          )`,
          ausenteParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'pagar_na_hora'
          )`,
          confirmedParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'convidado', 'pagar_na_hora')
          )`,
          presentCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.attended = true
          )`,
          convidadoCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'convidado'
          )`,
          absentCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.attended = false
          )`,
        })
        .from(events)
        .leftJoin(users, eq(events.createdBy, users.id));

      const conditions: ReturnType<typeof eq>[] = [];

      if (userRole !== "admin" && userRole !== "administrador" && userId) {
        conditions.push(eq(events.createdBy, userId));
      }

      if (mode === "upcoming") {
        conditions.push(
          sql`DATE(${events.eventDate}) >= DATE(${todayStr})` as unknown as ReturnType<typeof eq>,
        );
        if (cursor) {
          conditions.push(
            sql`(${events.eventDate}, ${events.id}) > (${cursor.at}::timestamp, ${cursor.id})` as unknown as ReturnType<typeof eq>,
          );
        }
      } else {
        conditions.push(
          sql`DATE(${events.eventDate}) < DATE(${todayStr})` as unknown as ReturnType<typeof eq>,
        );
        if (cursor) {
          conditions.push(
            sql`(${events.eventDate}, ${events.id}) < (${cursor.at}::timestamp, ${cursor.id})` as unknown as ReturnType<typeof eq>,
          );
        }
      }

      const orderedQuery =
        mode === "upcoming"
          ? baseQuery
              .where(and(...conditions))
              .orderBy(asc(events.eventDate), asc(events.id))
          : baseQuery
              .where(and(...conditions))
              .orderBy(desc(events.eventDate), desc(events.id));

      const rows = await orderedQuery.limit(limit + 1);

      const hasMore = rows.length > limit;
      const pageRows = rows.slice(0, limit);
      const boundary = pageRows[pageRows.length - 1];
      const nextCursor =
        hasMore && boundary
          ? encodeCursor({
              at: boundary.eventDate.toISOString(),
              id: boundary.id,
            })
          : null;

      const eventsWithAttachments = await Promise.all(
        pageRows.map(async (event) => {
          const attachments = await this.getEventAttachments(event.id);
          return { ...event, attachments };
        }),
      );

      return { events: eventsWithAttachments, nextCursor };
    } catch (error) {
      console.error("Error fetching paginated events:", error);
      throw error;
    }
  }
```

- [ ] **Step 4: Confirmar que `and`, `asc`, `desc` já estão importados de `drizzle-orm` em `server/storage.ts`**

Rode:

```bash
grep -n "^import.*drizzle-orm" server/storage.ts
```

Confirme que `and`, `asc`, `desc`, `eq`, `sql` aparecem na lista (o arquivo já os usa extensivamente em outros métodos — se algum estiver faltando, adicione ao import existente de `drizzle-orm`, não crie um import novo).

- [ ] **Step 5: Type-check isolado do arquivo tocado**

Crie `tsconfig.tmp.json` na raiz do repo (apagar depois — ver nota do CLAUDE.md sobre OOM):

```jsonc
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "server/storage.ts", "server/lib/cursor-pagination.ts"],
  "exclude": ["node_modules"]
}
```

Rode:

```bash
npx tsc -p tsconfig.tmp.json
```

Expected: sem novos erros introduzidos por este método (o arquivo já tem erros pré-existentes documentados no CLAUDE.md — compare a lista antes/depois se tiver dúvida). Apague `tsconfig.tmp.json` ao final.

- [ ] **Step 6: Commit**

```bash
git add server/storage.ts
git commit -m "feat: adiciona getEventsPaginated com keyset pagination por (event_date, id)"
```

---

## Task 2: Rota — `GET /api/events` com `mode`/`cursor`/`limit`

**Files:**
- Modify: `server/routes/events.routes.ts:72-83`
- Test: `server/routes/__tests__/events.routes.test.ts`

**Interfaces:**
- Consumes: `storage.getEventsPaginated(...)` da Task 1; `decodeCursor`, `clampLimit` de `server/lib/cursor-pagination.ts`.
- Produces: `GET /api/events` sem `mode` → `Event[]`; `GET /api/events?mode=upcoming|past&cursor=&limit=` → `{ events: Event[], nextCursor: string | null }`. Consumido pelo frontend na Task 3.

- [ ] **Step 1: Escrever os testes de rota (falhando)**

Abra `server/routes/__tests__/events.routes.test.ts`. No bloco `vi.hoisted`, adicione `getEventsPaginatedMock: vi.fn()` à lista de mocks:

```ts
const {
  getEventsMock,
  getEventsPaginatedMock,
  createEventMock,
  addEventAttachmentMock,
  updateEventMock,
  deleteEventMock,
  getEventParticipantsMock,
  addEventParticipantMock,
  updateEventParticipantMock,
  removeEventParticipantMock,
  getEventAttachmentsMock,
  deleteEventAttachmentMock,
  deleteEventAttachmentsByEventIdMock,
  s3SendMock,
} = vi.hoisted(() => ({
  getEventsMock: vi.fn(),
  getEventsPaginatedMock: vi.fn(),
  createEventMock: vi.fn(),
  addEventAttachmentMock: vi.fn(),
  updateEventMock: vi.fn(),
  deleteEventMock: vi.fn(),
  getEventParticipantsMock: vi.fn(),
  addEventParticipantMock: vi.fn(),
  updateEventParticipantMock: vi.fn(),
  removeEventParticipantMock: vi.fn(),
  getEventAttachmentsMock: vi.fn(),
  deleteEventAttachmentMock: vi.fn(),
  deleteEventAttachmentsByEventIdMock: vi.fn(),
  s3SendMock: vi.fn(),
}));
```

No `vi.mock("../../storage", ...)`, adicione `getEventsPaginated: getEventsPaginatedMock` ao objeto `storage`. No `beforeEach`, adicione `getEventsPaginatedMock.mockReset();`.

Depois do teste `"keeps GET /events with user filtering from jwt"` (linha 79-87), adicione:

```ts
  it("returns plain array when mode is not provided (backward compat)", async () => {
    getEventsMock.mockResolvedValue([{ id: "event-1" }]);
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events");

    expect(getEventsPaginatedMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "event-1" }]);
  });

  it("uses getEventsPaginated with decoded cursor/limit when mode=upcoming", async () => {
    getEventsPaginatedMock.mockResolvedValue({
      events: [{ id: "event-1" }],
      nextCursor: "next-cursor-token",
    });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get(
      "/events?mode=upcoming&limit=9",
    );

    expect(getEventsPaginatedMock).toHaveBeenCalledWith({
      userId: "test-user-id",
      userRole: "admin",
      mode: "upcoming",
      cursor: null,
      limit: 9,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      events: [{ id: "event-1" }],
      nextCursor: "next-cursor-token",
    });
  });

  it("uses getEventsPaginated with mode=past and defaults limit to 9", async () => {
    getEventsPaginatedMock.mockResolvedValue({ events: [], nextCursor: null });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get("/events?mode=past");

    expect(getEventsPaginatedMock).toHaveBeenCalledWith({
      userId: "test-user-id",
      userRole: "admin",
      mode: "past",
      cursor: null,
      limit: 9,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ events: [], nextCursor: null });
  });

  it("treats an invalid cursor as no cursor instead of failing", async () => {
    getEventsPaginatedMock.mockResolvedValue({ events: [], nextCursor: null });
    const app = createRouteTestApp({ router: eventsRouter, basePath: "/events" });

    const response = await request(app).get(
      "/events?mode=upcoming&cursor=not-a-valid-cursor",
    );

    expect(getEventsPaginatedMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: null }),
    );
    expect(response.status).toBe(200);
  });
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

```bash
npx vitest run --project unit server/routes/__tests__/events.routes.test.ts
```

Expected: FAIL nos 4 testes novos — `getEventsPaginatedMock` não existe na rota ainda / rota sempre chama `getEvents`.

- [ ] **Step 3: Implementar a branch de `mode` na rota**

Em `server/routes/events.routes.ts`, adicione o import no topo (junto aos outros imports, logo abaixo de `import { storage } from "../storage";`):

```ts
import { decodeCursor, clampLimit } from "../lib/cursor-pagination";
```

Substitua o handler em `server/routes/events.routes.ts:72-83`:

```ts
eventsRouter.get("/", async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const mode = req.query.mode;

    if (mode === "upcoming" || mode === "past") {
      const cursor = decodeCursor(req.query.cursor);
      const limit = clampLimit(req.query.limit, { fallback: 9, max: 50 });
      const result = await storage.getEventsPaginated({
        userId,
        userRole,
        mode,
        cursor,
        limit,
      });
      return res.json(result);
    }

    const events = await storage.getEvents(userId, userRole);
    return res.json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    return res.status(500).json({ message: "Erro ao buscar eventos" });
  }
});
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

```bash
npx vitest run --project unit server/routes/__tests__/events.routes.test.ts
```

Expected: PASS em todos os testes do arquivo (os 5 antigos + os 4 novos).

- [ ] **Step 5: Commit**

```bash
git add server/routes/events.routes.ts server/routes/__tests__/events.routes.test.ts
git commit -m "feat: GET /api/events aceita mode/cursor/limit para paginação por cursor"
```

---

## Task 3: Frontend — sub-abas Próximos/Passados em `events-dashboard.tsx`

**Files:**
- Modify: `client/src/components/events-dashboard.tsx`

**Interfaces:**
- Consumes: `GET /api/events?mode=upcoming|past&cursor=&limit=9` da Task 2, resposta `{ events: Event[], nextCursor: string | null }`.
- Produces: `EventsDashboard` sem props (interface `EventsDashboardProps` fica vazia/removida) — consumido pela Task 4.

Este componente é renderização de UI sem lógica pura extraível (busca + grid), e o projeto pula verificação visual em browser para mudanças de UI — a validação aqui é por leitura de código + `npm run check` (Step 5), não há teste automatizado de componente React no projeto para este tipo de tela.

- [ ] **Step 1: Trocar a busca de eventos por duas `useInfiniteQuery` (uma por sub-aba)**

Em `client/src/components/events-dashboard.tsx`, troque o import do topo (linha 1):

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
```

Adicione o import das sub-abas (junto aos demais imports de `@/components/ui/*`):

```ts
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { UnderlineTabsList, UnderlineTabsTrigger } from "@/components/app-tabs";
import { Loader2 } from "lucide-react";
```

(O ícone `Loader2` deve ser adicionado ao bloco de import existente de `lucide-react`, linhas 19-26, não como um import separado.)

Substitua a interface de props e o hook de busca (linhas 79-91):

```ts
type EventsMode = "upcoming" | "past";

interface EventsPage {
  events: Event[];
  nextCursor: string | null;
}

async function fetchEventsPage(
  mode: EventsMode,
  cursor: string | null,
): Promise<EventsPage> {
  const params = new URLSearchParams({ mode });
  if (cursor) params.set("cursor", cursor);
  const res = await fetch(`/api/events?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error(`Erro ao buscar eventos: ${res.status}`);
  return res.json();
}

export default function EventsDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeMode, setActiveMode] = useState<EventsMode>("upcoming");
```

Adicione o import de `useState` no topo do arquivo (junto ao import de `react`, ou crie a linha `import { useState } from "react";` logo antes do import de `useAuth` se não existir ainda).

Logo abaixo (onde estava `const { data: events = [], isLoading } = useQuery...`), adicione as duas queries paginadas:

```ts
  const upcomingQuery = useInfiniteQuery({
    queryKey: ["/api/events", "upcoming"],
    queryFn: ({ pageParam }) => fetchEventsPage("upcoming", pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const pastQuery = useInfiniteQuery({
    queryKey: ["/api/events", "past"],
    queryFn: ({ pageParam }) => fetchEventsPage("past", pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const activeQuery = activeMode === "upcoming" ? upcomingQuery : pastQuery;
  const displayedEvents: Event[] =
    activeQuery.data?.pages.flatMap((p) => p.events) ?? [];

  useEffect(() => {
    if (upcomingQuery.isError) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar mais eventos futuros",
        variant: "destructive",
      });
    }
  }, [upcomingQuery.isError, toast]);

  useEffect(() => {
    if (pastQuery.isError) {
      toast({
        title: "Erro",
        description: "Não foi possível carregar mais eventos passados",
        variant: "destructive",
      });
    }
  }, [pastQuery.isError, toast]);
```

Remova o parâmetro `{ startDate, endDate, datePreset }: EventsDashboardProps = {}` da assinatura da função (já reescrito acima) e remova a interface `EventsDashboardProps` (linhas 79-83) por completo — a aba não recebe mais props de período.

Adicione `useEffect` ao import de `react` (junto ao `useState` inserido acima): `import { useState, useEffect } from "react";`.

- [ ] **Step 2: Remover a filtragem client-side por período (`upcomingEvents`) e os textos derivados de `datePreset`**

Remova o bloco `const upcomingEvents = events.filter(...).sort(...).slice(0, 50);` (linhas 864-885 do arquivo original) e o bloco `cardTitle`/`cardDescription` baseado em `datePreset` (linhas 887-907). Serão substituídos por títulos fixos por sub-aba no Step 4.

- [ ] **Step 3: Corrigir a cor da faixa lateral para eventos passados**

Dentro do `.map((event) => {...})` que renderiza cada card, localize o bloco:

```tsx
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                        isToday
                          ? "bg-red-500"
                          : isTomorrow
                            ? "bg-orange-400"
                            : daysUntil <= 7
                              ? "bg-yellow-400"
                              : "bg-purple-400"
                      }`}
                    />
```

Substitua por (adiciona o caso `daysUntil < 0` antes do fallback amarelo, que hoje captura indevidamente todo evento passado):

```tsx
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                        daysUntil < 0
                          ? "bg-gray-300 dark:bg-slate-700"
                          : isToday
                            ? "bg-red-500"
                            : isTomorrow
                              ? "bg-orange-400"
                              : daysUntil <= 7
                                ? "bg-yellow-400"
                                : "bg-purple-400"
                      }`}
                    />
```

- [ ] **Step 4: Envolver o conteúdo em sub-abas Próximos/Passados com botão "Carregar mais"**

Substitua o `return (...)` final do componente (a partir de `if (isLoading) { return <div>Carregando eventos...</div>; }` até o fechamento do componente) por:

```tsx
  if (upcomingQuery.isLoading && activeMode === "upcoming") {
    return <div>Carregando eventos...</div>;
  }
  if (pastQuery.isLoading && activeMode === "past") {
    return <div>Carregando eventos...</div>;
  }

  const emptyMessage =
    activeMode === "upcoming"
      ? "Nenhum evento futuro encontrado"
      : "Nenhum evento passado encontrado";

  const cardTitle = activeMode === "upcoming" ? "Próximos Eventos" : "Eventos Passados";
  const cardDescription =
    activeMode === "upcoming"
      ? "Eventos planejados e ativos que ainda vão acontecer"
      : "Eventos que já aconteceram";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
      <Card className="shadow-none border-0 bg-transparent">
        <CardHeader className="pb-6 px-6 pt-6">
          <CardTitle className="flex items-center gap-3 text-xl font-semibold text-gray-900 dark:text-slate-100">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
              <CalendarIcon className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0" />
            </div>
            <span className="truncate">{cardTitle}</span>
          </CardTitle>
          <CardDescription className="text-sm text-gray-600 dark:text-slate-400 mt-2">
            {cardDescription}
          </CardDescription>
          <Tabs
            value={activeMode}
            onValueChange={(v) => setActiveMode(v as EventsMode)}
            className="mt-4"
          >
            <UnderlineTabsList>
              <UnderlineTabsTrigger value="upcoming" color="purple">
                Próximos
              </UnderlineTabsTrigger>
              <UnderlineTabsTrigger value="past" color="purple">
                Passados
              </UnderlineTabsTrigger>
            </UnderlineTabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {displayedEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-purple-50 dark:bg-purple-900/30 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <CalendarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                {emptyMessage}
              </h3>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {displayedEvents.map((event) => {
                  const daysUntil = getDaysUntilEvent(event.eventDate);
                  const isToday = daysUntil === 0;
                  const isTomorrow = daysUntil === 1;

                  return (
                    <div
                      key={event.id}
                      className="group relative bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-md overflow-hidden hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-200 ease-in-out"
                    >
                      {/* Indicador de urgência lateral */}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                          daysUntil < 0
                            ? "bg-gray-300 dark:bg-slate-700"
                            : isToday
                              ? "bg-red-500"
                              : isTomorrow
                                ? "bg-orange-400"
                                : daysUntil <= 7
                                  ? "bg-yellow-400"
                                  : "bg-purple-400"
                        }`}
                      />

                      {/* Imagem de Capa com efeito esmaecido */}
                      {event.imageUrl && (
                        <div className="relative w-full h-48 overflow-hidden">
                          <img
                            src={event.imageUrl}
                            alt={event.name}
                            className="w-full h-full object-cover"
                          />
                          {/* Gradiente esmaecido suave para transição */}
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-40% via-white/30 dark:via-slate-900/30 via-70% to-white dark:to-slate-900" />
                        </div>
                      )}

                      {/* Header do Card */}
                      <div
                        className={`p-6 pl-8 ${
                          event.imageUrl ? "-mt-6 relative z-10" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-slate-100 mb-3 overflow-hidden text-ellipsis">
                              {event.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 mb-4">
                              <Badge
                                className={`${
                                  EVENT_STATUS.find(
                                    (s) => s.value === event.status,
                                  )?.color
                                } border-0 font-medium px-3 py-1 text-xs`}
                              >
                                {
                                  EVENT_STATUS.find(
                                    (s) => s.value === event.status,
                                  )?.label
                                }
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs font-medium px-2 py-1 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700"
                              >
                                {event.category}
                              </Badge>
                            </div>
                          </div>
                        </div>

                        {/* Informações principais com ícones semânticos */}
                        <div className="space-y-3 mb-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${
                                isToday
                                  ? "bg-red-50"
                                  : isTomorrow
                                    ? "bg-orange-50"
                                    : "bg-blue-50"
                              }`}
                            >
                              <CalendarIcon
                                className={`h-4 w-4 ${
                                  isToday
                                    ? "text-red-600"
                                    : isTomorrow
                                      ? "text-orange-600"
                                      : "text-blue-600"
                                }`}
                              />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-slate-100">
                                {formatEventDateTime(event.eventDate)}
                              </div>
                              <div className="text-sm">
                                {isToday && (
                                  <span className="text-red-600 dark:text-red-400 font-bold">
                                    🔴 Hoje!
                                  </span>
                                )}
                                {isTomorrow && (
                                  <span className="text-orange-600 dark:text-orange-400 font-bold">
                                    🟠 Amanhã
                                  </span>
                                )}
                                {!isToday && !isTomorrow && daysUntil > 0 && (
                                  <span className="text-blue-600 dark:text-blue-400">
                                    📅 Em {daysUntil} dias
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg">
                              <MapPinIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
                                {event.location}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                              <UsersIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {event.participantCount} participante(s)
                                {event.maxCapacity && ` / ${event.maxCapacity}`}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg">
                              <ClockIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                                {formatCurrency(parseFloat(event.pricePerPerson))}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Imagens do evento */}
                        {event.attachments && event.attachments.length > 0 && (
                          <div className="mb-5">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                                <ImageIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                              </div>
                              <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                                {event.attachments.length} imagem
                                {event.attachments.length !== 1 ? "s" : ""} do
                                evento
                              </span>
                            </div>

                            {/* Carousel de imagens */}
                            <div className="relative">
                              <Carousel
                                opts={{
                                  align: "start",
                                  loop: true,
                                }}
                                className="w-full"
                              >
                                <CarouselContent className="-ml-2 md:-ml-4">
                                  {event.attachments.map((attachment, index) => (
                                    <CarouselItem
                                      key={index}
                                      className="pl-2 md:pl-4 basis-full"
                                    >
                                      <div className="relative group aspect-video bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg overflow-hidden border border-purple-200 hover:border-purple-300 transition-all shadow-sm hover:shadow-md">
                                        <img
                                          src={`${baseS3Url}${attachment.fileUrl}`}
                                          alt={attachment.fileName}
                                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                          onError={(e) => {
                                            const target =
                                              e.target as HTMLImageElement;
                                            target.style.display = "none";
                                            target.nextElementSibling?.classList.remove(
                                              "hidden",
                                            );
                                          }}
                                        />
                                        <div className="hidden absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100">
                                          <div className="flex items-center justify-center h-full">
                                            <div className="text-center text-purple-600">
                                              <ImageIcon className="h-8 w-8 mx-auto mb-2" />
                                              <span className="text-sm font-medium break-words px-2">
                                                {attachment.fileName}
                                              </span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* Overlay sutil com informações */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                                          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                                            <div className="text-white text-xs font-medium truncate flex-1">
                                              {attachment.fileName}
                                            </div>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDownloadImage(
                                                  attachment.fileUrl,
                                                  attachment.fileName,
                                                );
                                              }}
                                              data-testid={`button-download-image-${index}`}
                                              className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-purple-600 hover:text-purple-700 rounded-full ml-2 flex-shrink-0"
                                              title="Baixar imagem"
                                            >
                                              <DownloadIcon className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>

                                        {/* Indicador de posição */}
                                        {event.attachments &&
                                          event.attachments.length > 1 && (
                                            <div className="absolute top-3 right-3">
                                              <div className="bg-black/70 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
                                                {index + 1}/
                                                {event.attachments.length}
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>

                                {/* Botões de navegação - só aparecem se houver mais de 1 imagem */}
                                {event.attachments.length > 1 && (
                                  <>
                                    <CarouselPrevious className="absolute -left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/90 hover:bg-white border-purple-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 shadow-lg" />
                                    <CarouselNext className="absolute -right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-white/90 hover:bg-white border-purple-200 hover:border-purple-300 text-purple-600 hover:text-purple-700 shadow-lg" />
                                  </>
                                )}
                              </Carousel>

                              {/* Indicadores de pontos para navegação */}
                              {event.attachments.length > 1 &&
                                event.attachments.length <= 5 && (
                                  <div className="flex justify-center mt-3 gap-2">
                                    {event.attachments.map((_, index) => (
                                      <div
                                        key={index}
                                        className="w-2 h-2 rounded-full bg-purple-200 hover:bg-purple-400 transition-colors cursor-pointer"
                                        title={`Imagem ${index + 1}`}
                                      />
                                    ))}
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {/* Descrição */}
                        {event.description && (
                          <div className="mb-4">
                            <div
                              className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed overflow-hidden text-ellipsis rich-text-content"
                              dangerouslySetInnerHTML={{
                                __html: event.description,
                              }}
                            />
                          </div>
                        )}

                        {/* Deadline de inscrição */}
                        {event.registrationDeadline && (
                          <div className="mb-4">
                            <div className="text-xs bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300 p-3 rounded-lg border-l-4 border-orange-400 dark:border-orange-500">
                              <div className="font-semibold">
                                ⏰ Prazo de inscrição
                              </div>
                              <div className="mt-1">
                                {formatEventDateTime(event.registrationDeadline)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Botão de ação */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePrintParticipants(event)}
                            data-testid="button-print-participants"
                            className="w-full hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:border-purple-200 dark:hover:border-purple-700 hover:text-purple-700 dark:hover:text-purple-300 transition-colors font-medium"
                          >
                            <CalendarIcon className="h-4 w-4 mr-2" />
                            Ver Detalhes do Evento
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {activeQuery.hasNextPage && (
                <div className="flex justify-center mt-6">
                  <Button
                    variant="outline"
                    onClick={() => activeQuery.fetchNextPage()}
                    disabled={activeQuery.isFetchingNextPage}
                    data-testid="button-load-more-events"
                  >
                    {activeQuery.isFetchingNextPage && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Carregar mais
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

> **Nota para quem implementar:** o comentário `/* MANTER o JSX do card... */` acima é uma instrução de edição, não código a copiar literalmente — mova o `<div key={event.id} className="group relative ...">...</div>` completo que já existe hoje no arquivo (com a faixa lateral já corrigida no Step 3) para dentro desse `.map`. Nenhum outro trecho do card (imagem, badges, informações, carousel de anexos, descrição, deadline, botão "Ver Detalhes do Evento") muda.

- [ ] **Step 5: Type-check isolado**

```jsonc
// tsconfig.tmp.json — apagar depois
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/components/events-dashboard.tsx"],
  "exclude": ["node_modules"]
}
```

```bash
npx tsc -p tsconfig.tmp.json
```

Expected: nenhum erro novo introduzido pelo componente (props removidas, hooks trocados, JSX ajustado). Apague `tsconfig.tmp.json` ao final.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/events-dashboard.tsx
git commit -m "feat: sub-abas Próximos/Passados com cursor pagination na aba Eventos"
```

---

## Task 4: Atualizar o call site em `dashboard.tsx` e validar o fluxo completo

**Files:**
- Modify: `client/src/pages/dashboard.tsx:446`

**Interfaces:**
- Consumes: `EventsDashboard` sem props, produzido na Task 3.

- [ ] **Step 1: Remover as props passadas para `EventsDashboard`**

Em `client/src/pages/dashboard.tsx:446`, troque:

```tsx
          <EventsDashboard startDate={startDate} endDate={endDate} datePreset={datePreset} />
```

por:

```tsx
          <EventsDashboard />
```

- [ ] **Step 2: Confirmar que `startDate`/`endDate`/`datePreset` ainda são usados por outras abas do dashboard**

```bash
grep -n "startDate\|endDate\|datePreset" client/src/pages/dashboard.tsx
```

Expected: ainda aparecem em outros pontos do arquivo (ex.: `DashboardStatsCards`, `DashboardDebtsTab`) — essas variáveis continuam declaradas e usadas por outras abas, só não são mais passadas para `EventsDashboard`. Se `datePreset` ficar sem nenhum outro uso, não remova a declaração (está fora do escopo desta mudança; outras abas dependem dela).

- [ ] **Step 3: Type-check isolado**

```jsonc
// tsconfig.tmp.json — apagar depois
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "incremental": false, "tsBuildInfoFile": null },
  "include": ["server/types/express.d.ts", "client/src/pages/dashboard.tsx", "client/src/components/events-dashboard.tsx"],
  "exclude": ["node_modules"]
}
```

```bash
npx tsc -p tsconfig.tmp.json
```

Expected: sem erros novos. Apague `tsconfig.tmp.json` ao final.

- [ ] **Step 4: Rodar a suíte de testes de rota completa (regressão)**

```bash
npx vitest run --project unit server/routes/__tests__/events.routes.test.ts
```

Expected: todos os testes (originais + novos da Task 2) em PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/dashboard.tsx
git commit -m "refactor: remove props de período não usadas mais por EventsDashboard"
```

---

## Fora de escopo (confirmado no spec)

- Otimizar o N+1 de `getEventAttachments` por evento.
- Alterar `getEvents` ou os 3 consumidores que dependem da lista completa sem paginação.
- Infinite scroll automático (decisão explícita do usuário por botão "Carregar mais").
- Alterar o cron `update-expired-events-scheduler.ts`.
