import { describe, expect, it } from "vitest";

import {
  canActorAccessWhatsappCampaign,
  isWhatsappCampaign,
} from "../campaign-access.service";

describe("campaign access", () => {
  it.each([
    [{ waEnabled: true, umblerEnabled: false, whatsappCampaignId: null }, true],
    [{ waEnabled: false, umblerEnabled: true, whatsappCampaignId: null }, true],
    [{ waEnabled: false, umblerEnabled: false, whatsappCampaignId: "wa-1" }, true],
    [{ waEnabled: false, umblerEnabled: false, whatsappCampaignId: null }, false],
  ])("classifica campanha WhatsApp por configuração ou execução materializada", (campaign, expected) => {
    expect(isWhatsappCampaign(campaign)).toBe(expected);
  });

  it.each([
    ["admin", true],
    ["gerente", true],
    ["vendedor", false],
    ["garcom", false],
    ["administrador", false],
    [undefined, false],
  ] as const)("autoriza role %s para dados de campanhas WhatsApp", (role, expected) => {
    expect(canActorAccessWhatsappCampaign(role)).toBe(expected);
  });
});
