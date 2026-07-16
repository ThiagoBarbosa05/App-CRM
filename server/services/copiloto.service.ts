import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "../db";
import {
  copilotoSignals,
  users,
  type CopilotoSignalType,
  type InsertCopilotoSignal,
} from "@shared/schema";
import { generateSuggestionsBatch } from "./copiloto-ai.service";

/**
 * COPILOTO — geração da fila diária de contatos do vendedor.
 *
 * Os sinais são deterministicos: saem de SQL puro sobre pedidos (Bling +
 * Connect), RFM e interações. Nada de IA nesta fase — o vendedor precisa ver o
 * número que gerou o card para confiar nele. A IA entra na Fase 2, apenas para
 * redigir a mensagem e a justificativa em cima destes mesmos sinais.
 */

/** Máximo de cards entregues por vendedor por dia. Fila infinita é fila ignorada. */
const MAX_CARDS_PER_SELLER = 15;

/**
 * Sinais que morrem numa data em vez de esperar a próxima varredura.
 *
 * Um ciclo vencido continua vencido amanhã; um aniversário, não. Se o card do
 * aniversário perde a vez hoje, ele não "volta depois" — a data passa, o sinal
 * deixa de ser gerado e o contato simplesmente não aconteceu. Por isso estes
 * tipos ganham tratamento próprio no corte e no dedup abaixo.
 */
const TIME_BOUND_TYPES = new Set<CopilotoSignalType>(["aniversario"]);

/**
 * Slots do teto diário garantidos a sinais com data marcada.
 *
 * O score não é comparável entre tipos: aniversário tem teto de ~1.100
 * (500 + proximidade + 30% do ticket), enquanto ciclo vencido vale até 3x o
 * ticket médio e campeão silencioso soma 5% de todo o histórico do cliente —
 * um campeão de R$200k pontua 10.000+. Ordenando só por score, qualquer
 * vendedor com 15 cards de ticket alto empurra todo aniversário para o backlog,
 * e como a varredura recria a fila todo dia, ele fica lá até a data passar. O
 * vendedor nunca veria o card. A reserva vale só quando há disputa: com poucos
 * candidatos, todos entram normalmente.
 */
const RESERVED_TIME_BOUND_SLOTS = 3;

/** Não repetir um card do mesmo tipo para o mesmo cliente dentro destas janelas. */
const COOLDOWN_DAYS = {
  done: 15,
  dismissed: 30,
} as const;

const CYCLE_OVERDUE_FACTOR = 1.3;
const PRODUCT_ABANDON_FACTOR = 2;
const CHAMPION_SILENCE_DAYS = 30;
const BIRTHDAY_LOOKAHEAD_DAYS = 6;

/**
 * Evidência mínima para afirmar um ritmo de compra.
 *
 * Sem isto, dois pedidos feitos na mesma semana viram "compra a cada 5 dias" e
 * o cliente aparece como 40x atrasado — número absurdo que destrói a confiança
 * do vendedor na fila. Só falamos em ciclo com 3+ compras espalhadas por 60+
 * dias; abaixo disso o histórico é um surto, não uma cadência.
 */
const MIN_ORDERS_FOR_CYCLE = 3;
const MIN_SPAN_DAYS_FOR_CYCLE = 60;

/** Mesma lógica para produto: exige recorrência espalhada e ausência relevante. */
const MIN_PRODUCT_SPAN_DAYS = 45;
const MIN_PRODUCT_ABSENCE_DAYS = 45;

export interface CopilotoSignalCandidate {
  clientId: string;
  sellerId: string;
  type: CopilotoSignalType;
  score: number;
  estimatedValue: number;
  reason: string;
  payload: Record<string, unknown>;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Pedidos unificados Bling + Connect. Mesma união usada por rfm.service.ts:
 * bling.sale_date é texto 'YYYY-MM-DD', connect.sale_date é date. O NULLIF em
 * 'NaN' protege contra valores corrompidos vindos da importação do Connect.
 */
const unifiedOrders = sql`
  SELECT app_client_id AS client_id,
         id::text AS order_id,
         TO_DATE(sale_date, 'YYYY-MM-DD') AS order_date,
         COALESCE(NULLIF(total_value, 'NaN'::numeric), 0) AS total_value
  FROM bling_orders
  WHERE deleted_at IS NULL AND app_client_id IS NOT NULL
  UNION ALL
  SELECT app_client_id AS client_id,
         id::text AS order_id,
         sale_date::date AS order_date,
         COALESCE(NULLIF(total_value, 'NaN'::numeric), 0) AS total_value
  FROM connect_orders
  WHERE app_client_id IS NOT NULL
`;

/**
 * Estatísticas de compra por cliente. O ciclo médio entre compras é derivado de
 * (última - primeira) / (nº de compras - 1), equivalente à média dos intervalos
 * e calculável em uma única passada — ao contrário do laço em memória feito por
 * client-purchase-insights.service.ts para um cliente só.
 */
const clientStats = sql`
  SELECT client_id,
         MIN(order_date) AS first_purchase,
         MAX(order_date) AS last_purchase,
         COUNT(*)::int AS order_count,
         COALESCE(SUM(total_value), 0) AS total_spent,
         COALESCE(AVG(total_value), 0) AS avg_ticket
  FROM (${unifiedOrders}) AS o
  GROUP BY client_id
`;

/** Sinal 1 — o cliente furou o próprio ciclo de recompra. */
async function findOverdueCycle(): Promise<CopilotoSignalCandidate[]> {
  const result = await db.execute(sql`
    WITH stats AS (${clientStats})
    SELECT c.id AS client_id,
           c.name AS client_name,
           c.responsavel_id AS seller_id,
           s.order_count,
           s.total_spent::text AS total_spent,
           s.avg_ticket::text AS avg_ticket,
           (CURRENT_DATE - s.last_purchase)::int AS days_since,
           ROUND((s.last_purchase - s.first_purchase)::numeric
                 / NULLIF(s.order_count - 1, 0))::int AS cycle_days
    FROM stats s
    INNER JOIN clients c ON c.id = s.client_id
    WHERE c.responsavel_id IS NOT NULL
      AND s.order_count >= ${MIN_ORDERS_FOR_CYCLE}
      AND (s.last_purchase - s.first_purchase) >= ${MIN_SPAN_DAYS_FOR_CYCLE}
      AND (CURRENT_DATE - s.last_purchase)::numeric >
          ((s.last_purchase - s.first_purchase)::numeric
            / (s.order_count - 1)) * ${CYCLE_OVERDUE_FACTOR}
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const cycleDays = toNumber(row.cycle_days);
    const daysSince = toNumber(row.days_since);
    const avgTicket = toNumber(row.avg_ticket);
    const daysLate = daysSince - cycleDays;
    // Atraso relativo ao próprio ciclo do cliente: 30 dias de atraso pesam mais
    // para quem compra a cada 20 dias do que para quem compra a cada 180.
    const overdueRatio = cycleDays > 0 ? daysSince / cycleDays : 1;

    return {
      clientId: String(row.client_id),
      sellerId: String(row.seller_id),
      type: "ciclo_vencido" as const,
      score: Math.round(avgTicket * Math.min(overdueRatio, 3)),
      estimatedValue: avgTicket,
      reason:
        `Compra a cada ${cycleDays} dias — está há ${daysSince}. ` +
        `Ticket médio ${formatBRL(avgTicket)}.`,
      payload: {
        clientName: String(row.client_name ?? ""),
        cycleDays,
        daysSince,
        daysLate,
        orderCount: toNumber(row.order_count),
        totalSpent: toNumber(row.total_spent),
        avgTicket,
      },
    };
  });
}

/**
 * Sinal 2 — produto que o cliente comprava com recorrência e abandonou.
 *
 * Agrupa por código do produto (com fallback na descrição). Não usa o casamento
 * por similaridade trigram de client-purchase-insights.service.ts: aquilo é
 * aceitável para um cliente sob demanda, mas inviável varrendo a base inteira.
 * DISTINCT ON entrega só o produto mais relevante de cada cliente, para um
 * cliente não ocupar a fila inteira com cards de produto.
 */
async function findAbandonedProducts(): Promise<CopilotoSignalCandidate[]> {
  const result = await db.execute(sql`
    WITH items AS (
      SELECT bo.app_client_id AS client_id,
             COALESCE(NULLIF(TRIM(boi.product_code), ''), TRIM(boi.description)) AS product_key,
             boi.description AS description,
             boi.order_id::text AS order_id,
             COALESCE(NULLIF(boi.quantity, 'NaN'::numeric), 0) AS quantity,
             COALESCE(NULLIF(boi.quantity * boi.value, 'NaN'::numeric), 0) AS line_value,
             TO_DATE(bo.sale_date, 'YYYY-MM-DD') AS order_date
      FROM bling_order_items boi
      INNER JOIN bling_orders bo ON boi.order_id = bo.id
      WHERE bo.deleted_at IS NULL AND bo.app_client_id IS NOT NULL
      UNION ALL
      SELECT co.app_client_id AS client_id,
             COALESCE(NULLIF(TRIM(coi.product_code), ''), TRIM(coi.product_name)) AS product_key,
             coi.product_name AS description,
             coi.order_id::text AS order_id,
             COALESCE(NULLIF(coi.quantity, 'NaN'::numeric), 0) AS quantity,
             COALESCE(NULLIF(coi.quantity * coi.unit_value, 'NaN'::numeric), 0) AS line_value,
             co.sale_date::date AS order_date
      FROM connect_order_items coi
      INNER JOIN connect_orders co ON coi.order_id = co.id
      WHERE co.app_client_id IS NOT NULL
    ),
    per_product AS (
      SELECT client_id,
             product_key,
             MAX(description) AS description,
             COUNT(DISTINCT order_id)::int AS times_bought,
             COALESCE(SUM(quantity), 0) AS total_qty,
             COALESCE(SUM(line_value), 0) AS total_value,
             MIN(order_date) AS first_bought,
             MAX(order_date) AS last_bought
      FROM items
      WHERE client_id IS NOT NULL
        AND product_key IS NOT NULL
        AND product_key <> ''
      GROUP BY client_id, product_key
    )
    SELECT DISTINCT ON (p.client_id)
           p.client_id,
           c.name AS client_name,
           c.responsavel_id AS seller_id,
           p.description,
           p.times_bought,
           p.total_qty::text AS total_qty,
           p.total_value::text AS total_value,
           (CURRENT_DATE - p.last_bought)::int AS days_since,
           ROUND((p.last_bought - p.first_bought)::numeric
                 / NULLIF(p.times_bought - 1, 0))::int AS cycle_days
    FROM per_product p
    INNER JOIN clients c ON c.id = p.client_id
    WHERE c.responsavel_id IS NOT NULL
      AND p.times_bought >= 2
      AND (p.last_bought - p.first_bought) >= ${MIN_PRODUCT_SPAN_DAYS}
      AND (CURRENT_DATE - p.last_bought) >= ${MIN_PRODUCT_ABSENCE_DAYS}
      AND (CURRENT_DATE - p.last_bought)::numeric >
          ((p.last_bought - p.first_bought)::numeric
            / (p.times_bought - 1)) * ${PRODUCT_ABANDON_FACTOR}
    ORDER BY p.client_id, p.total_value DESC
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const daysSince = toNumber(row.days_since);
    const timesBought = toNumber(row.times_bought);
    const totalQty = toNumber(row.total_qty);
    const totalValue = toNumber(row.total_value);
    const description = String(row.description ?? "produto");
    // Valor de uma "rodada" típica do produto: o que ele gastava por compra.
    const valuePerPurchase = timesBought > 0 ? totalValue / timesBought : 0;

    return {
      clientId: String(row.client_id),
      sellerId: String(row.seller_id),
      type: "produto_abandonado" as const,
      score: Math.round(valuePerPurchase * Math.min(timesBought, 6)),
      estimatedValue: valuePerPurchase,
      reason:
        `Comprava ${description} (${timesBought}x, ${Math.round(totalQty)} grf) ` +
        `e parou há ${daysSince} dias.`,
      payload: {
        clientName: String(row.client_name ?? ""),
        product: description,
        timesBought,
        totalQty,
        totalValue,
        daysSince,
        cycleDays: toNumber(row.cycle_days),
      },
    };
  });
}

/**
 * Sinal 3 — aniversário nos próximos 7 dias.
 *
 * clients.birthday é texto em dois formatos históricos ('YYYY-MM-DD' e
 * 'DD/MM/YYYY'), os mesmos tratados por birthdays.service.ts. A comparação é
 * feita por 'MM-DD' contra os próximos dias gerados por generate_series, o que
 * resolve a virada de ano sem caso especial.
 */
async function findBirthdays(): Promise<CopilotoSignalCandidate[]> {
  const result = await db.execute(sql`
    WITH upcoming AS (
      SELECT TO_CHAR(CURRENT_DATE + i, 'MM-DD') AS md,
             i AS days_ahead
      FROM generate_series(0, ${BIRTHDAY_LOOKAHEAD_DAYS}) AS i
    ),
    stats AS (${clientStats})
    SELECT c.id AS client_id,
           c.name AS client_name,
           c.responsavel_id AS seller_id,
           u.days_ahead,
           COALESCE(s.avg_ticket, 0)::text AS avg_ticket,
           COALESCE(s.order_count, 0) AS order_count
    FROM clients c
    INNER JOIN upcoming u ON u.md = CASE
      WHEN c.birthday ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN SUBSTRING(c.birthday FROM 6 FOR 5)
      WHEN c.birthday ~ '^\\d{2}/\\d{2}/\\d{4}$'
        THEN SUBSTRING(c.birthday FROM 4 FOR 2) || '-' || SUBSTRING(c.birthday FROM 1 FOR 2)
    END
    LEFT JOIN stats s ON s.client_id = c.id
    WHERE c.responsavel_id IS NOT NULL
      AND c.birthday IS NOT NULL
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const daysAhead = toNumber(row.days_ahead);
    const avgTicket = toNumber(row.avg_ticket);
    const orderCount = toNumber(row.order_count);
    const quando =
      daysAhead === 0
        ? "hoje"
        : daysAhead === 1
          ? "amanhã"
          : `em ${daysAhead} dias`;
    const historico =
      orderCount > 0
        ? ` Ticket médio ${formatBRL(avgTicket)}.`
        : " Ainda sem compras registradas.";

    return {
      clientId: String(row.client_id),
      sellerId: String(row.seller_id),
      type: "aniversario" as const,
      // Aniversário tem data marcada: quanto mais perto, mais urgente. O piso
      // garante que ele não seja soterrado por cards de ticket alto.
      score: Math.round(500 + (BIRTHDAY_LOOKAHEAD_DAYS - daysAhead) * 100 + avgTicket * 0.3),
      estimatedValue: avgTicket,
      reason: `Faz aniversário ${quando}.${historico}`,
      payload: {
        clientName: String(row.client_name ?? ""),
        daysAhead,
        avgTicket,
        orderCount,
      },
    };
  });
}

/** Sinal 4 — campeão (RFM) sem nenhuma interação registrada há 30+ dias. */
async function findSilentChampions(): Promise<CopilotoSignalCandidate[]> {
  const result = await db.execute(sql`
    WITH stats AS (${clientStats})
    SELECT c.id AS client_id,
           c.name AS client_name,
           c.responsavel_id AS seller_id,
           COALESCE(s.total_spent, 0)::text AS total_spent,
           COALESCE(s.avg_ticket, 0)::text AS avg_ticket,
           COALESCE(s.order_count, 0) AS order_count,
           li.last_interaction,
           CASE
             WHEN li.last_interaction IS NULL THEN NULL
             ELSE (CURRENT_DATE - li.last_interaction::date)::int
           END AS days_since_contact
    FROM clients c
    LEFT JOIN stats s ON s.client_id = c.id
    LEFT JOIN LATERAL (
      SELECT MAX(ci.date) AS last_interaction
      FROM client_interactions ci
      WHERE ci.client_id = c.id
    ) li ON TRUE
    WHERE c.responsavel_id IS NOT NULL
      AND c.rfm_segment = 'campiao'
      AND (
        li.last_interaction IS NULL
        OR li.last_interaction < now() - (${CHAMPION_SILENCE_DAYS} || ' days')::interval
      )
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const totalSpent = toNumber(row.total_spent);
    const avgTicket = toNumber(row.avg_ticket);
    const orderCount = toNumber(row.order_count);
    const daysSinceContact =
      row.days_since_contact === null ? null : toNumber(row.days_since_contact);
    const contato =
      daysSinceContact === null
        ? "Nunca teve contato registrado."
        : `Sem contato há ${daysSinceContact} dias.`;

    return {
      clientId: String(row.client_id),
      sellerId: String(row.seller_id),
      type: "campeao_silencioso" as const,
      // Campeão é o ativo mais caro de perder: pesa o histórico total, não o
      // ticket de uma compra.
      score: Math.round(avgTicket + totalSpent * 0.05),
      estimatedValue: avgTicket,
      reason: `Campeão. ${contato} Já comprou ${formatBRL(totalSpent)} em ${orderCount} pedidos.`,
      payload: {
        clientName: String(row.client_name ?? ""),
        totalSpent,
        avgTicket,
        orderCount,
        daysSinceContact,
      },
    };
  });
}

/**
 * Pares cliente+tipo que não devem gerar card novo agora: em soneca, recusados
 * há pouco ou já trabalhados há pouco. É o que impede o Copiloto de reoferecer
 * amanhã o card que o vendedor acabou de resolver ou recusar.
 */
async function loadCooldownKeys(): Promise<Set<string>> {
  const result = await db.execute(sql`
    SELECT DISTINCT client_id, type
    FROM copiloto_signals
    WHERE (status = 'snoozed' AND snoozed_until > now())
       OR (status = 'dismissed'
           AND generated_at > now() - (${COOLDOWN_DAYS.dismissed} || ' days')::interval)
       OR (status = 'done'
           AND acted_at > now() - (${COOLDOWN_DAYS.done} || ' days')::interval)
  `);

  return new Set(
    (result.rows as Record<string, unknown>[]).map(
      (row) => `${String(row.client_id)}:${String(row.type)}`,
    ),
  );
}

/** Faixa factual do card: com quem o vendedor está falando, sem interpretação. */
export interface ClientFacts {
  firstPurchaseYear: number | null;
  orderCount: number;
  totalSpent: number;
  /** Rótulos mais levados, por garrafa. */
  topProducts: string[];
}

const TOP_PRODUCTS_PER_CLIENT = 3;

/**
 * Fatos de relacionamento dos clientes já selecionados para a fila.
 *
 * Usa o NOME do produto vindo da descrição do item do pedido, e nunca a tabela
 * `products`: `products.type` classifica arroz, açúcar e balde de acrílico como
 * TINTO, e `country`/`winery` estão vazios na maior parte do catálogo. Nome de
 * item de pedido é confiável; atributo de produto não é. Por isso a faixa
 * mostra rótulos e deixa a conclusão sobre gosto com o vendedor.
 */
async function loadClientFacts(clientIds: string[]): Promise<Map<string, ClientFacts>> {
  if (clientIds.length === 0) return new Map();

  const idList = sql.join(
    clientIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const result = await db.execute(sql`
    WITH stats AS (
      SELECT client_id,
             MIN(order_date) AS first_purchase,
             COUNT(*)::int AS order_count,
             COALESCE(SUM(total_value), 0) AS total_spent
      FROM (${unifiedOrders}) AS o
      WHERE client_id IN (${idList})
      GROUP BY client_id
    ),
    items AS (
      SELECT bo.app_client_id AS client_id,
             COALESCE(NULLIF(TRIM(boi.product_code), ''), TRIM(boi.description)) AS product_key,
             boi.description AS description,
             COALESCE(NULLIF(boi.quantity * boi.value, 'NaN'::numeric), 0) AS line_value
      FROM bling_order_items boi
      INNER JOIN bling_orders bo ON boi.order_id = bo.id
      WHERE bo.deleted_at IS NULL AND bo.app_client_id IN (${idList})
      UNION ALL
      SELECT co.app_client_id AS client_id,
             COALESCE(NULLIF(TRIM(coi.product_code), ''), TRIM(coi.product_name)) AS product_key,
             coi.product_name AS description,
             COALESCE(NULLIF(coi.quantity * coi.unit_value, 'NaN'::numeric), 0) AS line_value
      FROM connect_order_items coi
      INNER JOIN connect_orders co ON coi.order_id = co.id
      WHERE co.app_client_id IN (${idList})
    ),
    -- Ordena por VALOR, não por quantidade: minis de 187ml comprados em fardo
    -- (brinde de evento) enterram o que o cliente realmente bebe. No maior
    -- cliente da base, por quantidade o topo é mini de 187ml; por valor é o
    -- champagne que ele compra há anos — e que o sinal de produto abandonado
    -- já aponta.
    ranked AS (
      SELECT client_id,
             MAX(description) AS description,
             ROW_NUMBER() OVER (
               PARTITION BY client_id ORDER BY SUM(line_value) DESC, MAX(description)
             ) AS rn
      FROM items
      WHERE product_key IS NOT NULL AND product_key <> ''
      GROUP BY client_id, product_key
    )
    SELECT s.client_id,
           EXTRACT(YEAR FROM s.first_purchase)::int AS first_year,
           s.order_count,
           s.total_spent::text AS total_spent,
           COALESCE(
             ARRAY_AGG(r.description ORDER BY r.rn) FILTER (WHERE r.description IS NOT NULL),
             '{}'
           ) AS top_products
    FROM stats s
    LEFT JOIN ranked r
      ON r.client_id = s.client_id AND r.rn <= ${TOP_PRODUCTS_PER_CLIENT}
    GROUP BY s.client_id, s.first_purchase, s.order_count, s.total_spent
  `);

  const facts = new Map<string, ClientFacts>();
  for (const row of result.rows as Record<string, unknown>[]) {
    facts.set(String(row.client_id), {
      firstPurchaseYear: row.first_year === null ? null : toNumber(row.first_year),
      orderCount: toNumber(row.order_count),
      totalSpent: toNumber(row.total_spent),
      topProducts: Array.isArray(row.top_products)
        ? (row.top_products as string[]).filter(Boolean)
        : [],
    });
  }
  return facts;
}

export interface CopilotoScanResult {
  /** Cards visíveis na fila (`pending`). */
  generated: number;
  /** Guardados acima do teto, disponíveis via "Carregar mais". */
  backlogged: number;
  skippedByCooldown: number;
  dedupedByClient: number;
  /** Cards que receberam redação da IA. O restante exibe só o motivo determinístico. */
  withAiMessage: number;
  byType: Record<string, number>;
  sellers: number;
}

/**
 * Qual sinal representa o cliente quando ele dispara mais de um.
 *
 * Sinal com data marcada ganha do de maior score, e não é desempate arbitrário:
 * o vendedor vai fazer um contato só, e o aniversário é o único pretexto que
 * expira. Ligar hoje falando do aniversário não perde nada — se o cliente
 * também está com o ciclo vencido, esse card volta na próxima varredura com o
 * mesmo número. O inverso não é verdade: a data passa e não volta.
 */
function beatsForClient(
  candidate: CopilotoSignalCandidate,
  current: CopilotoSignalCandidate,
): boolean {
  const candidateTimeBound = TIME_BOUND_TYPES.has(candidate.type);
  const currentTimeBound = TIME_BOUND_TYPES.has(current.type);
  if (candidateTimeBound !== currentTimeBound) return candidateTimeBound;
  return candidate.score > current.score;
}

export interface SellerQueues {
  selected: CopilotoSignalCandidate[];
  backlog: CopilotoSignalCandidate[];
  dedupedByClient: number;
  /** Vendedores que receberam ao menos um candidato. */
  sellers: number;
}

/**
 * Reparte os candidatos elegíveis em fila visível e backlog, por vendedor.
 *
 * É a regra que decide o que o vendedor vê no dia; fica pura e exportada para
 * poder ser testada sem banco.
 */
export function buildSellerQueues(
  eligible: CopilotoSignalCandidate[],
): SellerQueues {
  const bySeller = new Map<string, CopilotoSignalCandidate[]>();
  for (const candidate of eligible) {
    const current = bySeller.get(candidate.sellerId) ?? [];
    current.push(candidate);
    bySeller.set(candidate.sellerId, current);
  }

  const selected: CopilotoSignalCandidate[] = [];
  const backlog: CopilotoSignalCandidate[] = [];
  let dedupedByClient = 0;

  for (const sellerCandidates of Array.from(bySeller.values())) {
    // Um card por cliente: o vendedor faz uma ligação, não uma por sinal. Um
    // cliente que dispara ciclo vencido + produto abandonado + campeão em
    // silêncio ocuparia três slots para o mesmo telefonema.
    const bestPerClient = new Map<string, CopilotoSignalCandidate>();
    for (const candidate of sellerCandidates) {
      const current = bestPerClient.get(candidate.clientId);
      if (!current) {
        bestPerClient.set(candidate.clientId, candidate);
        continue;
      }
      if (beatsForClient(candidate, current)) {
        bestPerClient.set(candidate.clientId, candidate);
      }
      dedupedByClient++;
    }

    const strongestPerClient = Array.from(bestPerClient.values()).sort(
      (left, right) => right.score - left.score,
    );

    // Garante a vez dos sinais com data marcada antes de preencher o resto por
    // score. Os excedentes seguem em `remainder`, na disputa normal: reserva
    // ociosa não pode roubar slot de quem pontuou.
    const reserved = strongestPerClient
      .filter((candidate) => TIME_BOUND_TYPES.has(candidate.type))
      .slice(0, RESERVED_TIME_BOUND_SLOTS);
    const reservedSet = new Set(reserved);
    const remainder = strongestPerClient.filter(
      (candidate) => !reservedSet.has(candidate),
    );

    // O teto limita o que aparece de uma vez, não o que o vendedor pode fazer
    // no dia: o excedente vira backlog e o botão "Carregar mais" o promove.
    const sellerSelected = [...reserved, ...remainder].slice(
      0,
      MAX_CARDS_PER_SELLER,
    );
    const selectedSet = new Set(sellerSelected);

    selected.push(...sellerSelected);
    backlog.push(
      ...strongestPerClient.filter((candidate) => !selectedSet.has(candidate)),
    );
  }

  return { selected, backlog, dedupedByClient, sellers: bySeller.size };
}

/**
 * Varre a base e regenera a fila. Idempotente: apaga os cards `pending` (que
 * ninguém tocou) e reinsere a partir do estado atual dos dados. Cards já
 * trabalhados pelo vendedor nunca são apagados — viram histórico e cooldown.
 */
export async function scanCopilotoSignals(
  options: { withAi?: boolean } = {},
): Promise<CopilotoScanResult> {
  const withAi = options.withAi ?? Boolean(process.env.OPENAI_API_KEY);

  const [overdue, abandoned, birthdays, champions, cooldownKeys, sellerRows] =
    await Promise.all([
      findOverdueCycle(),
      findAbandonedProducts(),
      findBirthdays(),
      findSilentChampions(),
      loadCooldownKeys(),
      db.select({ id: users.id, name: users.name }).from(users),
    ]);

  const sellerNames = new Map(sellerRows.map((row) => [row.id, row.name]));

  const candidates = [...overdue, ...abandoned, ...birthdays, ...champions];

  const eligible = candidates.filter(
    (candidate) => !cooldownKeys.has(`${candidate.clientId}:${candidate.type}`),
  );
  const skippedByCooldown = candidates.length - eligible.length;

  const { selected, backlog, dedupedByClient, sellers } =
    buildSellerQueues(eligible);

  // Fatos para os dois grupos: o card do backlog já nasce completo e a
  // promoção não precisa de outra query. É uma query para ~180 ids.
  const facts = await loadClientFacts(
    Array.from(
      new Set([...selected, ...backlog].map((candidate) => candidate.clientId)),
    ),
  );
  for (const candidate of [...selected, ...backlog]) {
    const clientFacts = facts.get(candidate.clientId);
    if (clientFacts) candidate.payload.facts = clientFacts;
  }

  // Só os 15 visíveis gastam token; o backlog é redigido na promoção, se o
  // vendedor chegar lá. Uma falha aqui não derruba a varredura: o card entra
  // sem mensagem e a página mostra o motivo determinístico.
  const suggestions = withAi
    ? await generateSuggestionsBatch(
        selected.map((candidate) => ({
          clientName: String(candidate.payload.clientName ?? ""),
          sellerName: sellerNames.get(candidate.sellerId) ?? "",
          type: candidate.type,
          reason: candidate.reason,
          payload: candidate.payload,
        })),
      )
    : selected.map(() => null);

  const aiGeneratedAt = new Date();

  const toRow = (
    candidate: CopilotoSignalCandidate,
    status: "pending" | "backlog",
    suggestion: { mensagem: string } | null,
  ): InsertCopilotoSignal => ({
    clientId: candidate.clientId,
    sellerId: candidate.sellerId,
    type: candidate.type,
    score: candidate.score,
    estimatedValue: candidate.estimatedValue.toFixed(2),
    reason: candidate.reason,
    payload: candidate.payload,
    status,
    suggestedMessage: suggestion?.mensagem ?? null,
    aiGeneratedAt: suggestion ? aiGeneratedAt : null,
  });

  const rows: InsertCopilotoSignal[] = [
    ...selected.map((candidate, index) =>
      toRow(candidate, "pending", suggestions[index]),
    ),
    ...backlog.map((candidate) => toRow(candidate, "backlog", null)),
  ];

  // Troca a fila inteira de uma vez. Sem a transação, o DELETE e os INSERTs em
  // lote são operações independentes: um lote que falhe no meio (queda de
  // conexão, timeout) deixaria TODOS os vendedores com a fila apagada ou pela
  // metade até a varredura do dia seguinte — e a fila do dia é o trabalho deles.
  // Aqui, ou a nova fila entra inteira, ou a anterior continua de pé.
  await db.transaction(async (tx) => {
    // Apaga também o backlog: ele é uma fotografia do dia anterior e precisa
    // ser recalculado. Cards já trabalhados (done/snoozed/dismissed) sobrevivem.
    await tx
      .delete(copilotoSignals)
      .where(inArray(copilotoSignals.status, ["pending", "backlog"]));

    // Lotes para não estourar o limite de parâmetros do driver em bases grandes.
    const BATCH_SIZE = 500;
    for (let index = 0; index < rows.length; index += BATCH_SIZE) {
      await tx.insert(copilotoSignals).values(rows.slice(index, index + BATCH_SIZE));
    }
  });

  const byType: Record<string, number> = {};
  for (const candidate of selected) {
    byType[candidate.type] = (byType[candidate.type] ?? 0) + 1;
  }

  return {
    generated: selected.length,
    skippedByCooldown,
    backlogged: backlog.length,
    dedupedByClient,
    withAiMessage: suggestions.filter((suggestion) => suggestion !== null).length,
    byType,
    sellers,
  };
}

export interface CopilotoCard {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string | null;
  rfmSegment: string | null;
  type: CopilotoSignalType;
  score: number;
  estimatedValue: number;
  reason: string;
  payload: Record<string, unknown>;
  suggestedMessage: string | null;
  whatsappOptOut: boolean;
  generatedAt: Date;
}

export interface CopilotoFeed {
  cards: CopilotoCard[];
  totalPotential: number;
  countsByType: Record<string, number>;
  lastScanAt: string | null;
  /** Cards guardados acima do teto, prontos para o "Carregar mais". */
  backlogCount: number;
}

/** Fila pendente de um vendedor, ordenada por score. */
export async function getCopilotoFeed(sellerId: string): Promise<CopilotoFeed> {
  const rows = await db.execute(sql`
    SELECT s.id,
           s.client_id,
           s.type,
           s.score,
           s.estimated_value::text AS estimated_value,
           s.reason,
           s.payload,
           s.suggested_message,
           s.generated_at,
           c.name AS client_name,
           c.phone AS client_phone,
           c.rfm_segment,
           c.whatsapp_opt_out
    FROM copiloto_signals s
    INNER JOIN clients c ON c.id = s.client_id
    WHERE s.seller_id = ${sellerId}
      AND s.status = 'pending'
    ORDER BY s.score DESC
  `);

  const cards: CopilotoCard[] = (rows.rows as Record<string, unknown>[]).map(
    (row) => ({
      id: String(row.id),
      clientId: String(row.client_id),
      clientName: String(row.client_name ?? ""),
      clientPhone: (row.client_phone as string | null) ?? null,
      rfmSegment: (row.rfm_segment as string | null) ?? null,
      type: row.type as CopilotoSignalType,
      score: toNumber(row.score),
      estimatedValue: toNumber(row.estimated_value),
      reason: String(row.reason ?? ""),
      payload: (row.payload as Record<string, unknown> | null) ?? {},
      suggestedMessage: (row.suggested_message as string | null) ?? null,
      whatsappOptOut: Boolean(row.whatsapp_opt_out),
      generatedAt: new Date(String(row.generated_at)),
    }),
  );

  const countsByType: Record<string, number> = {};
  for (const card of cards) {
    countsByType[card.type] = (countsByType[card.type] ?? 0) + 1;
  }

  const [latest] = await db
    .select({ generatedAt: copilotoSignals.generatedAt })
    .from(copilotoSignals)
    .where(eq(copilotoSignals.sellerId, sellerId))
    .orderBy(desc(copilotoSignals.generatedAt))
    .limit(1);

  const [{ count: backlogCount }] = (
    await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM copiloto_signals
      WHERE seller_id = ${sellerId} AND status = 'backlog'
    `)
  ).rows as { count: number }[];

  return {
    cards,
    totalPotential: cards.reduce((sum, card) => sum + card.estimatedValue, 0),
    countsByType,
    lastScanAt: latest?.generatedAt ? latest.generatedAt.toISOString() : null,
    backlogCount: toNumber(backlogCount),
  };
}

/** Quantos cards o "Carregar mais" promove por clique. */
const BACKLOG_PAGE_SIZE = 5;

export interface LoadMoreResult {
  promoted: number;
  remaining: number;
}

/**
 * Promove os próximos cards do backlog para a fila visível e redige a mensagem
 * de cada um (o backlog é gravado sem mensagem para não gastar token com card
 * que talvez ninguém veja).
 *
 * O UPDATE seleciona e promove numa única instrução, com FOR UPDATE SKIP
 * LOCKED: dois cliques simultâneos promovem lotes distintos em vez de brigar
 * pelas mesmas linhas.
 */
export async function loadMoreFromBacklog(
  sellerId: string,
  options: { withAi?: boolean } = {},
): Promise<LoadMoreResult> {
  const withAi = options.withAi ?? Boolean(process.env.OPENAI_API_KEY);

  const promotedRows = await db.execute(sql`
    UPDATE copiloto_signals SET status = 'pending'
    WHERE id IN (
      SELECT id FROM copiloto_signals
      WHERE seller_id = ${sellerId} AND status = 'backlog'
      ORDER BY score DESC
      LIMIT ${BACKLOG_PAGE_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, type, reason, payload
  `);

  const promoted = promotedRows.rows as Record<string, unknown>[];

  if (promoted.length > 0 && withAi) {
    const [seller] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, sellerId))
      .limit(1);

    const suggestions = await generateSuggestionsBatch(
      promoted.map((row) => {
        const payload = (row.payload as Record<string, unknown> | null) ?? {};
        return {
          clientName: String(payload.clientName ?? ""),
          sellerName: seller?.name ?? "",
          type: row.type as CopilotoSignalType,
          reason: String(row.reason ?? ""),
          payload,
        };
      }),
    );

    const now = new Date();
    await Promise.all(
      promoted.map((row, index) => {
        const suggestion = suggestions[index];
        if (!suggestion) return Promise.resolve();
        return db
          .update(copilotoSignals)
          .set({ suggestedMessage: suggestion.mensagem, aiGeneratedAt: now })
          .where(eq(copilotoSignals.id, String(row.id)));
      }),
    );
  }

  const [{ count }] = (
    await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM copiloto_signals
      WHERE seller_id = ${sellerId} AND status = 'backlog'
    `)
  ).rows as { count: number }[];

  return { promoted: promoted.length, remaining: toNumber(count) };
}

export type CopilotoAction = "done" | "snoozed" | "dismissed";

/**
 * Marca o card como trabalhado/adiado/recusado. Só o dono do card pode agir
 * sobre ele — a fila é pessoal, e um vendedor não descarta o card do outro.
 */
export async function actOnSignal(params: {
  signalId: string;
  sellerId: string;
  action: CopilotoAction;
  dismissReason?: string;
  snoozeDays?: number;
}): Promise<boolean> {
  const snoozedUntil =
    params.action === "snoozed"
      ? new Date(Date.now() + (params.snoozeDays ?? 3) * 24 * 60 * 60 * 1000)
      : null;

  const updated = await db
    .update(copilotoSignals)
    .set({
      status: params.action,
      actedAt: new Date(),
      actedBy: params.sellerId,
      dismissReason: params.dismissReason ?? null,
      snoozedUntil,
    })
    .where(
      and(
        eq(copilotoSignals.id, params.signalId),
        eq(copilotoSignals.sellerId, params.sellerId),
        eq(copilotoSignals.status, "pending"),
      ),
    )
    .returning({ id: copilotoSignals.id });

  return updated.length > 0;
}
