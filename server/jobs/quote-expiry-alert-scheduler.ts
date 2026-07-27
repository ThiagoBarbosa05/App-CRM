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
 * Roda todos os dias às 8h (horário de São Paulo) para garantir que o
 * vendedor veja o alerta no início do dia útil.
 */
cron.schedule("0 8 * * *", alertExpiringQuotes, {
  timezone: "America/Sao_Paulo",
});

// Execução inicial ao subir o servidor (útil também para detectar problemas)
alertExpiringQuotes()
  .then(() => {
    console.log("[QuoteExpiry] Sistema de alertas de orçamentos a vencer iniciado.");
  })
  .catch((err) => {
    console.error("[QuoteExpiry] Erro na inicialização do alerta de orçamentos:", err);
  });

export { alertExpiringQuotes };
