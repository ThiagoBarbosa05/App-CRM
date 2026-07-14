// Identifica automaticamente o cliente do CRM correspondente ao remetente de uma
// mensagem recebida pelo Zernio, usando os identificadores fortes que a própria
// Zernio expõe no webhook (docs.zernio.com/webhooks, evento message.received):
// sender.phoneNumber (E.164, WhatsApp) e sender.username (Instagram).
import { isNotNull } from "drizzle-orm";
import { db } from "../db";
import { clients } from "@shared/schema";
import { normalizePhoneE164 } from "@shared/phone";

export interface ZernioSenderIdentity {
  phoneNumber?: string;
  username?: string;
}

export interface ClientMatch {
  id: string;
  name: string;
}

function normalizeInstagramHandle(handle: string): string {
  return handle.trim().replace(/^@/, "").toLowerCase();
}

/**
 * Retorna o cliente do CRM cujo telefone/Instagram corresponde ao remetente,
 * ou `null` se não houver identificador utilizável ou o match for ambíguo.
 * Só suporta WhatsApp (por telefone) e Instagram (por username) — outras
 * plataformas não têm um identificador forte já mapeado em `clients`.
 */
export async function findClientMatch(
  platform: string,
  sender: ZernioSenderIdentity,
): Promise<ClientMatch | null> {
  if (platform === "whatsapp" && sender.phoneNumber) {
    const target = normalizePhoneE164(sender.phoneNumber);
    if (!target) return null;

    const candidates = await db
      .select({ id: clients.id, name: clients.name, phone: clients.phone })
      .from(clients)
      .where(isNotNull(clients.phone));
    const matches = candidates.filter((c) => normalizePhoneE164(c.phone) === target);
    return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : null;
  }

  if (platform === "instagram" && sender.username) {
    const target = normalizeInstagramHandle(sender.username);

    const candidates = await db
      .select({ id: clients.id, name: clients.name, instagram: clients.instagram })
      .from(clients)
      .where(isNotNull(clients.instagram));
    const matches = candidates.filter((c) => c.instagram && normalizeInstagramHandle(c.instagram) === target);
    return matches.length === 1 ? { id: matches[0].id, name: matches[0].name } : null;
  }

  return null;
}
