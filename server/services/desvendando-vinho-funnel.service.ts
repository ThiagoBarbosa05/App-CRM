import { eq, and, asc } from "drizzle-orm";
import { db } from "../db";
import {
  contactTags,
  clients,
  deals,
  whatsappTags,
  funnelStages,
  salesFunnels,
} from "@shared/schema";

const TARGET_NAME = "DESVENDANDO O VINHO";

function normalizeName(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function isDesvendandoVinho(value: string | null | undefined) {
  return normalizeName(value) === TARGET_NAME;
}

async function getTargetFunnelAndStage() {
  const funnels = await db.select().from(salesFunnels);
  const funnel = funnels.find((item) => isDesvendandoVinho(item.name));

  if (!funnel) {
    console.warn(`[DesvendandoVinhoFunnel] Funil "${TARGET_NAME}" não encontrado`);
    return null;
  }

  const stages = await db
    .select()
    .from(funnelStages)
    .where(eq(funnelStages.funnelId, funnel.id))
    .orderBy(asc(funnelStages.order));

  const stage =
    stages.find((item) => normalizeName(item.name).includes("AGUARDANDO")) ??
    stages[0];

  if (!stage) {
    console.warn(`[DesvendandoVinhoFunnel] Nenhum estágio encontrado no funil "${TARGET_NAME}"`);
    return null;
  }

  return { funnel, stage };
}

export async function ensureClientInDesvendandoVinhoFunnel(clientId: string) {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return;

  const markerNames = client.markers ?? [];
  const externalMarkerNames = await db
    .select({ name: whatsappTags.name })
    .from(contactTags)
    .innerJoin(whatsappTags, eq(contactTags.whatsappTagId, whatsappTags.id))
    .where(eq(contactTags.clientId, clientId));

  const hasTargetMarker =
    markerNames.some(isDesvendandoVinho) ||
    externalMarkerNames.some((item) => isDesvendandoVinho(item.name));

  if (!hasTargetMarker) return;

  const target = await getTargetFunnelAndStage();
  if (!target) return;

  const [existingDeal] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.funnelId, target.funnel.id),
        eq(deals.clientId, clientId),
      ),
    )
    .limit(1);

  if (existingDeal) return;

  const ownerId = client.responsavelId ?? target.funnel.createdBy;

  await db.insert(deals).values({
    clientId,
    companyId: null,
    title: `Desvendando o Vinho - ${client.name}`,
    funnelId: target.funnel.id,
    stageId: target.stage.id,
    value: "0",
    notes: "Cliente incluído automaticamente pelo marcador DESVENDANDO O VINHO.",
    assignedTo: ownerId,
    createdBy: ownerId,
  });
}