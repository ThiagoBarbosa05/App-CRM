---
name: MCP Server
description: Detalhes de implementação do servidor MCP no VinoCRM (endpoint, autenticação, ferramentas, dependências).
---

# Servidor MCP — VinoCRM B2C

## Localização
- Arquivo: `server/routes/mcp.routes.ts`
- Registrado: `server/routes/index.ts` ANTES do `requireAuth` (rota pública com auth própria)
- Endpoint: `POST /api/mcp` (agentes) | `GET /api/mcp` (info, sem auth)

## Autenticação
- Variável de ambiente: `MCP_API_KEY`
- Headers aceitos: `Authorization: Bearer <key>` ou `x-api-key: <key>`
- Sem a variável configurada retorna 503; key errada retorna 401

## Padrão de implementação
- Modo stateless: cada POST cria um `McpServer` + `StreamableHTTPServerTransport({ sessionIdGenerator: undefined })`
- SDK: `@modelcontextprotocol/sdk` v1.29.0+
- Ferramentas registradas via `server.tool(name, description, zodSchema, handler)`

## 10 Ferramentas

| Ferramenta | Dependência principal |
|---|---|
| `buscar_cliente` | `storage.getClients()` / `storage.getClient()` |
| `historico_pedidos` | `clientPurchaseInsightsService.getInsights()` — campo `purchaseHistory` |
| `perfil_de_vinho` | Query raw em `clients.wine_profile` (JSONB) |
| `saldo_cashback` | `storage.getClientCashbackBalance()` + `storage.getClientCashbackUsage()` |
| `mix_de_produtos` | `clientPurchaseInsightsService.getInsights()` — campos `productMix` + `inactiveProducts` |
| `metricas_de_compra` | `clientPurchaseInsightsService.getInsights()` — campos `summary` + `predictiveAnalysis` |
| `buscar_pedidos` | Query raw UNION bling_orders + connect_orders com sql.raw() |
| `buscar_produtos` | `storage.getProducts(filters, page, pageSize)` |
| `clientes_inativos` | Query raw com CTE unindo bling_orders + connect_orders, filtrando por dias sem compra |
| `resumo_vendedor` | `getAggregateDashboard(startDate, endDate, scope)` de seller-dashboard.service |

**Why stateless:** Cada agente externo conecta via HTTP sem manter sessão longa; simplifica escala e evita vazamento de estado entre usuários diferentes.

**How to apply:** Para adicionar nova ferramenta, inserir novo bloco `server.tool(...)` dentro da função `createMcpServer()` no mesmo arquivo. Não é necessário registrar nada em outros arquivos.
