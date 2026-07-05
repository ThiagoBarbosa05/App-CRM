/**
 * Servidor MCP (Model Context Protocol) — Plataforma B2C Grand Cru
 *
 * Expõe as principais ações do CRM como ferramentas consumíveis por agentes de IA
 * externos (Claude Desktop, GPT, etc.) via endpoint HTTP POST /api/mcp.
 *
 * Autenticação: API key via header "Authorization: Bearer <key>" ou "x-api-key: <key>"
 * Configurar a variável de ambiente MCP_API_KEY com a chave desejada.
 *
 * Ferramentas disponíveis:
 *   1. buscar_cliente         — Busca clientes por nome, CPF, telefone ou ID
 *   2. historico_pedidos      — Pedidos Bling + Connect de um cliente
 *   3. perfil_de_vinho        — Perfil de preferências de vinho gerado por IA
 *   4. saldo_cashback         — Saldo e histórico de transações de cashback
 *   5. mix_de_produtos        — Produtos comprados, frequência e valor por cliente
 *   6. metricas_de_compra     — Ticket médio, frequência, previsão de próxima compra
 *   7. buscar_pedidos         — Pedidos filtrados por período, cliente ou vendedor
 *   8. buscar_produtos        — Catálogo de produtos com tipo, país e preço
 *   9. clientes_inativos      — Clientes sem compra há mais de X dias
 *  10. resumo_vendedor        — Performance de vendas de um vendedor por período
 */

import { Router, Request, Response } from "express";
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
// Autenticação por API Key
// ─────────────────────────────────────────────────────────────────────────────

function requireMcpApiKey(req: Request, res: Response): boolean {
  const mcpApiKey = process.env.MCP_API_KEY;

  if (!mcpApiKey) {
    res.status(503).json({
      error: "MCP_API_KEY não configurada no servidor. Contate o administrador.",
    });
    return false;
  }

  const authHeader = req.headers["authorization"];
  const xApiKey = req.headers["x-api-key"];

  const providedKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : (xApiKey as string | undefined);

  if (!providedKey || providedKey !== mcpApiKey) {
    res.status(401).json({
      error: "API key inválida ou ausente. Use o header Authorization: Bearer <key> ou x-api-key: <key>.",
    });
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fábrica do McpServer com todas as ferramentas registradas
// ─────────────────────────────────────────────────────────────────────────────

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "vinocrm-b2c",
    version: "1.0.0",
  });

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 1: buscar_cliente
  // ───────────────────────────────────────────────────────────────────────────
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
          if (!cliente) {
            return { content: [{ type: "text", text: "Cliente não encontrado." }] };
          }
          return { content: [{ type: "text", text: JSON.stringify(cliente, null, 2) }] };
        }

        const clientes = await storage.getClients(
          undefined,
          "admin",
          { name: nome, cpf, phone: telefone },
          1,
          limite,
        );

        if (clientes.length === 0) {
          return { content: [{ type: "text", text: "Nenhum cliente encontrado com os filtros informados." }] };
        }

        const resumo = clientes.map((c: any) => ({
          id: c.id,
          nome: c.name,
          cpf: c.cpf,
          email: c.email,
          telefone: c.phone,
          cidade: c.city,
          estado: c.state,
          categoria: c.categoria,
          origem: c.origem,
          responsavel: c.responsavelId,
          cadastradoEm: c.createdAt,
        }));

        return {
          content: [{
            type: "text",
            text: `${resumo.length} cliente(s) encontrado(s):\n\n${JSON.stringify(resumo, null, 2)}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar cliente: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 2: historico_pedidos
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "historico_pedidos",
    `Retorna o histórico detalhado de pedidos de um cliente (Bling + Connect),
ordenados do mais recente ao mais antigo. Inclui data, valor total, vendedor,
número do pedido e itens. Use o clienteId obtido com buscar_cliente.`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
      limite: z.number().int().min(1).max(100).default(20).describe("Quantidade de pedidos (padrão: 20)"),
      offset: z.number().int().min(0).default(0).describe("Deslocamento para paginação (padrão: 0)"),
      fonte: z.enum(["all", "bling", "connect"]).default("all").describe("Fonte dos pedidos: 'bling', 'connect' ou 'all' (padrão)"),
    },
    async ({ clienteId, limite, offset, fonte }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({
          clientId: clienteId,
          historyLimit: limite,
          historyOffset: offset,
          historySource: fonte as "all" | "bling" | "connect",
        });

        const { purchaseHistory } = insights;

        if (!purchaseHistory.data.length) {
          return { content: [{ type: "text", text: "Nenhum pedido encontrado para este cliente." }] };
        }

        const resultado = {
          totalPedidos: purchaseHistory.total,
          exibindo: purchaseHistory.data.length,
          temMais: purchaseHistory.hasMore,
          pedidos: purchaseHistory.data.map((p: any) => ({
            data: p.saleDate,
            valor: p.totalValue,
            vendedor: p.sellerName,
            numeroPedido: p.orderNumber,
            fonte: p.source,
            itens: p.items?.map((i: any) => ({
              produto: i.description,
              quantidade: i.quantity,
              valorUnitario: i.value ?? i.unitValue,
            })),
          })),
        };

        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar histórico: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 3: perfil_de_vinho
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "perfil_de_vinho",
    `Retorna o perfil de preferências de vinho de um cliente, gerado por IA a partir
do histórico de compras. Inclui tipos preferidos (TINTO, BRANCO, ROSE, ESPUMANTE),
distribuição percentual, uvas favoritas, regiões, faixas de preço e sugestões
de produtos do catálogo. Use o clienteId obtido com buscar_cliente.`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
    },
    async ({ clienteId }) => {
      try {
        const result = await db.execute(sql`
          SELECT
            name,
            wine_profile,
            wine_profile_generated_at
          FROM clients
          WHERE id = ${clienteId}
          LIMIT 1
        `);

        const row = result.rows[0] as Record<string, unknown> | undefined;

        if (!row) {
          return { content: [{ type: "text", text: "Cliente não encontrado." }] };
        }

        if (!row.wine_profile) {
          return {
            content: [{
              type: "text",
              text: `O cliente "${row.name}" ainda não tem perfil de vinho gerado. Acesse o CRM e clique em "Gerar Perfil" na aba de perfil do cliente.`,
            }],
          };
        }

        const perfil = {
          cliente: row.name,
          geradoEm: row.wine_profile_generated_at,
          perfil: row.wine_profile,
        };

        return { content: [{ type: "text", text: JSON.stringify(perfil, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar perfil de vinho: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 4: saldo_cashback
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "saldo_cashback",
    `Retorna o saldo de cashback disponível de um cliente e o histórico das últimas
transações (créditos e resgates). Útil para consultar antes de uma venda ou
abordagem de fidelização. Use o clienteId obtido com buscar_cliente.`,
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

        if (!balance && (!usage || usage.length === 0)) {
          return { content: [{ type: "text", text: "Este cliente não possui movimentação de cashback." }] };
        }

        const resultado = {
          saldoAtual: balance?.currentBalance ?? 0,
          totalAcumulado: balance?.totalEarned ?? 0,
          totalResgatado: balance?.totalUsed ?? 0,
          ultimaAtualizacao: balance?.lastUpdated,
          historicoResgates: usage?.slice(0, limiteTransacoes).map((u: any) => ({
            data: u.createdAt,
            valor: u.amount,
            descricao: u.description,
            status: u.status,
          })) ?? [],
        };

        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar cashback: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 5: mix_de_produtos
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "mix_de_produtos",
    `Retorna o mix de produtos comprados por um cliente: quais vinhos ele comprou,
quantas vezes, o valor total gasto em cada um e o tempo médio entre compras
do mesmo produto. Identifica também produtos que ele parou de comprar.
Use o clienteId obtido com buscar_cliente.`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
    },
    async ({ clienteId }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({
          clientId: clienteId,
          historyLimit: 1,
        });

        const { productMix, inactiveProducts } = insights;

        if (!productMix.length && !inactiveProducts.length) {
          return { content: [{ type: "text", text: "Nenhum produto encontrado no histórico deste cliente." }] };
        }

        const resultado = {
          produtosAtivos: productMix.map((p: any) => ({
            produto: p.description,
            tipo: p.type,
            pais: p.country,
            quantidadeTotal: p.totalQuantity,
            valorTotal: p.totalValue,
            ultimaCompra: p.lastPurchaseDate,
            diasEntreCompras: p.averageDaysBetweenPurchases,
          })),
          produtosInativos: inactiveProducts.map((p: any) => ({
            produto: p.description,
            tipo: p.type,
            quantidadeHistorica: p.totalQuantity,
            ultimaCompra: p.lastPurchaseDate,
            diasSemComprar: p.daysSinceLastPurchase,
          })),
        };

        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar mix de produtos: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 6: metricas_de_compra
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "metricas_de_compra",
    `Retorna métricas consolidadas de comportamento de compra de um cliente:
ticket médio por pedido, preço médio por item, frequência mensal, total gasto,
número de compras, data da última compra e previsão da próxima compra com
status do ciclo (dentro do ciclo, em atraso, etc).
Use o clienteId obtido com buscar_cliente.`,
    {
      clienteId: z.string().uuid().describe("ID interno do cliente (UUID)"),
    },
    async ({ clienteId }) => {
      try {
        const insights = await clientPurchaseInsightsService.getInsights({
          clientId: clienteId,
          historyLimit: 1,
        });

        const { summary, predictiveAnalysis, linkStatus } = insights;

        const statusLabels: Record<string, string> = {
          dentro_do_ciclo: "Dentro do ciclo (compra prevista para o futuro)",
          proximo_do_vencimento: "Próximo do vencimento (pode comprar em breve)",
          atrasado: "Atrasado (passou da data prevista de compra)",
          muito_atrasado: "Muito atrasado (significativamente fora do ciclo)",
          sem_base: "Sem base suficiente para previsão (poucas compras)",
        };

        const resultado = {
          vinculacao: linkStatus,
          totalGasto: summary.totalPurchased,
          numeroPedidos: summary.purchaseCount,
          ticketMedio: summary.averageTicket,
          precoMedioPorItem: summary.avgItemPrice,
          itensPorPedido: summary.avgItemsPerOrder,
          totalItensComprados: summary.totalItems,
          frequenciaMensal: summary.monthlyFrequency,
          diasEntreCompras: summary.averageDaysBetweenPurchases,
          ultimaCompra: {
            data: summary.lastPurchaseDate,
            valor: summary.lastPurchaseValue,
          },
          previsaoProximaCompra: {
            data: predictiveAnalysis.predictedNextPurchaseDate,
            diasDesdeUltimaCompra: predictiveAnalysis.daysSinceLastPurchase,
            diasDeAtraso: predictiveAnalysis.daysLate,
            progressoDoCiclo: predictiveAnalysis.cycleProgress
              ? `${predictiveAnalysis.cycleProgress}%`
              : null,
            status: statusLabels[predictiveAnalysis.status] ?? predictiveAnalysis.status,
          },
          atividade: {
            mesesAtivosUltimos6Meses: summary.activeMonthsLast6,
            mesesAtivosUltimos12Meses: summary.activeMonthsLast12,
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(resultado, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar métricas: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 7: buscar_pedidos
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "buscar_pedidos",
    `Busca pedidos (Bling + Connect) com filtros por período, cliente ou vendedor.
Retorna data, valor, cliente, vendedor, fonte (bling/connect) e número do pedido.
Útil para auditorias, relatórios ad-hoc e análises de desempenho de vendas.`,
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
        const conditions: string[] = [];
        const params: any[] = [];

        if (dataInicio) { conditions.push("data_inicio"); }
        if (dataFim) { conditions.push("data_fim"); }

        const blingWhere: string[] = ["bo.deleted_at IS NULL"];
        const connectWhere: string[] = [];

        if (dataInicio) {
          blingWhere.push(`bo.sale_date >= '${dataInicio}'`);
          connectWhere.push(`co.sale_date >= '${dataInicio}'`);
        }
        if (dataFim) {
          blingWhere.push(`bo.sale_date <= '${dataFim}'`);
          connectWhere.push(`co.sale_date <= '${dataFim}'`);
        }
        if (clienteId) {
          blingWhere.push(`bo.app_client_id = '${clienteId}'`);
          connectWhere.push(`co.app_client_id = '${clienteId}'`);
        }
        if (vendedorId) {
          blingWhere.push(`bo.seller_id = '${vendedorId}'`);
          connectWhere.push(`co.seller_id = '${vendedorId}'`);
        }

        const blingCondition = blingWhere.join(" AND ");
        const connectCondition = connectWhere.length > 0 ? connectWhere.join(" AND ") : "TRUE";

        let query = "";
        if (fonte === "bling" || fonte === "all") {
          query += `
            SELECT 'bling' AS fonte,
              bo.id, bo.sale_date::text AS data,
              bo.total_value AS valor,
              bo.contact_name AS cliente,
              bo.seller_name AS vendedor,
              bo.order_number AS numero_pedido,
              bo.app_client_id AS cliente_id
            FROM bling_orders bo
            WHERE ${blingCondition}
          `;
        }
        if (fonte === "connect" || fonte === "all") {
          if (query) query += " UNION ALL ";
          query += `
            SELECT 'connect' AS fonte,
              co.id::text, to_char(co.sale_date, 'YYYY-MM-DD') AS data,
              NULLIF(co.total_value, 'NaN'::numeric) AS valor,
              co.contact_name AS cliente,
              co.seller_name_raw AS vendedor,
              NULL::text AS numero_pedido,
              co.app_client_id AS cliente_id
            FROM connect_orders co
            WHERE ${connectCondition}
          `;
        }

        query += ` ORDER BY data DESC LIMIT ${limite}`;

        const result = await db.execute(sql.raw(query));
        const rows = result.rows as Record<string, unknown>[];

        if (!rows.length) {
          return { content: [{ type: "text", text: "Nenhum pedido encontrado com os filtros informados." }] };
        }

        return {
          content: [{
            type: "text",
            text: `${rows.length} pedido(s) encontrado(s):\n\n${JSON.stringify(rows, null, 2)}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar pedidos: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 8: buscar_produtos
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "buscar_produtos",
    `Busca produtos do catálogo Grand Cru com filtros por nome, tipo e país.
Retorna nome, tipo (TINTO/BRANCO/ROSE/ESPUMANTE/OUTRO), país, volume,
preço negociado e se está sincronizado com o Bling.
Útil para recomendar vinhos a clientes com base no perfil de preferências.`,
    {
      nome: z.string().optional().describe("Nome completo ou parcial do produto"),
      tipo: z.string().optional().describe("Tipo do vinho: TINTO, BRANCO, ROSE, ESPUMANTE"),
      pais: z.string().optional().describe("País de origem (ex: Brasil, Argentina, França)"),
      limite: z.number().int().min(1).max(100).default(20).describe("Máximo de resultados (padrão: 20)"),
    },
    async ({ nome, tipo, pais, limite }) => {
      try {
        const { data: produtos } = await storage.getProducts(
          { name: nome, type: tipo, country: pais },
          1,
          limite,
        );

        if (!produtos.length) {
          return { content: [{ type: "text", text: "Nenhum produto encontrado com os filtros informados." }] };
        }

        const resumo = produtos.map((p: any) => ({
          id: p.id,
          nome: p.name,
          tipo: p.type,
          pais: p.country,
          volume: p.volume,
          precoNegociado: p.negotiatedPrice,
          sincronizadoBling: !!p.blingProductId,
          temPerfilIA: !!p.aiProfile,
          imagemUrl: p.imageUrl,
        }));

        return {
          content: [{
            type: "text",
            text: `${resumo.length} produto(s) encontrado(s):\n\n${JSON.stringify(resumo, null, 2)}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar produtos: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 9: clientes_inativos
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "clientes_inativos",
    `Retorna clientes que não realizaram nenhuma compra (Bling ou Connect) há mais
de X dias. Útil para identificar clientes em risco de churn e priorizar ações
de reativação. Retorna nome, telefone, cidade, categoria, vendedor responsável,
data da última compra e total gasto.`,
    {
      diasSemCompra: z.number().int().min(1).default(90).describe("Número mínimo de dias sem compra (padrão: 90)"),
      vendedorId: z.string().uuid().optional().describe("Filtrar por vendedor responsável (UUID)"),
      categoria: z.string().optional().describe("Filtrar por categoria do cliente (A, B, C, D)"),
      limite: z.number().int().min(1).max(200).default(50).describe("Máximo de resultados (padrão: 50)"),
    },
    async ({ diasSemCompra, vendedorId, categoria, limite }) => {
      try {
        const vendedorFilter = vendedorId
          ? `AND c.responsavel_id = '${vendedorId}'`
          : "";
        const categoriaFilter = categoria
          ? `AND UPPER(c.categoria) = '${categoria.toUpperCase()}'`
          : "";

        const result = await db.execute(sql.raw(`
          WITH ultima_compra AS (
            SELECT app_client_id, MAX(sale_date) AS ultima_data, SUM(total_value) AS total_gasto
            FROM bling_orders
            WHERE deleted_at IS NULL AND app_client_id IS NOT NULL
            GROUP BY app_client_id

            UNION ALL

            SELECT app_client_id, MAX(sale_date)::text AS ultima_data,
              SUM(NULLIF(total_value, 'NaN'::numeric)) AS total_gasto
            FROM connect_orders
            WHERE app_client_id IS NOT NULL
            GROUP BY app_client_id
          ),
          ultima_compra_agrupada AS (
            SELECT app_client_id,
              MAX(ultima_data) AS ultima_compra,
              SUM(total_gasto) AS total_gasto
            FROM ultima_compra
            GROUP BY app_client_id
          )
          SELECT
            c.id,
            c.name AS nome,
            c.phone AS telefone,
            c.email,
            c.city AS cidade,
            c.state AS estado,
            c.categoria,
            u.name AS vendedor,
            uc.ultima_compra,
            ROUND(uc.total_gasto, 2) AS total_gasto,
            (CURRENT_DATE - uc.ultima_compra::date) AS dias_sem_compra
          FROM clients c
          INNER JOIN ultima_compra_agrupada uc ON uc.app_client_id = c.id
          LEFT JOIN users u ON u.id = c.responsavel_id
          WHERE (CURRENT_DATE - uc.ultima_compra::date) >= ${diasSemCompra}
            ${vendedorFilter}
            ${categoriaFilter}
          ORDER BY uc.ultima_compra ASC
          LIMIT ${limite}
        `));

        const rows = result.rows as Record<string, unknown>[];

        if (!rows.length) {
          return {
            content: [{
              type: "text",
              text: `Nenhum cliente inativo há mais de ${diasSemCompra} dias encontrado.`,
            }],
          };
        }

        return {
          content: [{
            type: "text",
            text: `${rows.length} cliente(s) sem compra há mais de ${diasSemCompra} dias:\n\n${JSON.stringify(rows, null, 2)}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Erro ao buscar clientes inativos: ${err.message}` }] };
      }
    },
  );

  // ───────────────────────────────────────────────────────────────────────────
  // FERRAMENTA 10: resumo_vendedor
  // ───────────────────────────────────────────────────────────────────────────
  server.tool(
    "resumo_vendedor",
    `Retorna o resumo de performance de vendas de um ou todos os vendedores em um
período. Inclui total vendido, número de pedidos, ticket médio, top produtos,
top clientes e comparativo com período anterior. Se vendedorId não for informado,
retorna o consolidado de toda a equipe.`,
    {
      dataInicio: z.string().optional().describe("Data de início no formato YYYY-MM-DD (padrão: início do mês atual)"),
      dataFim: z.string().optional().describe("Data de fim no formato YYYY-MM-DD (padrão: hoje)"),
      vendedorId: z.string().uuid().optional().describe("ID do vendedor para filtrar (UUID). Se omitido, retorna toda a equipe."),
    },
    async ({ dataInicio, dataFim, vendedorId }) => {
      try {
        const data = await getAggregateDashboard(dataInicio, dataFim, {
          requestUserId: undefined,
          requestUserRole: "admin",
          filterUserId: vendedorId,
          filters: {},
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
// Handler HTTP — POST /api/mcp
// Modo stateless: cada requisição cria uma instância independente do McpServer.
// ─────────────────────────────────────────────────────────────────────────────

mcpRouter.post("/", async (req: Request, res: Response) => {
  if (!requireMcpApiKey(req, res)) return;

  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[MCP] Erro ao processar requisição:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erro interno no servidor MCP." });
    }
  }
});

// GET /api/mcp — informações sobre o servidor (sem autenticação)
mcpRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "VinoCRM B2C — Servidor MCP",
    version: "1.0.0",
    protocol: "Model Context Protocol (MCP) via Streamable HTTP",
    endpoint: "POST /api/mcp",
    autenticacao: "API key via header 'Authorization: Bearer <key>' ou 'x-api-key: <key>'",
    ferramentas: [
      { nome: "buscar_cliente", descricao: "Busca clientes por nome, CPF, telefone ou ID" },
      { nome: "historico_pedidos", descricao: "Pedidos Bling + Connect de um cliente" },
      { nome: "perfil_de_vinho", descricao: "Perfil de preferências de vinho gerado por IA" },
      { nome: "saldo_cashback", descricao: "Saldo e histórico de transações de cashback" },
      { nome: "mix_de_produtos", descricao: "Produtos comprados, frequência e valor por cliente" },
      { nome: "metricas_de_compra", descricao: "Ticket médio, frequência, previsão de próxima compra" },
      { nome: "buscar_pedidos", descricao: "Pedidos filtrados por período, cliente ou vendedor" },
      { nome: "buscar_produtos", descricao: "Catálogo de produtos com tipo, país e preço" },
      { nome: "clientes_inativos", descricao: "Clientes sem compra há mais de X dias" },
      { nome: "resumo_vendedor", descricao: "Performance de vendas de um vendedor por período" },
    ],
    documentacao: "https://modelcontextprotocol.io",
  });
});
