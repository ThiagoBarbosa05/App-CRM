export interface WhatsappContactNameSource {
  clientName?: string | null;
  customContactName?: string | null;
  contactName?: string | null;
  phone: string;
}

export function resolveWhatsappContactName(source: WhatsappContactNameSource): string {
  return source.clientName ?? source.customContactName ?? source.contactName ?? source.phone;
}
