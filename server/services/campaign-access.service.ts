export interface CampaignWhatsappIdentity {
  waEnabled: boolean | null;
  umblerEnabled: boolean | null;
  whatsappCampaignId: string | null;
}

export function canActorAccessWhatsappCampaign(
  role: string | undefined,
): boolean {
  return role === "admin" || role === "gerente";
}

export function isWhatsappCampaign(campaign: CampaignWhatsappIdentity): boolean {
  return Boolean(
    campaign.waEnabled ||
      campaign.umblerEnabled ||
      campaign.whatsappCampaignId,
  );
}
