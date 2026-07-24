import { describe, expect, it, vi } from "vitest";

// O service importa server/db no topo e, por transitividade, o hub de SSE e o
// gerenciador de sessões do Baileys — todos abrem conexão com o Postgres no
// import. Só as funções puras são exercidas aqui, então esses módulos são
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

import { canonicalInternalPair, internalPeerLabel } from "../whatsapp-conversations.service";

const eventos = { id: 7, displayPhone: "+5521989014965" };
const buzios = { id: 12, displayPhone: "+5522996212581" };

describe("canonicalInternalPair", () => {
  it("é simétrica — as duas instâncias resolvem a MESMA conversa", () => {
    expect(canonicalInternalPair(eventos, buzios)).toEqual(canonicalInternalPair(buzios, eventos));
  });

  it("elege o canal de menor id como dono e o telefone do outro como o da conversa", () => {
    const pair = canonicalInternalPair(buzios, eventos);
    expect(pair.ownerChannelId).toBe(eventos.id);
    expect(pair.peerChannelId).toBe(buzios.id);
    expect(pair.phone).toBe(buzios.displayPhone);
  });

  it("não quebra quando o canal peer ainda não tem displayPhone cadastrado", () => {
    const pair = canonicalInternalPair(eventos, { id: 30, displayPhone: null });
    expect(pair.ownerChannelId).toBe(eventos.id);
    expect(pair.peerChannelId).toBe(30);
    expect(pair.phone).toBeNull();
  });
});

describe("internalPeerLabel", () => {
  // Conversa canônica do diálogo Eventos↔Búzios: dona é a Eventos (id 7, atendente
  // Televendas), peer é a Búzios (id 12, atendente Daiane).
  const row = {
    channelId: 7,
    peerChannelId: 12,
    channelName: "Eventos",
    channelUserName: "Televendas",
    peerChannelName: "Búzios",
    peerChannelUserName: "Daiane",
  };

  it("mostra o nome do atendente do canal peer para quem é do canal dono", () => {
    expect(internalPeerLabel(row, [7])).toBe("Daiane");
  });

  it("mostra o nome do atendente do canal dono para quem é do canal peer", () => {
    expect(internalPeerLabel(row, [12])).toBe("Televendas");
  });

  it("mostra o atendente do peer para quem não é de nenhum dos dois (admin/gerente)", () => {
    expect(internalPeerLabel(row, [])).toBe("Daiane");
  });

  it("mostra o atendente do peer quando o usuário tem acesso aos DOIS canais", () => {
    expect(internalPeerLabel(row, [7, 12])).toBe("Daiane");
  });

  it("cai para o nome do canal quando ele não tem atendente dono definido", () => {
    const semDono = { ...row, channelUserName: null, peerChannelUserName: null };
    expect(internalPeerLabel(semDono, [7])).toBe("Búzios");
    expect(internalPeerLabel(semDono, [12])).toBe("Eventos");
  });

  it("retorna null para conversa comum com cliente (sem peer)", () => {
    expect(
      internalPeerLabel({ ...row, peerChannelId: null, peerChannelName: null, peerChannelUserName: null }, [7]),
    ).toBeNull();
  });
});
