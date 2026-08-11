import { describe, expect, it, vi } from "vitest";

// O service importa server/db no topo e, por transitividade, o hub de SSE e o
// gerenciador de sessões do Baileys — todos abrem conexão com o Postgres no
// import. Só a função pura é exercida aqui, então esses módulos são
// stubados para o teste não depender de banco nenhum.
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: () => {},
  publishSseEvent: () => {},
  revokeStaleConversationAccess: async () => {},
}));
vi.mock("../../integrations/evolution", () => ({
  sendText: async () => null,
  sendMedia: async () => null,
  normalizeToJid: (p: string) => p,
  fetchProfilePictureUrl: async () => null,
}));

import { resolveCampaignReplySectorTarget } from "../whatsapp-conversations.service";

describe("resolveCampaignReplySectorTarget", () => {
  const base = {
    hasResponsibleSeller: true,
    hasCampaignOrigin: true,
    isFirstInboundReply: true,
    sellerSectorId: "setor-vendedor",
  };

  it("roteia para o setor do vendedor quando todas as condições batem", () => {
    expect(resolveCampaignReplySectorTarget(base)).toBe("setor-vendedor");
  });

  it("não roteia sem vendedor responsável", () => {
    expect(resolveCampaignReplySectorTarget({ ...base, hasResponsibleSeller: false })).toBeNull();
  });

  it("não roteia quando a conversa não veio de campanha", () => {
    expect(resolveCampaignReplySectorTarget({ ...base, hasCampaignOrigin: false })).toBeNull();
  });

  it("não roteia em respostas subsequentes (só a primeira dispara)", () => {
    expect(resolveCampaignReplySectorTarget({ ...base, isFirstInboundReply: false })).toBeNull();
  });

  it("não roteia quando o vendedor não pertence a nenhum setor — mantém o setor padrão do canal", () => {
    expect(resolveCampaignReplySectorTarget({ ...base, sellerSectorId: null })).toBeNull();
  });
});
