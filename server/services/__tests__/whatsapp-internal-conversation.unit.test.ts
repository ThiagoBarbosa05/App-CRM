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

import {
  canonicalInternalPair,
  internalPeerLabel,
  viewerIsPeerSide,
  directionForViewer,
} from "../whatsapp-conversations.service";

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

describe("viewerIsPeerSide", () => {
  // Dona é a Eventos (7), peer é a Búzios (12) — mesmo cenário real do bug:
  // Televendas (dono) enviou "teste", Daiane (peer) respondeu ".".
  const row = { channelId: 7, peerChannelId: 12 };

  it("false para quem é do canal dono", () => {
    expect(viewerIsPeerSide(row, [7])).toBe(false);
  });

  it("true para quem é do canal peer", () => {
    expect(viewerIsPeerSide(row, [12])).toBe(true);
  });

  it("false para quem não é de nenhum dos dois (admin/gerente)", () => {
    expect(viewerIsPeerSide(row, [])).toBe(false);
  });

  it("false para quem tem acesso aos dois canais", () => {
    expect(viewerIsPeerSide(row, [7, 12])).toBe(false);
  });

  it("false para conversa externa (sem peerChannelId), mesmo que o channelId bata", () => {
    expect(viewerIsPeerSide({ channelId: 7, peerChannelId: null }, [7])).toBe(false);
  });
});

describe("directionForViewer", () => {
  it("não inverte para o dono — direction do banco já é a dele", () => {
    expect(directionForViewer("outbound", false)).toBe("outbound");
    expect(directionForViewer("inbound", false)).toBe("inbound");
  });

  it("inverte para o peer — outbound do dono é o que o peer recebeu", () => {
    expect(directionForViewer("outbound", true)).toBe("inbound");
    expect(directionForViewer("inbound", true)).toBe("outbound");
  });

  it("cenário real do bug: Televendas (dono) manda 'teste' — ele deve ver como outbound (dele)", () => {
    const row = { channelId: 7, peerChannelId: 12 };
    const televendasChannelIds = [7];
    expect(directionForViewer("outbound", viewerIsPeerSide(row, televendasChannelIds))).toBe("outbound");
  });

  it("cenário real do bug: Daiane (peer) lê o 'teste' do Televendas — deve ver como inbound (recebida)", () => {
    const row = { channelId: 7, peerChannelId: 12 };
    const daianeChannelIds = [12];
    expect(directionForViewer("outbound", viewerIsPeerSide(row, daianeChannelIds))).toBe("inbound");
  });

  it("cenário real do bug: Daiane (peer) manda '.' — a linha grava inbound (relativo ao dono), mas ela deve ver como outbound (dela)", () => {
    const row = { channelId: 7, peerChannelId: 12 };
    const daianeChannelIds = [12];
    expect(directionForViewer("inbound", viewerIsPeerSide(row, daianeChannelIds))).toBe("outbound");
  });
});
