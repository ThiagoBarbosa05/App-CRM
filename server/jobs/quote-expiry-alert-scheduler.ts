import cron from "node-cron";
import { db } from "server/db";
import { quotes, callNotifications } from "../../shared/schema";
import { and, inArray, isNotNull, lte, gte, isNull, or } from "drizzle-orm";
import { sql } from "drizzle-orm";

/**
 * Identifica orçamentos com status "sent" ou "draft" cujo validUntil está
 * entre hoje e D+2 e cria uma notificação no CRM para o vendedor responsável.
 *
 * Usa callNotifications (sistema existente) para que os alertas apareçam
 * no sino/notificações da interface, sem precisar de novos canais.
 *
 * Deduplicação simples: a mensagem contém o id do orçamento + data de
 * expiração; não reenvia na mesma janela de 24h procurando por registros
 * recentes com o mesmo texto.
 */
async function alertExpiringQuotes(): Promise<void> {
  console.log("[QuoteExpiry] Verificando orçamentos prestes a vencer...");

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + 2);
    deadline.setHours(23, 59, 59, 999);

    // ISO date strings (YYYY-MM-DD) para comparação com coluna type "date"
    const todayStr = today.toISOString().slice(0, 10);
    const deadlineStr = deadline.toISOString().slice(0, 10);

    // Busca orçamentos enviados/rascunho que vencem nos próximos 2 dias
    const expiringQuotes = await db
      .select({
        id: quotes.id,
        quoteNumber: quotes.quoteNumber,
        clientName: quotes.clientName,
        validUntil: quotes.validUntil,
        assignedToId: quotes.assignedToId,
        createdById: quotes.createdById,
        status: quotes.status,
      })
      .from(quotes)
      .where(
        and(
          inArray(quotes.status, ["sent", "draft"]),
          isNotNull(quotes.validUntil),
          // valid_until >= hoje
          sql`${quotes.validUntil} >= ${todayStr}`,
          // valid_until <= hoje + 2 dias
          sql`${quotes.validUntil} <= ${deadlineStr}`,
        ),
      );

    if (expiringQuotes.length === 0) {
      console.log("[QuoteExpiry] Nenhum orçamento prestes a vencer encontrado.");
      return;
    }

    console.log(
      `[QuoteExpiry] ${expiringQuotes.length} orçamento(s) prestes a vencer encontrado(s).`,
    );

    let notificationsCreated = 0;
    let skipped = 0;

    for (const quote of expiringQuotes) {
      const recipientId = quote.assignedToId ?? quote.createdById;
      if (!recipientId) {
        skipped++;
        continue;
      }

      const expiryLabel = quote.validUntil ?? "sem data";
      const notificationMessage = `Orçamento ${quote.quoteNumber}${quote.clientName ? ` para ${quote.clientName}` : ""} vence em ${expiryLabel}. Faça o follow-up agora!`;

      // Deduplicação: verifica se já existe notificação nas últimas 24h com
      // o mesmo texto para evitar spam em execuções repetidas (dev) ou retry.
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: callNotifications.id })
        .from(callNotifications)
        .where(
          and(
            sql`${callNotifications.userId} = ${recipientId}`,
            sql`${callNotifications.message} = ${notificationMessage}`,
            sql`${callNotifications.createdAt} >= ${cutoff.toISOString()}`,
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(callNotifications).values({
        userId: recipientId,
        clientId: quote.clientName ? undefined : undefined, // clientId pode ser null
        message: notificationMessage,
      });

      notificationsCreated++;
    }

    console.log(
      `[QuoteExpiry] ${notificationsCreated} notificação(ões) criada(s), ${skipped} ignorada(s) (sem destinatário ou já notificada).`,
    );
  } catch (error) {
    console.error("[QuoteExpiry] Erro ao verificar orçamentos expirando:", error);
  }
}

/**
 * Identifica orçamentos com status "sent" que NÃO têm validUntil e que
 * foram enviados há mais de STALE_DAYS dias sem nenhuma resposta.
 *
 * Como esses orçamentos nunca expiram pelo critério de data, eles ficariam
 * indefinidamente sem follow-up. Este job cria uma notificação para que o
 * vendedor revise a negociação.
 *
 * Configuração: define a variável de ambiente QUOTE_STALE_DAYS (padrão: 7).
 */
const STALE_DAYS = parseInt(process.env.QUOTE_STALE_DAYS ?? "7", 10);

async function alertStaleQuotesWithoutDueDate(): Promise<void> {
  console.log(
    `[QuoteStale] Verificando orçamentos sem data de vencimento enviados há mais de ${STALE_DAYS} dia(s)...`,
  );

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - STALE_DAYS);
    cutoffDate.setHours(23, 59, 59, 999);

    // Orçamentos com status "sent", sem validUntil, atualizados/criados antes do cutoff
    const staleQuotes = await db
      .select({
        id: quotes.id,
        quoteNumber: quotes.quoteNumber,
        clientName: quotes.clientName,
        clientId: quotes.clientId,
        assignedToId: quotes.assignedToId,
        createdById: quotes.createdById,
        updatedAt: quotes.updatedAt,
      })
      .from(quotes)
      .where(
        and(
          inArray(quotes.status, ["sent"]),
          isNull(quotes.validUntil),
          // updatedAt <= cutoff (sem atividade há mais de STALE_DAYS dias)
          sql`${quotes.updatedAt} <= ${cutoffDate.toISOString()}`,
        ),
      );

    if (staleQuotes.length === 0) {
      console.log("[QuoteStale] Nenhum orçamento parado sem data de vencimento encontrado.");
      return;
    }

    console.log(
      `[QuoteStale] ${staleQuotes.length} orçamento(s) parado(s) encontrado(s).`,
    );

    let notificationsCreated = 0;
    let skipped = 0;

    for (const quote of staleQuotes) {
      const recipientId = quote.assignedToId ?? quote.createdById;
      if (!recipientId) {
        skipped++;
        continue;
      }

      const notificationMessage = `Orçamento ${quote.quoteNumber}${quote.clientName ? ` para ${quote.clientName}` : ""} está aguardando resposta há mais de ${STALE_DAYS} dia(s) e não tem data de vencimento. Faça o follow-up!`;

      // Deduplicação: não reenvia dentro de 24h para o mesmo destinatário
      const dedupCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const existing = await db
        .select({ id: callNotifications.id })
        .from(callNotifications)
        .where(
          and(
            sql`${callNotifications.userId} = ${recipientId}`,
            sql`${callNotifications.message} = ${notificationMessage}`,
            sql`${callNotifications.createdAt} >= ${dedupCutoff.toISOString()}`,
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(callNotifications).values({
        userId: recipientId,
        clientId: quote.clientId ?? undefined,
        message: notificationMessage,
      });

      notificationsCreated++;
    }

    console.log(
      `[QuoteStale] ${notificationsCreated} notificação(ões) criada(s), ${skipped} ignorada(s).`,
    );
  } catch (error) {
    console.error("[QuoteStale] Erro ao verificar orçamentos parados sem data de vencimento:", error);
  }
}

/**
 * Roda todos os dias às 8h (horário de São Paulo) para garantir que o
 * vendedor veja o alerta no início do dia útil.
 */
cron.schedule("0 8 * * *", async () => {
  await alertExpiringQuotes();
  await alertStaleQuotesWithoutDueDate();
}, {
  timezone: "America/Sao_Paulo",
});

// Execução inicial ao subir o servidor (útil também para detectar problemas)
Promise.all([alertExpiringQuotes(), alertStaleQuotesWithoutDueDate()])
  .then(() => {
    console.log("[QuoteExpiry] Sistema de alertas de orçamentos iniciado (com vencimento + sem data).");
  })
  .catch((err) => {
    console.error("[QuoteExpiry] Erro na inicialização dos alertas de orçamentos:", err);
  });

export { alertExpiringQuotes, alertStaleQuotesWithoutDueDate };
