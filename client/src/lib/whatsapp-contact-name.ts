export interface WhatsappContactNameSource {
  clientName?: string | null;
  customContactName?: string | null;
  contactName?: string | null;
  phone: string;
}

export function resolveWhatsappContactName(source: WhatsappContactNameSource): string {
  return source.customContactName ?? source.clientName ?? source.contactName ?? source.phone;
}

export function canEditWhatsappContactName(source: {
  peerChannelId?: number | null;
}): boolean {
  return source.peerChannelId == null;
}
