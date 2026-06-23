/** Helpers puros de JID do WhatsApp — sem dependências, para evitar ciclos de import. */

/** Normaliza número BR para JID do WhatsApp: 5511999999999@s.whatsapp.net */
export function normalizeToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withDdi = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `${withDdi}@s.whatsapp.net`;
}

/** Extrai o número de telefone de um JID (remove @s.whatsapp.net, @g.us e :device_id) */
export function jidToPhone(jid: string): string {
  return jid.split("@")[0].split(":")[0];
}

/** Retorna true se o JID é de grupo — conversas de grupo são ignoradas */
export function isGroupJid(jid: string): boolean {
  return jid.endsWith("@g.us");
}
