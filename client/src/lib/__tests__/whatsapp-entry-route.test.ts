import { describe, expect, it } from "vitest";
import { getSellerWhatsappEntryRoute } from "@/lib/whatsapp-entry-route";

describe("getSellerWhatsappEntryRoute", () => {
  it("envia o vendedor para as conversas quando seu canal está conectado", () => {
    expect(
      getSellerWhatsappEntryRoute([
        { connectionStatus: "connected" },
      ]),
    ).toBe("/whatsapp/conversas");
  });

  it("mantém o vendedor na gestão do canal quando ele está desconectado", () => {
    expect(
      getSellerWhatsappEntryRoute([
        { connectionStatus: "disconnected" },
      ]),
    ).toBe("/whatsapp/canais");
  });

  it("mantém o vendedor na gestão do canal quando nenhum canal está vinculado", () => {
    expect(getSellerWhatsappEntryRoute([])).toBe("/whatsapp/canais");
  });
});
