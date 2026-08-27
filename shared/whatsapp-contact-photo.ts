export interface WhatsappContactPhotoInput {
  clientId?: string | null;
  contactPhotoUrl?: string | null;
}

export function resolveWhatsappContactPhotoUrl(
  contact: WhatsappContactPhotoInput,
): string | null {
  return contact.contactPhotoUrl ?? null;
}

export function shouldFetchWhatsappContactPhoto(input: {
  direction: "inbound" | "outbound";
  instanceName?: string;
  peerChannelId?: number | null;
  contactPhotoUrl?: string | null;
}): boolean {
  return Boolean(
    input.direction === "inbound" &&
      input.instanceName &&
      input.peerChannelId == null &&
      !input.contactPhotoUrl,
  );
}
