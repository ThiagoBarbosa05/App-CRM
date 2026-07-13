import { db } from "server/db";
import { eq } from "drizzle-orm";
import { clients, whatsappConversations } from "@shared/schema";
import { terminateActiveSessionForOptOut } from "./whatsapp-bot-engine.service";

export type WhatsappOptOutSource = "keyword" | "manual";

/** Marcador aplicado/removido em `clients.markers` para identificar visualmente o cliente. */
export const WHATSAPP_OPT_OUT_MARKER = "Opt-out WhatsApp";

async function resolveClientIdByPhone(phone: string): Promise<string | null> {
  const [convRow] = await db
    .select({ clientId: whatsappConversations.clientId })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.phone, phone))
    .limit(1);
  if (convRow?.clientId) return convRow.clientId;

  const [clientRow] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.phone, phone))
    .limit(1);
  return clientRow?.id ?? null;
}

async function setOptOut(clientId: string, optedOut: boolean, source?: WhatsappOptOutSource): Promise<void> {
  const [current] = await db
    .select({ markers: clients.markers })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  const currentMarkers = current?.markers ?? [];
  const markers = optedOut
    ? currentMarkers.includes(WHATSAPP_OPT_OUT_MARKER)
      ? currentMarkers
      : [...currentMarkers, WHATSAPP_OPT_OUT_MARKER]
    : currentMarkers.filter((m) => m !== WHATSAPP_OPT_OUT_MARKER);

  await db
    .update(clients)
    .set({
      whatsappOptOutAt: optedOut ? new Date() : null,
      whatsappOptOutSource: optedOut ? (source ?? "manual") : null,
      markers,
    })
    .where(eq(clients.id, clientId));
}

/** Marca o cliente como "não quer mais receber marketing" e encerra a sessão de bot ativa, se houver. */
export async function optOutClientByPhone(phone: string, source: WhatsappOptOutSource): Promise<void> {
  const clientId = await resolveClientIdByPhone(phone);
  if (clientId) await setOptOut(clientId, true, source);
  await terminateActiveSessionForOptOut(phone);
}

/** Reverte o opt-out (cliente voltou a aceitar receber marketing). */
export async function optInClientByPhone(phone: string): Promise<void> {
  const clientId = await resolveClientIdByPhone(phone);
  if (clientId) await setOptOut(clientId, false);
}

/** Variante usada pela ficha do cliente (toggle manual), quando já se tem o clientId em mãos. */
export async function setWhatsappOptOutByClientId(
  clientId: string,
  optedOut: boolean,
): Promise<void> {
  await setOptOut(clientId, optedOut, optedOut ? "manual" : undefined);
  if (optedOut) {
    const [client] = await db.select({ phone: clients.phone }).from(clients).where(eq(clients.id, clientId)).limit(1);
    if (client?.phone) await terminateActiveSessionForOptOut(client.phone);
  }
}

export async function isOptedOut(clientId: string): Promise<boolean> {
  const [client] = await db
    .select({ whatsappOptOutAt: clients.whatsappOptOutAt })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return !!client?.whatsappOptOutAt;
}
