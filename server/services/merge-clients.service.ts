import { db } from "../db";
import {
  clients,
  deals,
  cashbackTransactions,
  clientCashbackBalance,
  cashbackUsage,
  clientDebts,
  sales,
  messageJobsLogs,
  blingOrders,
  clientInteractions,
  eventParticipants,
  connectOrders,
  contactTags,
  whatsappConversations,
  blingContactMappings,
  calls,
  callNotifications,
  restaurantOrders,
  smsIndividualMessages,
  automationExecutionLog,
  campaignClients,
  copilotoSignals,
  reengagementProgress,
  zernioConversations,
} from "../../shared/schema";
import { eq, sql, inArray, and } from "drizzle-orm";

/**
 * Unifica dois clientes: mantém `keepId`, reatribui todos os dados de `mergeId`
 * e deleta o cliente duplicado.
 *
 * Retorna o cliente mantido após o merge.
 */
export async function mergeClients(keepId: string, mergeId: string) {
  if (keepId === mergeId) {
    throw new Error("Os dois clientes não podem ser o mesmo.");
  }

  const [keepClient, mergeClient] = await Promise.all([
    db.select().from(clients).where(eq(clients.id, keepId)).limit(1),
    db.select().from(clients).where(eq(clients.id, mergeId)).limit(1),
  ]);

  if (!keepClient[0]) throw new Error("Cliente principal não encontrado.");
  if (!mergeClient[0]) throw new Error("Cliente duplicado não encontrado.");

  const keep = keepClient[0];
  const merge = mergeClient[0];

  // Campos que serão preenchidos com dados do duplicado quando o principal estiver vazio
  const fillFromMerge: Partial<typeof keep> = {};

  // Nome: usa o mais completo (mais longo)
  if (merge.name && merge.name.trim().length > keep.name.trim().length) {
    fillFromMerge.name = merge.name.trim();
  }

  // Contato
  if (!keep.phone && merge.phone) fillFromMerge.phone = merge.phone;
  if (!keep.fixedPhone && merge.fixedPhone) fillFromMerge.fixedPhone = merge.fixedPhone;
  if (!keep.email && merge.email) fillFromMerge.email = merge.email;

  // Documento
  if (!keep.cpf && merge.cpf) fillFromMerge.cpf = merge.cpf;
  if (!keep.cpf && merge.documentType) fillFromMerge.documentType = merge.documentType;

  // Dados pessoais
  if (!keep.birthday && merge.birthday) fillFromMerge.birthday = merge.birthday;
  if (!keep.nomeFantasia && merge.nomeFantasia) fillFromMerge.nomeFantasia = merge.nomeFantasia;
  if (!keep.inscricaoEstadual && merge.inscricaoEstadual) fillFromMerge.inscricaoEstadual = merge.inscricaoEstadual;

  // Endereço
  if (!keep.cep && merge.cep) fillFromMerge.cep = merge.cep;
  if (!keep.address && merge.address) fillFromMerge.address = merge.address;
  if (!keep.number && merge.number) fillFromMerge.number = merge.number;
  if (!keep.neighborhood && merge.neighborhood) fillFromMerge.neighborhood = merge.neighborhood;
  if (!keep.city && merge.city) fillFromMerge.city = merge.city;
  if (!keep.state && merge.state) fillFromMerge.state = merge.state;

  // Classificação
  if (!keep.responsavelId && merge.responsavelId) fillFromMerge.responsavelId = merge.responsavelId;
  if (keep.categoria === "cliente" && merge.categoria && merge.categoria !== "cliente") {
    fillFromMerge.categoria = merge.categoria;
  }
  if (keep.origem === "manual" && merge.origem && merge.origem !== "manual") {
    fillFromMerge.origem = merge.origem;
  }

  // Integrações externas
  if (!keep.umblerContactId && merge.umblerContactId) fillFromMerge.umblerContactId = merge.umblerContactId;
  if (!keep.blingContactId && merge.blingContactId) fillFromMerge.blingContactId = merge.blingContactId;

  // Marcadores: união sem duplicatas
  const mergedMarkers = Array.from(new Set([...keep.markers, ...merge.markers]));

  await db.transaction(async (tx) => {
    // ── 1. Migrar TODAS as referências ao cliente removido ──────────────────
    // Tabelas sem cascade (seriam deixadas com FK quebrada se não migrarmos)
    await tx.update(deals).set({ clientId: keepId }).where(eq(deals.clientId, mergeId));
    await tx.update(cashbackTransactions).set({ clientId: keepId }).where(eq(cashbackTransactions.clientId, mergeId));
    await tx.update(cashbackUsage).set({ clientId: keepId }).where(eq(cashbackUsage.clientId, mergeId));
    await tx.update(clientDebts).set({ clientId: keepId }).where(eq(clientDebts.clientId, mergeId));
    await tx.update(sales).set({ clientId: keepId }).where(eq(sales.clientId, mergeId));
    await tx.update(messageJobsLogs).set({ clientId: keepId }).where(eq(messageJobsLogs.clientId, mergeId));
    await tx.update(blingOrders).set({ appClientId: keepId }).where(eq(blingOrders.appClientId, mergeId));
    await tx.update(connectOrders).set({ appClientId: keepId }).where(eq(connectOrders.appClientId, mergeId));
    await tx.update(whatsappConversations).set({ clientId: keepId }).where(eq(whatsappConversations.clientId, mergeId));

    // Tabelas com cascade ou set null — migrar ANTES do delete para preservar histórico
    await tx.update(clientInteractions).set({ clientId: keepId }).where(eq(clientInteractions.clientId, mergeId));
    await tx.update(eventParticipants).set({ clientId: keepId }).where(eq(eventParticipants.clientId, mergeId));

    // contactTags: buscar quais tags do WhatsApp o cliente mantido já tem, deletar as
    // duplicadas do removido e transferir as restantes (evita violação da constraint única)
    const keepTagRows = await tx
      .select({ whatsappTagId: contactTags.whatsappTagId })
      .from(contactTags)
      .where(eq(contactTags.clientId, keepId));
    const keepTagIds = keepTagRows
      .map((r) => r.whatsappTagId)
      .filter((id): id is string => !!id);

    if (keepTagIds.length > 0) {
      // Deletar do duplicado as tags que o mantido já possui
      await tx.delete(contactTags).where(
        and(
          eq(contactTags.clientId, mergeId),
          inArray(contactTags.whatsappTagId, keepTagIds),
        ),
      );
    }
    // Transferir as tags restantes para o cliente mantido
    await tx.update(contactTags).set({ clientId: keepId }).where(eq(contactTags.clientId, mergeId));

    // ── Tabelas simples (sem constraint unique em clientId) ─────────────────
    await tx.update(calls).set({ clientId: keepId }).where(eq(calls.clientId, mergeId));
    await tx.update(callNotifications).set({ clientId: keepId }).where(eq(callNotifications.clientId, mergeId));
    await tx.update(restaurantOrders).set({ clientId: keepId }).where(eq(restaurantOrders.clientId, mergeId));
    await tx.update(smsIndividualMessages).set({ clientId: keepId }).where(eq(smsIndividualMessages.clientId, mergeId));
    await tx.update(automationExecutionLog).set({ clientId: keepId }).where(eq(automationExecutionLog.clientId, mergeId));
    await tx.update(zernioConversations).set({ clientId: keepId }).where(eq(zernioConversations.clientId, mergeId));
    await tx.update(copilotoSignals).set({ clientId: keepId }).where(eq(copilotoSignals.clientId, mergeId));

    // ── blingContactMappings: unique (connectionId, blingContactId) ─────────
    // Buscar conexões que o cliente mantido já possui mapeadas
    const keepMappingRows = await tx
      .select({ connectionId: blingContactMappings.connectionId, blingContactId: blingContactMappings.blingContactId })
      .from(blingContactMappings)
      .where(eq(blingContactMappings.clientId, keepId));

    if (keepMappingRows.length > 0) {
      // Deletar do removido os mapeamentos que o mantido já possui (evita violação de unique)
      for (const row of keepMappingRows) {
        await tx.delete(blingContactMappings).where(
          and(
            eq(blingContactMappings.clientId, mergeId),
            eq(blingContactMappings.connectionId, row.connectionId),
            eq(blingContactMappings.blingContactId, row.blingContactId),
          ),
        );
      }
    }
    // Transferir os mapeamentos restantes
    await tx.update(blingContactMappings).set({ clientId: keepId }).where(eq(blingContactMappings.clientId, mergeId));

    // ── campaignClients: unique (campaignId, clientId) ──────────────────────
    // Buscar campanhas em que o cliente mantido já está
    const keepCampaignRows = await tx
      .select({ campaignId: campaignClients.campaignId })
      .from(campaignClients)
      .where(eq(campaignClients.clientId, keepId));
    const keepCampaignIds = keepCampaignRows.map((r) => r.campaignId);

    if (keepCampaignIds.length > 0) {
      // Deletar do removido as campanhas que o mantido já possui
      await tx.delete(campaignClients).where(
        and(
          eq(campaignClients.clientId, mergeId),
          inArray(campaignClients.campaignId, keepCampaignIds),
        ),
      );
    }
    // Transferir as campanhas restantes
    await tx.update(campaignClients).set({ clientId: keepId }).where(eq(campaignClients.clientId, mergeId));

    // ── reengagementProgress: PK = clientId — só pode existir uma linha por cliente
    // Se o cliente mantido já tem progresso, descarta o do removido (mantém o do principal)
    // Se não tem, migra a linha do removido para o keepId
    const [mergeReengagement] = await tx
      .select()
      .from(reengagementProgress)
      .where(eq(reengagementProgress.clientId, mergeId))
      .limit(1);

    if (mergeReengagement) {
      const [keepReengagement] = await tx
        .select()
        .from(reengagementProgress)
        .where(eq(reengagementProgress.clientId, keepId))
        .limit(1);

      if (keepReengagement) {
        // Mantém o do cliente principal, descarta o do removido
        await tx.delete(reengagementProgress).where(eq(reengagementProgress.clientId, mergeId));
      } else {
        // Migra a linha do removido para o cliente mantido
        await tx.delete(reengagementProgress).where(eq(reengagementProgress.clientId, mergeId));
        await tx.insert(reengagementProgress).values({
          clientId: keepId,
          attemptsSent: mergeReengagement.attemptsSent,
          lastAttemptAt: mergeReengagement.lastAttemptAt,
          updatedAt: new Date(),
        });
      }
    }

    // ── 2. Merge de saldo de cashback (somar se ambos tiverem) ──────────────
    const [mergeBalance] = await tx
      .select()
      .from(clientCashbackBalance)
      .where(eq(clientCashbackBalance.clientId, mergeId))
      .limit(1);

    if (mergeBalance) {
      const [keepBalance] = await tx
        .select()
        .from(clientCashbackBalance)
        .where(eq(clientCashbackBalance.clientId, keepId))
        .limit(1);

      if (keepBalance) {
        await tx
          .update(clientCashbackBalance)
          .set({
            totalEarned: sql`${clientCashbackBalance.totalEarned} + ${mergeBalance.totalEarned}`,
            totalUsed: sql`${clientCashbackBalance.totalUsed} + ${mergeBalance.totalUsed}`,
            currentBalance: sql`${clientCashbackBalance.currentBalance} + ${mergeBalance.currentBalance}`,
          })
          .where(eq(clientCashbackBalance.clientId, keepId));
        await tx.delete(clientCashbackBalance).where(eq(clientCashbackBalance.clientId, mergeId));
      } else {
        await tx.update(clientCashbackBalance).set({ clientId: keepId }).where(eq(clientCashbackBalance.clientId, mergeId));
      }
    }

    // ── 3. Deletar o cliente duplicado ──────────────────────────────────────
    //    Feito APÓS migrar todas as referências acima.
    //    Também libera os valores únicos (phone, cpf, email) para o passo 4.
    await tx.delete(clients).where(eq(clients.id, mergeId));

    // ── 4. Atualizar campos em branco do cliente principal ──────────────────
    //    Feito APÓS o delete para evitar violação de restrição UNIQUE
    //    em phone, cpf e email.
    const updateData: Record<string, unknown> = { markers: mergedMarkers };
    Object.assign(updateData, fillFromMerge);
    await tx.update(clients).set(updateData).where(eq(clients.id, keepId));
  });

  const [updated] = await db.select().from(clients).where(eq(clients.id, keepId)).limit(1);
  return updated;
}
