/**
 * Servidor MCP (Model Context Protocol) — Plataforma B2C Grand Cru
 *
 * Autenticação: suporta dois modos:
 *   1. API Key direta — header "Authorization: Bearer <MCP_API_KEY>" (Claude Desktop, curl)
 *   2. OAuth 2.0 PKCE — fluxo completo para clientes web como Claude.ai
 *
 * Endpoints OAuth:
 *   GET  /mcp/authorize  — autorização (auto-aprova com a API key)
 *   POST /mcp/token      — troca code → access_token
 *   GET  /.well-known/oauth-authorization-server  — metadados (registrado em server/routes.ts)
 *
 * Ferramentas MCP disponíveis (10):
 *   buscar_cliente, historico_pedidos, perfil_de_vinho, saldo_cashback,
 *   mix_de_produtos, metricas_de_compra, buscar_pedidos, buscar_produtos,
 *   clientes_inativos, resumo_vendedor
 */

import crypto from "crypto";
import { Router, Request, Response, urlencoded } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { storage } from "../storage";
import { clientPurchaseInsightsService } from "../services/client-purchase-insights.service";
import { getAggregateDashboard } from "../services/seller-dashboard.service";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const mcpRouter = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Estado OAuth em memória (sem persistência — reinicia com o servidor)
// ─────────────────────────────────────────────────────────────────────────────

interface AuthCodeEntry {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: number;
}

interface AccessTokenEntry {
  expiresAt: number;
}

const authCodes = new Map<string, AuthCodeEntry>();
const accessTokens = new Map<string, AccessTokenEntry>();

// Limpeza periódica de entradas expiradas (a cada 15 minutos)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of authCodes) if (v.expiresAt < now) authCodes.delete(k);
  for (const [k, v] of accessTokens) if (v.expiresAt < now) accessTokens.delete(k);
}, 15 * 60 * 1000);

// ─────────────────────────────────────────────────────────────────────────────
// Validação de autenticação (API Key direta OU OAuth access token)
// ─────────────────────────────────────────────────────────────────────────────

function requireMcpAuth(req: Request, res: Response): boolean {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7)
    : (req.headers["x-api-key"] as string | undefined);

  if (!token) {
    res.status(401).json({ error: "Token de autenticação ausente." });
    return false;
  }

  const mcpApiKey = process.env.MCP_API_KEY;

  // Modo 1: API Key direta (Claude Desktop, curl, etc.)
  if (mcpApiKey && token === mcpApiKey) return true;

  // Modo 2: OAuth access token emitido pelo /token
  const tokenData = accessTokens.get(token);
  if (tokenData) {
    if (tokenData.expiresAt < Date.now()) {
      accessTokens.delete(token);
      res.status(401).json({ error: "Access token expirado. Reconecte o conector." });
      return false;
    }
    return true;
  }

  res.status(401).json({ error: "Token inválido." });
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// OAuth 2.0 — GET /mcp/authorize
// Claude.ai redireciona o usuário aqui para iniciar o fluxo PKCE
// ─────────────────────────────────────────────────────────────────────────────

mcpRouter.get("/authorize", (req: Request, res: Response) => {
  const {
    response_type,
    client_id,
    redirect_uri,
    code_challenge,
    code_challenge_method,
    state,
  } = req.query as Record<string, string>;

  if (response_type !== "code") {
    return res.status(400).json({ error: "unsupported_response_type" });
  }
  if (!redirect_uri || !code_challenge) {
    return res.status(400).json({ error: "invalid_request", error_description: "redirect_uri e code_challenge são obrigatórios" });
  }

  // Gera authorization code seguro (válido por 10 minutos)
  const code = crypto.randomBytes(32).toString("base64url");
  authCodes.set(code, {
    clientId: client_id ?? "",
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method ?? "S256",
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Redireciona de volta para o Claude.ai com o código
  const callback = new URL(redirect_uri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);

  return res.redirect(302, callback.toString());
});

// ─────────────────────────────────────────────────────────────────────────────
// OAuth 2.0 — POST /mcp/token
// Claude.ai troca o code + code_verifier por um access_token
// ─────────────────────────────────────────────────────────────────────────────

mcpRouter.post("/token", urlencoded({ extended: false }), (req: Request, res: Response) => {
  const { grant_type, code, redirect_uri, code_verifier } = req.body as Record<string, string>;

  if (grant_type !== "authorization_code") {
    return res.status(400).json({ error: "unsupported_grant_type" });
  }
  if (!code || !code_verifier) {
    return res.status(400).json({ error: "invalid_request", error_description: "code e code_verifier são obrigatórios" });
  }

  const stored = authCodes.get(code);
  if (!stored || stored.expiresAt < Date.now()) {
    authCodes.delete(code);
    return res.status(400).json({ error: "invalid_grant", error_description: "Código expirado ou inválido" });
  }

  // Valida PKCE: SHA-256(code_verifier) deve ser igual ao code_challenge
  const computedChallenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");

  if (computedChallenge !== stored.codeChallenge) {
    return res.status(400).json({ error: "invalid_grant", error_description: "code_verifier inválido" });
  }

  // Valida redirect_uri (deve coincidir com o da autorização)
  if (redirect_uri && redirect_uri !== stored.redirectUri) {
    return res.status(400).json({ error: "invalid_grant", error_description: "redirect_uri não coincide" });
  }

  // Código de uso único — remove após validação
  authCodes.delete(code);

  // Emite access token (válido por 24 horas)
  const accessToken = crypto.randomBytes(32).toString("base64url");
  accessTokens.set(accessToken, {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return res.json({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 86400,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fábrica do McpServer com todas as ferramentas registradas
// ─────────────────────────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "vinocrm-b2c",
    version: "1.0.0",
  });

  // ── 1. buscar_cliente ──────────────────────────────────────────────────────
  server.tool(
    "buscar_cliente",
    `Busca clientes na base do CRM por nome, CPF, telefone ou ID.
Retorna até 20 resultados com dados cadastrais: nome, CPF, e-mail, telefone,
cidade, categoria (A/B/C/D), origem, vendedor responsável e data de cadastro.
Use esta ferramenta antes de consultar pedidos, cashback ou perfil de vinho.`,
    {
      nome: z.string().optional().describe("Nome completo ou parcial do cliente"),
      cpf: z.string().optional().describe("CPF do cliente (com ou sem formatação)"),
      telefone: z.string().optional().describe("Telefone do cliente (com ou sem formatação)"),
      id: z.string().uuid().optional().describe("ID interno do cliente (UUID)"),
      limite: z.number().int().min(1).max(50).default(20).describe("Máximo de resultados (padrão: 20)"),
    },
    async ({ nome, cpf, telefone, id, limite }) => {
      try {
        if (id) {
          const cliente = await storage.getClient(id);
          if (!cliente) return { content: [{ type: "text", text: "Cliente não encontrado." }] };
          return { content: [{ type: "text", text: JSON.stringify(cliente, null, 2) }] };
        }
        const clientes = await storage.getClients(undefined, "admin", { name: nome, cpf, phone: telefone }, 1, limite);
        if (!clientes.length) return { content: [{ type: "text", text: "Nenhum cliente encontrado com os filtros informados." }] };
        const resumo = clientes.map((c: any) => ({
          id: c.id, nome: c.name, cpf: c.cpf, email: c.email, telefone: c.phone,
          cidade: c.city, estado: c.state, categoria: c.categoria, origem: c.origem,
          responsavel: c.responsavelId, cadastradoEm: c.createdAt,
        }));
        return { content: [{ type: "text", text: `${resumo.length} cliente(s) encontrado(s):\n\n${JSON.stringify(resumo, null, 2)}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar cliente: ${err.message}` }] };
      }
    },
  );

  // ── 2. historico_pedidos ───────────────────────────────────────────────────
  server.tool(
    "historico_pedidos",
    `Retorna o histórico detalhado de pedidos de um cliente (Bling + Connect),
ordenados do mais recente ao mais antigo. Inclui data, valor total, vendedor,
número do pedido e itens. Use o clienteId obtido com buscar_cliente.`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
      limite: z.number().int().min(1).max(100).default(20).describe("Quantidade de pedidos (padrão: 20)"),
      offset: z.number().int().min(0).default(0).describe("Deslocamento para paginação (padrão: 0)"),
      fonte: z.enum(["all", "bling", "connect"]).default("all").describe("Fonte dos pedidos"),
    },
    async ({ clienteId, limite, offset, fonte }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({
          clientId: clienteId, historyLimit: limite, historyOffset: offset,
          historySource: fonte as "all" | "bling" | "connect",
        });
        const { purchaseHistory } = insights;
        if (!purchaseHistory.data.length) return { content: [{ type: "text", text: "Nenhum pedido encontrado para este cliente." }] };
        const resultado = {
          totalPedidos: purchaseHistory.total, exibindo: purchaseHistory.data.length, temMais: purchaseHistory.hasMore,
          pedidos: purchaseHistory.data.map((p: any) => ({
            data: p.saleDate, valor: p.totalValue, vendedor: p.sellerName, numeroPedido: p.orderNumber, fonte: p.source,
            itens: p.items?.map((i: any) => ({ produto: i.description, quantidade: i.quantity, valorUnitario: i.value ?? i.unitValue })),
          })),
        };
        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar histórico: ${err.message}` }] };
      }
    },
  );

  // ── 3. perfil_de_vinho ────────────────────────────────────────────────────
  server.tool(
    "perfil_de_vinho",
    `Retorna o perfil de preferências de vinho de um cliente, gerado por IA a partir
do histórico de compras. Inclui tipos preferidos, distribuição percentual, uvas
favoritas, regiões e faixas de preço.`,
    { clienteId: z.string().uuid().describe("ID interno do cliente (UUID)") },
    async ({ clienteId }) => {
      try {
        const result = await db.execute(sql`SELECT name, wine_profile, wine_profile_generated_at FROM clients WHERE id = ${clienteId} LIMIT 1`);
        const row = result.rows[0] as Record<string, unknown> | undefined;
        if (!row) return { content: [{ type: "text", text: "Cliente não encontrado." }] };
        if (!row.wine_profile) return { content: [{ type: "text", text: `O cliente "${row.name}" ainda não tem perfil de vinho gerado.` }] };
        return { content: [{ type: "text", text: JSON.stringify({ cliente: row.name, geradoEm: row.wine_profile_generated_at, perfil: row.wine_profile }, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar perfil de vinho: ${err.message}` }] };
      }
    },
  );

  // ── 4. saldo_cashback ─────────────────────────────────────────────────────
  server.tool(
    "saldo_cashback",
    `Retorna o saldo de cashback disponível de um cliente e o histórico das últimas
transações (créditos e resgates).`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
      limiteTransacoes: z.number().int().min(1).max(50).default(10).describe("Quantidade de transações no histórico (padrão: 10)"),
    },
    async ({ clienteId, limiteTransacoes }) => {
      try {
        const [balance, usage] = await Promise.all([
          storage.getClientCashbackBalance(clienteId),
          storage.getClientCashbackUsage(clienteId),
        ]);
        if (!balance && (!usage || !usage.length)) return { content: [{ type: "text", text: "Este cliente não possui movimentação de cashback." }] };
        const resultado = {
          saldoAtual: balance?.currentBalance ?? 0, totalAcumulado: balance?.totalEarned ?? 0,
          totalResgatado: balance?.totalUsed ?? 0, ultimaAtualizacao: balance?.lastUpdated,
          historicoResgates: usage?.slice(0, limiteTransacoes).map((u: any) => ({ data: u.createdAt, valor: u.amount, descricao: u.description, status: u.status })) ?? [],
        };
        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar cashback: ${err.message}` }] };
      }
    },
  );

  // ── 5. mix_de_produtos ────────────────────────────────────────────────────
  server.tool(
    "mix_de_produtos",
    `Retorna o mix de produtos comprados por um cliente: quais vinhos ele comprou,
quantas vezes, o valor total gasto em cada um e o tempo médio entre compras.
Identifica também produtos que ele parou de comprar.`,
    { clienteId: z.string().uuid().describe("ID interno do cliente (UUID)") },
    async ({ clienteId }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({ clientId: clienteId, historyLimit: 1 });
        const { productMix, inactiveProducts } = insights;
        if (!productMix.length && !inactiveProducts.length) return { content: [{ type: "text", text: "Nenhum produto encontrado no histórico deste cliente." }] };
        const resultado = {
          produtosAtivos: productMix.map((p: any) => ({
            produto: p.description, tipo: p.type, pais: p.country, quantidadeTotal: p.totalQuantity,
            valorTotal: p.totalValue, ultimaCompra: p.lastPurchaseDate, diasEntreCompras: p.averageDaysBetweenPurchases,
          })),
          produtosInativos: inactiveProducts.map((p: any) => ({
            produto: p.description, tipo: p.type, quantidadeHistorica: p.totalQuantity,
            ultimaCompra: p.lastPurchaseDate, diasSemComprar: p.daysSinceLastPurchase,
          })),
        };
        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar mix de produtos: ${err.message}` }] };
      }
    },
  );

  // ── 6. metricas_de_compra ─────────────────────────────────────────────────
  server.tool(
    "metricas_de_compra",
    `Retorna métricas consolidadas de comportamento de compra: ticket médio, preço médio
por item, frequência mensal, total gasto, data da última compra e previsão da
próxima compra com status do ciclo.`,
    { clienteId: z.string().uuid().describe("ID interno do cliente (UUID)") },
    async ({ clienteId }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({ clientId: clienteId, historyLimit: 1 });
        const { summary, predictiveAnalysis, linkStatus } = insights;
        const statusLabels: Record<string, string> = {
          dentro_do_ciclo: "Dentro do ciclo", proximo_do_vencimento: "Próximo do vencimento",
          atrasado: "Atrasado", muito_atrasado: "Muito atrasado", sem_base: "Sem base para previsão",
        };
        const resultado = {
          vinculacao: linkStatus, totalGasto: summary.totalPurchased, numeroPedidos: summary.purchaseCount,
          ticketMedio: summary.averageTicket, precoMedioPorItem: summary.avgItemPrice, itensPorPedido: summary.avgItemsPerOrder,
          totalItensComprados: summary.totalItems, frequenciaMensal: summary.monthlyFrequency,
          diasEntreCompras: summary.averageDaysBetweenPurchases,
          ultimaCompra: { data: summary.lastPurchaseDate, valor: summary.lastPurchaseValue },
          previsaoProximaCompra: {
            data: predictiveAnalysis.predictedNextPurchaseDate,
            diasDesdeUltimaCompra: predictiveAnalysis.daysSinceLastPurchase,
            diasDeAtraso: predictiveAnalysis.daysLate,
            progressoDoCiclo: predictiveAnalysis.cycleProgress ? `${predictiveAnalysis.cycleProgress}%` : null,
            status: statusLabels[predictiveAnalysis.status] ?? predictiveAnalysis.status,
          },
          atividade: { mesesAtivosUltimos6Meses: summary.activeMonthsLast6, mesesAtivosUltimos12Meses: summary.activeMonthsLast12 },
        };
        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar métricas: ${err.message}` }] };
      }
    },
  );

  // ── 7. buscar_pedidos ─────────────────────────────────────────────────────
  server.tool(
    "buscar_pedidos",
    `Busca pedidos (Bling + Connect) com filtros por período, cliente ou vendedor.
Retorna data, valor, cliente, vendedor, fonte e número do pedido.`,
    {
      dataInicio: z.string().optional().describe("Data de início no formato YYYY-MM-DD"),
      dataFim: z.string().optional().describe("Data de fim no formato YYYY-MM-DD"),
      clienteId: z.string().uuid().optional().describe("Filtrar por cliente (UUID)"),
      vendedorId: z.string().uuid().optional().describe("Filtrar por vendedor (UUID)"),
      fonte: z.enum(["all", "bling", "connect"]).default("all").describe("Fonte: 'bling', 'connect' ou 'all'"),
      limite: z.number().int().min(1).max(200).default(50).describe("Máximo de resultados (padrão: 50)"),
    },
    async ({ dataInicio, dataFim, clienteId, vendedorId, fonte, limite }) => {
      try {
        const blingWhere: string[] = ["bo.deleted_at IS NULL"];
        const connectWhere: string[] = [];
        if (dataInicio) { blingWhere.push(`bo.sale_date >= '${dataInicio}'`); connectWhere.push(`co.sale_date >= '${dataInicio}'`); }
        if (dataFim) { blingWhere.push(`bo.sale_date <= '${dataFim}'`); connectWhere.push(`co.sale_date <= '${dataFim}'`); }
        if (clienteId) { blingWhere.push(`bo.app_client_id = '${clienteId}'`); connectWhere.push(`co.app_client_id = '${clienteId}'`); }
        if (vendedorId) { blingWhere.push(`bo.seller_id = '${vendedorId}'`); connectWhere.push(`co.seller_id = '${vendedorId}'`); }

        const bCond = blingWhere.join(" AND ");
        const cCond = connectWhere.length ? connectWhere.join(" AND ") : "TRUE";

        let query = "";
        if (fonte === "bling" || fonte === "all") {
          query += `SELECT 'bling' AS fonte, bo.id, bo.sale_date::text AS data, bo.total_value AS valor, bo.contact_name AS cliente, bo.seller_name AS vendedor, bo.order_number AS numero_pedido, bo.app_client_id AS cliente_id FROM bling_orders bo WHERE ${bCond}`;
        }
        if (fonte === "connect" || fonte === "all") {
          if (query) query += " UNION ALL ";
          query += `SELECT 'connect' AS fonte, co.id::text, to_char(co.sale_date, 'YYYY-MM-DD') AS data, NULLIF(co.total_value, 'NaN'::numeric) AS valor, co.contact_name AS cliente, co.seller_name_raw AS vendedor, NULL::text AS numero_pedido, co.app_client_id AS cliente_id FROM connect_orders co WHERE ${cCond}`;
        }
        query += ` ORDER BY data DESC LIMIT ${limite}`;

        const result = await db.execute(sql.raw(query));
        const rows = result.rows as Record<string, unknown>[];
        if (!rows.length) return { content: [{ type: "text", text: "Nenhum pedido encontrado com os filtros informados." }] };
        return { content: [{ type: "text", text: `${rows.length} pedido(s) encontrado(s):\n\n${JSON.stringify(rows, null, 2)}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar pedidos: ${err.message}` }] };
      }
    },
  );

  // ── 8. buscar_produtos ────────────────────────────────────────────────────
  server.tool(
    "buscar_produtos",
    `Busca produtos do catálogo Grand Cru com filtros por nome, tipo e país.
Retorna nome, tipo, país, volume, preço negociado e sincronização com Bling.`,
    {
      nome: z.string().optional().describe("Nome completo ou parcial do produto"),
      tipo: z.string().optional().describe("Tipo: TINTO, BRANCO, ROSE, ESPUMANTE"),
      pais: z.string().optional().describe("País de origem (ex: Brasil, Argentina, França)"),
      limite: z.number().int().min(1).max(100).default(20).describe("Máximo de resultados (padrão: 20)"),
    },
    async ({ nome, tipo, pais, limite }) => {
      try {
        const { data: produtos } = await storage.getProducts({ name: nome, type: tipo, country: pais }, 1, limite);
        if (!produtos.length) return { content: [{ type: "text", text: "Nenhum produto encontrado com os filtros informados." }] };
        const resumo = produtos.map((p: any) => ({
          id: p.id, nome: p.name, tipo: p.type, pais: p.country, volume: p.volume,
          precoNegociado: p.negotiatedPrice, sincronizadoBling: !!p.blingProductId,
          temPerfilIA: !!p.aiProfile, imagemUrl: p.imageUrl,
        }));
        return { content: [{ type: "text", text: `${resumo.length} produto(s) encontrado(s):\n\n${JSON.stringify(resumo, null, 2)}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar produtos: ${err.message}` }] };
      }
    },
  );

  // ── 9. clientes_inativos ──────────────────────────────────────────────────
  server.tool(
    "clientes_inativos",
    `Retorna clientes que não realizaram nenhuma compra há mais de X dias.
Útil para identificar clientes em risco de churn e priorizar reativação.`,
    {
      diasSemCompra: z.number().int().min(1).default(90).describe("Dias mínimos sem compra (padrão: 90)"),
      vendedorId: z.string().uuid().optional().describe("Filtrar por vendedor responsável (UUID)"),
      categoria: z.string().optional().describe("Filtrar por categoria (A, B, C, D)"),
      limite: z.number().int().min(1).max(200).default(50).describe("Máximo de resultados (padrão: 50)"),
    },
    async ({ diasSemCompra, vendedorId, categoria, limite }) => {
      try {
        const vFilter = vendedorId ? `AND c.responsavel_id = '${vendedorId}'` : "";
        const cFilter = categoria ? `AND UPPER(c.categoria) = '${categoria.toUpperCase()}'` : "";
        const result = await db.execute(sql.raw(`
          WITH ultima_compra AS (
            SELECT app_client_id, MAX(sale_date) AS ultima_data, SUM(total_value) AS total_gasto
            FROM bling_orders WHERE deleted_at IS NULL AND app_client_id IS NOT NULL GROUP BY app_client_id
            UNION ALL
            SELECT app_client_id, MAX(sale_date)::text, SUM(NULLIF(total_value, 'NaN'::numeric))
            FROM connect_orders WHERE app_client_id IS NOT NULL GROUP BY app_client_id
          ),
          agrupada AS (
            SELECT app_client_id, MAX(ultima_data) AS ultima_compra, SUM(total_gasto) AS total_gasto
            FROM ultima_compra GROUP BY app_client_id
          )
          SELECT c.id, c.name AS nome, c.phone AS telefone, c.email, c.city AS cidade,
            c.state AS estado, c.categoria, u.name AS vendedor,
            a.ultima_compra, ROUND(a.total_gasto, 2) AS total_gasto,
            (CURRENT_DATE - a.ultima_compra::date) AS dias_sem_compra
          FROM clients c
          INNER JOIN agrupada a ON a.app_client_id = c.id
          LEFT JOIN users u ON u.id = c.responsavel_id
          WHERE (CURRENT_DATE - a.ultima_compra::date) >= ${diasSemCompra} ${vFilter} ${cFilter}
          ORDER BY a.ultima_compra ASC LIMIT ${limite}
        `));
        const rows = result.rows as Record<string, unknown>[];
        if (!rows.length) return { content: [{ type: "text", text: `Nenhum cliente inativo há mais de ${diasSemCompra} dias encontrado.` }] };
        return { content: [{ type: "text", text: `${rows.length} cliente(s) sem compra há mais de ${diasSemCompra} dias:\n\n${JSON.stringify(rows, null, 2)}` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar clientes inativos: ${err.message}` }] };
      }
    },
  );

  // ── 10. resumo_vendedor ───────────────────────────────────────────────────
  server.tool(
    "resumo_vendedor",
    `Retorna o resumo de performance de vendas de um ou todos os vendedores em um
período. Inclui total vendido, pedidos, ticket médio, top produtos e top clientes.`,
    {
      dataInicio: z.string().optional().describe("Data de início YYYY-MM-DD (padrão: início do mês)"),
      dataFim: z.string().optional().describe("Data de fim YYYY-MM-DD (padrão: hoje)"),
      vendedorId: z.string().uuid().optional().describe("ID do vendedor (UUID). Se omitido, retorna toda a equipe."),
    },
    async ({ dataInicio, dataFim, vendedorId }) => {
      try {
        const data = await getAggregateDashboard(dataInicio, dataFim, {
          requestUserId: undefined, requestUserRole: "admin", filterUserId: vendedorId, filters: {},
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar resumo do vendedor: ${err.message}` }] };
      }
    },
  );

  return server;
}

// ─────────────────────────────────────────────────────────────────────────────
// MCP POST — handler principal (stateless, uma instância por requisição)
// ─────────────────────────────────────────────────────────────────────────────

mcpRouter.post("/", async (req: Request, res: Response) => {
  if (!requireMcpAuth(req, res)) return;
  try {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[MCP] Erro ao processar requisição:", err);
    if (!res.headersSent) res.status(500).json({ error: "Erro interno no servidor MCP." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /mcp — página de informações (sem autenticação)
// ─────────────────────────────────────────────────────────────────────────────

mcpRouter.get("/", (_req: Request, res: Response) => {
  const base = process.env.APP_URL ?? "https://crmgrandcru.replit.app";
  res.json({
    name: "VinoCRM B2C — Servidor MCP",
    version: "1.0.0",
    protocol: "Model Context Protocol (MCP) via Streamable HTTP",
    endpoint: `POST ${base}/mcp`,
    oauth: {
      authorize: `${base}/mcp/authorize`,
      token: `${base}/mcp/token`,
      metadata: `${base}/.well-known/oauth-authorization-server`,
    },
    ferramentas: [
      "buscar_cliente", "historico_pedidos", "perfil_de_vinho", "saldo_cashback",
      "mix_de_produtos", "metricas_de_compra", "buscar_pedidos", "buscar_produtos",
      "clientes_inativos", "resumo_vendedor",
    ],
  });
});
