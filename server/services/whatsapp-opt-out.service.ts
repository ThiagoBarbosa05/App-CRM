import { db } from "server/db";
import { eq } from "drizzle-orm";
import { clients, whatsappConversations } from "@shared/schema";
import { terminateActiveSessionForOptOut } from "./whatsapp-bot-engine.service";

export type WhatsappOptOutSource = "keyword" | "manual";

// Palavras-chave de opt-out/opt-in de marketing, reconhecidas em resposta exata
// (não substring, para não confundir "vou parar de comprar" com um pedido real)
// e sem diferenciar maiúsculas/minúsculas nem acentos. Compartilhadas entre os
// dois caminhos de mensagem recebida: webhook da Cloud API (Meta) e eventos do
// Baileys (canal QR Code / Evolution).
export const OPT_OUT_KEYWORDS = new Set(["SAIR", "PARAR", "CANCELAR", "DESCADASTRAR"]);
export const OPT_IN_KEYWORDS = new Set(["VOLTAR", "QUERO RECEBER"]);

const COMBINING_DIACRITICS_RE = /[̀-ͯ]/g;

export function normalizeOptKeyword(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS_RE, "")
    .trim()
    .toUpperCase();
}

export type OptKeywordMatch = "opt_out" | "opt_in" | null;

/** Verifica se o texto recebido é um pedido de opt-out ou opt-in de marketing. */
export function matchOptKeyword(text: string): OptKeywordMatch {
  const normalized = normalizeOptKeyword(text);
  if (OPT_OUT_KEYWORDS.has(normalized)) return "opt_out";
  if (OPT_IN_KEYWORDS.has(normalized)) return "opt_in";
  return null;
}

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
  await db
    .update(clients)
    .set({
      whatsappOptOut: optedOut,
      whatsappOptOutAt: optedOut ? new Date() : null,
      whatsappOptOutSource: optedOut ? (source ?? "manual") : null,
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
    .select({ whatsappOptOut: clients.whatsappOptOut })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  return !!client?.whatsappOptOut;
}
