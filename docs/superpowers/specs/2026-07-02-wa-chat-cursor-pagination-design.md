# Cursor pagination — mensagens do chat e lista de conversas (WhatsApp)

## Contexto

Hoje a página de conversas do WhatsApp ([conversations.tsx](../../../client/src/pages/whatsapp/conversations.tsx)) carrega **até 100 registros de uma vez**, sem paginação, em dois pontos:

- `listClientsForChat` ([whatsapp-conversations.service.ts:231](../../../server/services/whatsapp-conversations.service.ts:231)) — lista de conversas no sidebar, ordenada por `lastMessageAt DESC NULLS LAST`, `.limit(100)`.
- `getConversation` ([whatsapp-conversations.service.ts:437](../../../server/services/whatsapp-conversations.service.ts:437)) — mensagens de uma conversa, ordenadas por `COALESCE(sentAt, createdAt) DESC`, `.limit(100)`, revertidas para ordem cronológica antes de retornar.

Isso não escala: clientes com histórico longo ou contas com muitas conversas simplesmente não veem nada além dos 100 registros mais recentes. O objetivo deste trabalho é substituir os dois `.limit(100)` por paginação real via cursor, carregada sob demanda ao rolar a lista, mantendo as mensagens sempre ordenadas da mais recente para a mais antiga (mais antiga no topo, mais recente embaixo) como já é hoje.

## Decisões já validadas com o usuário

- Ambas as listas usam **infinite scroll automático** (não botão "carregar mais").
- Tamanho de página: **20 itens** tanto para mensagens quanto para conversas.
- O polling periódico existente (30s em mensagens, 15s na lista) é **mantido, mas restrito a atualizar só a primeira página** (os itens mais recentes) — não deve re-buscar páginas antigas já carregadas pelo scroll.

## Por que cursor composto `(timestamp, id)`

IDs em `whatsapp_messages` e `whatsapp_conversations` são UUIDs (`gen_random_uuid()`), não sequenciais — não servem como cursor isolado. Três abordagens consideradas:

1. **Offset (`LIMIT/OFFSET`)** — descartado: com inserções constantes (mensagens chegando em tempo real), o offset desliza e itens duplicam ou somem entre páginas.
2. **Cursor só por timestamp** (`WHERE at < cursor`) — descartado: duas linhas podem ter o mesmo timestamp exato (sincronizações em lote do Umbler), causando pulos/duplicatas na borda da página.
3. **Cursor composto `(timestamp, id)` com comparação de tupla (escolhido)** — cada página termina num cursor opaco; a próxima busca `(at, id) < (cursor.at, cursor.id)` via comparação de tupla nativa do Postgres, resolvendo empates de forma determinística.

## Backend

### Formato do cursor

Cursor opaco, string base64 de um JSON:

```ts
interface Cursor {
  at: string | null; // ISO timestamp; null só ocorre na lista de conversas (ver abaixo)
  id: string;
}
```

Helpers `encodeCursor(cursor)` / `decodeCursor(raw)` em `server/lib/cursor-pagination.ts` (novo arquivo, reutilizado pelos dois endpoints). Cursor inválido/malformado no request é tratado como "sem cursor" (primeira página) — não deve gerar 500.

### Mensagens — `GET /api/whatsapp/conversations/:clientId`

- Novo query param opcional `cursor`. `limit` é fixo em 20 no servidor (não é lido do cliente, evita abuso).
- Query em `getConversation`: quando há cursor, adiciona `sql`(${effectiveAt}, ${whatsappMessages.id}) < (${cursor.at}, ${cursor.id})``` à cláusula `WHERE`, mantendo `ORDER BY effectiveAt DESC, id DESC LIMIT 21` (busca 1 a mais para saber se há próxima página).
- Se vieram 21 linhas: `hasMore = true`, descarta a 21ª; `nextCursor` = `(at, id)` da 20ª linha (a mais antiga do lote, antes de reverter a ordem).
- Reverte as 20 linhas para ordem cronológica (mais antiga → mais nova) como já faz hoje, monta reações/mídia normalmente.
- Resposta: `{ conversation, messages, nextCursor: string | null }`.
- Sem cursor (primeira chamada) = comportamento atual, só que agora com `nextCursor` no payload.

### Lista de conversas — `GET /api/whatsapp/conversations`

- Mesmo mecanismo de cursor, mas a ordenação (`lastMsgSub.lastAt DESC NULLS LAST, id DESC`) tem uma peculiaridade: conversas sem nenhuma mensagem (`lastAt IS NULL`) formam um bucket à parte, sempre no fim. A condição de paginação passa a ter dois ramos:
  - Se `cursor.at != null` (ainda estamos no bucket "com mensagens"): `WHERE (lastAt IS NOT NULL AND (lastAt, id) < (cursor.at, cursor.id)) OR lastAt IS NULL` — continua no bucket não-nulo e já inclui o bucket nulo inteiro a seguir.
  - Se `cursor.at == null` (já estamos no bucket "sem mensagens"): `WHERE lastAt IS NULL AND id < cursor.id`.
- Filtros existentes (`search`, `tagIds`, escopo por `userRole`) continuam aplicados normalmente, combinados via `AND` com a condição de cursor.
- Resposta: `{ items: ChatClient[], nextCursor: string | null }`.

### Compatibilidade — botão flutuante de badge

[whatsapp-floating-button.tsx:24](../../../client/src/components/whatsapp-floating-button.tsx:24) chama o mesmo endpoint de lista só para somar `unreadCount` — não precisa de paginação. Ele passa a chamar explicitamente `?limit=100` sem cursor (replicando o limite atual) e lê `.items` da resposta (antes lia o array direto). Único ponto de ajuste fora dos dois fluxos principais.

## Frontend

### Mensagens (`ConversationMessages`)

- Troca o `useQuery` atual ([conversations.tsx:2725](../../../client/src/pages/whatsapp/conversations.tsx:2725)) por `useInfiniteQuery`:
  - `queryKey: ["/api/whatsapp/conversations", conversationKey]` (mantido, evita quebrar as invalidações já espalhadas pelo arquivo).
  - `initialPageParam: null`, `getNextPageParam: (last) => last.nextCursor`.
  - `select`: reverte a ordem das páginas (`{ pages: [...data.pages].reverse(), pageParams: [...data.pageParams].reverse() }`) — cada página já vem em ordem cronológica internamente, mas a página 0 (mais recente) precisa aparecer **por último** na tela.
- **Scroll infinito para cima:** sentinela (`<div ref={topSentinelRef} />`) no topo da lista de mensagens, observado via `IntersectionObserver`. Ao ficar visível com `hasNextPage && !isFetchingNextPage`, chama `fetchNextPage()`.
- **Preservação de posição ao carregar mensagens antigas:** antes do fetch, guarda `container.scrollHeight`; após o React re-renderizar (via `useLayoutEffect` disparado pela chegada da nova página), soma a diferença de `scrollHeight` ao `scrollTop` do container — evita o salto visual de conteúdo inserido acima da área visível.
- **Scroll para o fim:** mantém o comportamento já implementado (instantâneo na abertura da conversa, suave para mensagens novas) — a lógica existente baseada em `messages.length`/`localMessages.length` passa a considerar `flatMessages.length` (soma de todas as páginas) e precisa distinguir "cresceu porque carregou página antiga" (não rola) de "cresceu porque chegou mensagem nova no fim" (rola suave). Distinção: comparar o `id` da primeira mensagem antes/depois do update — se mudou, foi um prepend (não rola); se só o último mudou, foi um append (rola).

### Lista de conversas (sidebar)

- Mesmo padrão com `useInfiniteQuery` no lugar do `useQuery` atual ([conversations.tsx:4519](../../../client/src/pages/whatsapp/conversations.tsx:4519)), sem precisar reverter páginas (a mais recente já fica no topo, a lista cresce para baixo).
- Sentinela no fim da lista (após o último `ClientListItem`) dispara `fetchNextPage()` via `IntersectionObserver`.
- Mudança de `debouncedSearch`/`selectedTagIds` (já hoje faz parte da `queryKey`) reinicia a paginação naturalmente — o React Query trata como uma query nova.

### Tempo real (SSE) e polling — atualiza só a primeira página

Hoje: mensagens fazem polling a cada 30s ([conversations.tsx:2733](../../../client/src/pages/whatsapp/conversations.tsx:2733)) e a lista a cada 15s ([conversations.tsx:4533](../../../client/src/pages/whatsapp/conversations.tsx:4533)), além de invalidação via SSE (`new_message` por conversa, `new_whatsapp_inbound` global). Um `invalidateQueries` comum numa infinite query re-busca **todas** as páginas já carregadas, em sequência — funciona, mas fica caro se o usuário rolou muitas páginas para trás.

Mecanismo escolhido: uma função `refreshFirstPage(queryClient, queryKey)` que:
1. Faz um `fetch` direto (sem passar pelo cache de página) do endpoint sem cursor (equivalente à página 0/mais recente).
2. Faz merge do resultado em `data.pages[0]` via `queryClient.setQueryData(queryKey, (old) => old ? { ...old, pages: [novaPagina0, ...old.pages.slice(1)] } : old)`, sem tocar nas páginas 1+ já carregadas.

Usada tanto pelo timer periódico (30s/15s) quanto pelos handlers de SSE existentes, substituindo os atuais `invalidateQueries` nesses dois fluxos. `fetchNextPage()` continua sendo o único caminho que busca páginas mais profundas (acionado só por scroll do usuário).

## Erros e casos de borda

- Cursor inválido/malformado (ex.: `JSON.parse` falha, conversa foi excluída entre requests) → backend trata como "sem cursor", retorna a primeira página normalmente. Nunca 500 por cursor ruim.
- `fetchNextPage()` falha → TanStack Query expõe `isFetchNextPageError`; mostra um aviso discreto no topo (mensagens) ou no fim (sidebar) da lista com opção de tentar novamente, sem travar a lista já carregada.
- Conversa nova sem nenhuma mensagem ainda (fluxo "Nova conversa") → primeira página de mensagens vem vazia, `nextCursor: null`, exibe o estado vazio já existente ("Nenhuma mensagem ainda").
- Conversas sem `lastMessageAt` (bucket nulo) — cobertas pela lógica de dois ramos descrita acima; sempre aparecem por último na lista, mesmo em páginas seguintes.

## Fora de escopo

- Não altera o formato de `WaMessage`/`ChatClient` além de envolver a lista em `{ items/messages, nextCursor }`.
- Não implementa cache/pré-fetch de páginas adjacentes (ex.: prefetch da próxima página antes do usuário chegar ao fim) — pode ser otimização futura.
- Não altera o comportamento de busca por telefone via `?phone=` (deep-link) nem a lógica de seleção de conversa corrigida anteriormente.
