# Envio de pedido de venda ao Bling no fechamento da comanda

## Contexto

Hoje o PDV Restaurante fecha uma comanda (`restaurantPdvService.closeOrder`) e não avisa o
Bling de nada — a venda fica só no CRM. O pedido é: quando a comanda fecha e o pagamento é
registrado, criar automaticamente um pedido de venda na conta Bling vinculada à unidade
(`pdv_units.bling_connection_id`, snapshotado em `restaurant_orders.bling_connection_id` na
abertura — ver [pdv-units.controller.ts](server/controllers/restaurant-pdv/pdv-units.controller.ts)
e a explicação já dada nesta sessão sobre o vínculo unidade↔conta Bling).

A função que faz a chamada `POST /pedidos/vendas` já existe e nunca foi usada:
`createBlingPedidoVenda` em [bling.ts:303](server/integrations/bling.ts:303), com toda a
tipagem do payload (`BlingPedidoVendaPayload`) pronta. O trabalho aqui é montar esse payload a
partir dos dados da comanda e plugar a chamada no lugar certo — não criar a integração do zero.

Decisão de produto confirmada com o usuário: **o fechamento da comanda nunca é bloqueado por
causa do Bling.** O garçom fecha, o cliente paga, e o envio ao Bling acontece à parte, em segundo
plano. Se faltar algum vínculo (produto ou cliente sem correspondência no Bling), a comanda fica
sinalizada como divergente para um admin resolver depois — o atendimento nunca espera por isso.

## Modelo de dados

### `pdv_units` — novo campo

```sql
ALTER TABLE pdv_units ADD COLUMN IF NOT EXISTS default_client_id varchar REFERENCES clients(id);
```

O "Consumidor Final" da unidade — usado quando a comanda fecha sem cliente vinculado. Configurado
no mesmo modal de "Editar Unidade" onde já está o seletor de Catálogo Bling
([settings.tsx](client/src/pages/restaurant-pdv/settings.tsx)): um novo campo "Cliente Consumidor
Final", combobox de busca de cliente (reaproveitar o padrão de busca já usado em
`search-clients.controller.ts` / `LinkClientDialog`, não criar um novo).

### `restaurant_orders` — novos campos

```sql
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_status text
  CHECK (bling_sync_status IN ('pendente','enviado','bloqueado','erro'));
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sales_order_id text;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_error text;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bling_sync_attempted_at timestamp;
```

`bling_sync_status` fica `NULL` enquanto a comanda está aberta (não se aplica ainda) e vira
`'pendente'` no momento do fechamento (`closeOrder`). É estado atual — o histórico de tentativas
vive na tabela de auditoria abaixo, mesmo padrão já usado no projeto
(`restaurant_orders.status` = estado atual, `restaurant_order_audit_log` = histórico).

### `restaurant_order_bling_sync_log` — nova tabela (auditoria, append-only)

```sql
CREATE TABLE IF NOT EXISTS restaurant_order_bling_sync_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id varchar NOT NULL REFERENCES restaurant_orders(id),
  unit_id varchar REFERENCES pdv_units(id),
  attempted_at timestamp NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('enviado','bloqueado','erro')),
  reason text,
  bling_sales_order_id text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_order_idx
  ON restaurant_order_bling_sync_log (order_id);
CREATE INDEX IF NOT EXISTS restaurant_order_bling_sync_log_unit_idx
  ON restaurant_order_bling_sync_log (unit_id, result);
```

Tabela **separada** de `restaurant_order_audit_log` — essa exige `actor_id NOT NULL` (FK para
`users`), pensada para ações humanas na comanda. Uma tentativa do cron não tem um usuário por
trás; forçar um "usuário sistema" ali distorceria uma tabela já estável e usada em produção.
`unit_id` fica denormalizado aqui de propósito, para o painel admin filtrar sem precisar de join
até `restaurant_orders`.

Ambas as migrações seguem o padrão do projeto: script `.mjs` com SQL direto (nunca
`db:push`), replicando `shared/schema.ts` manualmente. Dois scripts novos:
`scripts/add-pdv-units-default-client.mjs` e `scripts/add-bling-sales-order-sync.mjs`.

## Resolução de itens e contato

Novo `server/services/bling-sales-order.service.ts`. O núcleo é uma função pura (testável sem
banco, seguindo o padrão de `buildSellerQueues` citado no `CLAUDE.md`):

```ts
function resolveBlingSalesOrderPayload(input: {
  order: RestaurantOrder;
  items: RestaurantOrderItem[];
  blingProductIdByProductId: Map<string, string>;   // pré-carregado de bling_product_mappings
  contactBlingId: string | null;                     // já resolvido (ver abaixo)
}): { ok: true; payload: BlingPedidoVendaPayload } | { ok: false; reason: string }
```

O caller (`sendOrderToBling(orderId)`, com acesso a banco) monta os dois mapas antes de chamar a
função pura:

- **Itens:** para cada `restaurant_order_items` ativo da comanda, busca em `bling_product_mappings`
  a linha com `connection_id = order.bling_connection_id AND product_id = item.product_id`. O
  valor enviado ao Bling (`itens[].produto.id`) é o campo **`bling_product_mappings.bling_product_id`**
  (texto no banco, convertido para `number`) — não confundir com `product_id`, que é o id do
  produto no CRM. Item sem `product_id` (avulso) ou sem linha de mapeamento → `ok: false` com a
  lista de nomes dos itens problemáticos em `reason`.
- **Contato:** se `order.client_id` existe, busca `bling_contact_mappings` por
  `(connection_id, client_id = order.client_id)` → usa `bling_contact_id`. Sem `client_id` na
  comanda, ou sem mapeamento para esse cliente, cai para `pdv_units.default_client_id` da unidade
  e resolve o mapeamento dele do mesmo jeito. Sem nenhum dos dois → `ok: false`
  ("Nenhum contato Bling resolvido — vincule um cliente à comanda ou configure o Consumidor Final
  da unidade").
- **Datas/loja/vendedor:** `data`/`dataSaida`/`dataPrevista` = data do fechamento
  (`order.closedAt`). `loja` omitido (usa a loja padrão da conta Bling). `vendedor` incluído só se
  existir mapeamento do garçom em `bling_seller_mappings`; senão omitido (campo opcional, não
  bloqueia).
- **Parcela:** uma única parcela com `valor = order.total` e `dataVencimento = order.closedAt`.
  `formaPagamento.id` fica de fora — não existe hoje mapeamento "pix/cartão/dinheiro → id da forma
  de pagamento" por conta Bling (cada empresa cadastra o próprio catálogo); registrado como
  fora de escopo abaixo.

`resolveBlingSalesOrderPayload` nunca lança exceção por dado incompleto — sempre retorna
`{ ok: false, reason }`, que vira `bling_sync_status = 'bloqueado'`. Exceções reais (rede, Bling
fora do ar, erro inesperado) são tratadas separadamente pelo caller como `'erro'`.

## Orquestração — tentativa imediata + cron de retry

- **Tentativa imediata:** em `restaurantPdvService.closeOrder`, depois que a transação de
  fechamento commita, dispara `bling-sales-order.service.ts`'s `sendOrderToBling(orderId)` **sem
  aguardar** (fire-and-forget, erros capturados e logados internamente — nunca propagam para a
  resposta HTTP do fechamento).
- **Cron de retry:** novo `server/jobs/bling-sales-order-sync-scheduler.ts`, mesmo padrão de
  `bling-token-refresh-scheduler.ts` (node-cron, timezone America/Sao_Paulo). Roda a cada 5
  minutos, seleciona comandas com `status = 'fechada' AND bling_sync_status IN ('pendente','erro')
  AND bling_sync_attempts < 5`, chama `sendOrderToBling` para cada uma.
- **Limite de tentativas:** `'erro'` (falha transitória: rede, Bling instável, refresh de token
  falhou) tenta de novo até 5 vezes; na 5ª falha vira `'bloqueado'` também, para não ficar
  tentando para sempre sem ninguém saber.
- **Concorrência:** tentativa imediata e cron podem colidir na mesma comanda. `sendOrderToBling`
  seleciona a comanda com `SELECT ... FOR UPDATE SKIP LOCKED` numa transação: quem chegar primeiro
  trava a linha e segue para a chamada ao Bling; o outro (lock já tomado) pula a comanda em vez de
  esperar ou duplicar o pedido de venda. Não é preciso um estado extra no enum para isso — o lock
  de linha já resolve a exclusão mútua; `bling_sync_status` só muda para o resultado final
  (`enviado`/`bloqueado`/`erro`) ao fim da tentativa.
- **Token de acesso:** reaproveita o padrão já usado em `bling-products-sync.service.ts:38-62` —
  `blingConnectionsService.getById(connectionId)` + `decryptToken(connection.accessTokenEncrypted)`
  + `onTokenRefresh` que chama `blingConnectionsService.refreshConnection(connectionId)`. Nenhuma
  lógica de token nova.

Cada tentativa (sucesso, bloqueio ou erro) grava uma linha em
`restaurant_order_bling_sync_log` e atualiza os campos de estado atual em `restaurant_orders`.

## Auditoria e visibilidade no painel admin

- **`GET /api/restaurant-pdv/admin/units-overview`** (`admin-units-overview.controller.ts`) —
  `UnitOverview.stats` ganha `pendingBlingSyncCount: number` (contagem de comandas fechadas da
  unidade com `bling_sync_status IN ('bloqueado','erro')`).
- **[admin-panel.tsx](client/src/pages/restaurant-pdv/admin-panel.tsx)** — card de cada unidade
  mostra um aviso quando `pendingBlingSyncCount > 0` (ex.: "3 comandas com pendência no Bling"),
  mesmo estilo visual do aviso de caixa fechado já existente em `table-map.tsx`.
- **Nova página** `client/src/pages/restaurant-pdv/admin-bling-sync.tsx`, rota
  `/pdv-restaurante/admin/bling-pendencias` (dentro do `Switch` gestor-only de
  `RestaurantPdvSection` em [App.tsx](client/src/App.tsx), ao lado de `/caixa`, `/relatorios`,
  `/configuracoes`, `/admin`). Lista comandas com pendência (todas as unidades ou filtrado por
  unidade), mostrando mesa, unidade, motivo (`bling_sync_error`) e histórico de tentativas
  (`restaurant_order_bling_sync_log`), com botão "Reenviar" por linha.
- **Novo endpoint** `POST /api/restaurant-pdv/admin/orders/:id/retry-bling-sync` (mesmo padrão
  `requireGestor` das outras rotas admin) — zera `bling_sync_attempts`, marca `pendente` de novo
  e chama `sendOrderToBling` imediatamente (mesma função usada pelo cron e pelo fechamento).

## Fora de escopo

- **Forma de pagamento no Bling** (`parcelas[].formaPagamento.id`): não existe hoje mapeamento
  "pix/cartão/dinheiro → id da forma de pagamento" por conta Bling. A parcela é enviada sem esse
  campo (opcional no payload). Fast-follow se for necessário depois.
- **Multi-loja dentro de uma conta Bling** (`loja.id`): omitido, usa a loja padrão da conta.
- **Editar/cancelar o pedido de venda no Bling** depois de criado (ex.: se a comanda for reaberta
  ou tiver desconto aplicado após o envio): fora de escopo — a comanda já está fechada quando o
  envio acontece, não há caminho de edição posterior hoje.
- **Exportar automaticamente o cliente "Consumidor Final" para o Bling**: a spec assume que o
  cliente escolhido como `default_client_id` já foi exportado para aquela conta via o fluxo
  existente (`bling-clients-export.service.ts`, tela de exportação de clientes). Se não tiver
  `bling_contact_mappings`, a comanda fica `bloqueado` com mensagem indicando isso — não
  disparamos a exportação automaticamente daqui.

## Verificação

- Teste unitário de `resolveBlingSalesOrderPayload` (lógica pura, sem banco): payload correto com
  todos os vínculos presentes; `ok: false` com item avulso; `ok: false` com produto sem mapeamento
  na conexão certa; `ok: false` sem `client_id` e sem `default_client_id` mapeado; contato resolvido
  via `default_client_id` quando a comanda não tem cliente.
- Teste de rota para `POST /admin/orders/:id/retry-bling-sync` (mock de `bling-sales-order.service`,
  padrão `createRouteTestApp` + `createMockAuthMiddleware`).
- `npx tsc -p tsconfig.tmp.json` restrito aos arquivos tocados (padrão do `CLAUDE.md`, `npm run
  check` completo estoura memória nesta máquina).
- Sem teste visual em navegador (regra do projeto) — validar lendo o código: conferir que o aviso
  do painel admin usa o campo novo e que a lista de pendências reflete `restaurant_order_bling_sync_log`.
