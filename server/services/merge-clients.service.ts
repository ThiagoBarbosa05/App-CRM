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
  clientTags,
} from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

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

    // Tabelas com cascade ou set null — migrar ANTES do delete para preservar histórico
    await tx.update(clientInteractions).set({ clientId: keepId }).where(eq(clientInteractions.clientId, mergeId));
    await tx.update(eventParticipants).set({ clientId: keepId }).where(eq(eventParticipants.clientId, mergeId));

    // clientTags não tem FK constraint — migrar para evitar referências órfãs
    await tx.update(clientTags).set({ clientId: keepId }).where(eq(clientTags.clientId, mergeId));

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
