import { beforeEach, expect, it, vi } from "vitest";

// ── Mocks das fronteiras externas ────────────────────────────────────────────
// Tudo que sai do processo é mockado. O banco é REAL (TEST_DATABASE_URL): é isso
// que torna estes testes um "e2e" do runtime do bot, e não um teste de unidade.

vi.mock("../../integrations/whatsapp", () => {
  const ok = { messages: [{ id: "wamid.test" }] };
  return {
    sendTextMessage: vi.fn(async () => ok),
    sendTemplateMessage: vi.fn(async () => ok),
    sendFlowMessage: vi.fn(async () => ok),
    sendMediaByUrl: vi.fn(async () => ok),
    sendMediaMessage: vi.fn(async () => ok),
    sendButtonsMessage: vi.fn(async () => ok),
    sendListMessage: vi.fn(async () => ok),
    uploadMedia: vi.fn(async () => "media-id-test"),
    // Também importados por whatsapp-conversations.service (puxado pelo engine).
    sendReaction: vi.fn(async () => ok),
    downloadMediaToBuffer: vi.fn(async () => ({
      buffer: Buffer.from(""),
      contentType: "application/octet-stream",
      size: 0,
    })),
  };
});

// Evita arrastar o Baileys via integrations/evolution → conversations.service.
vi.mock("../../integrations/evolution", () => ({
  normalizeToJid: (s: string) => s,
  jidToPhone: (s: string) => s,
  isGroupJid: () => false,
  sendText: vi.fn(async () => ({})),
  sendMedia: vi.fn(async () => ({})),
}));

vi.mock("../../lib/sse-hub", () => ({
  publishConversationEvent: vi.fn(),
  publishSseEvent: vi.fn(),
}));

vi.mock("../../lib/r2", () => ({
  r2: { send: vi.fn() },
  getPublicR2Url: (key: string) => `https://cdn.test/${key}`,
  // Importado por whatsapp-conversations.service.
  uploadWhatsappMedia: vi.fn(async () => "r2-key-test"),
}));

vi.mock("../../ai-helpers", () => ({
  classifyMessageIntent: vi.fn(async () => null),
}));

import {
  handleIncomingMessage,
  startBotSession,
} from "../whatsapp-bot-engine.service";
import * as wa from "../../integrations/whatsapp";
import {
  addEdge,
  addNode,
  createBot,
  createUser,
  describeBotE2E,
  getOutboundMessages,
  getSession,
  openCustomerWindow,
  resetBotTables,
} from "../../test/bot-fixtures";

const sendTextMessage = vi.mocked(wa.sendTextMessage);
const sendButtonsMessage = vi.mocked(wa.sendButtonsMessage);

/** Telefones distintos por teste evitam colisão na janela de 24h / sessão. */
let phoneSeq = 0;
function nextPhone(): string {
  phoneSeq += 1;
  return `55549${String(phoneSeq).padStart(8, "0")}`;
}

/** Textos enviados por sendTextMessage (1º argumento = phone, 2º = texto). */
function sentTexts(): string[] {
  return sendTextMessage.mock.calls.map((c) => c[1] as string);
}

describeBotE2E("WhatsApp bot engine (e2e, banco real)", () => {
  beforeEach(async () => {
    await resetBotTables();
    vi.clearAllMocks();
  });

  it("roda um fluxo linear: start → send_message → end", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Olá, tudo bem?" },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    const result = await startBotSession(bot.id, phone);

    expect(result).toBe("started");
    expect(sentTexts()).toContain("Olá, tudo bem?");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const outbound = await getOutboundMessages(conversationId);
    const contents = outbound.map((m) => m.content);
    expect(contents).toContain("Olá, tudo bem?");
  });

  it("pausa no nó de pergunta, valida e captura a resposta", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const question = await addNode(bot.id, {
      type: "question",
      data: {
        messageText: "Qual seu email?",
        captureVariable: "email",
        validation: "email",
        validationErrorText: "Email inválido, tente de novo.",
      },
    });
    const thanks = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Obrigado, {{email}}!" },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, question.id);
    await addEdge(bot.id, question.id, thanks.id);
    await addEdge(bot.id, thanks.id, end.id);

    await startBotSession(bot.id, phone);

    // Pausou aguardando a resposta, no nó de pergunta.
    let session = await getSession(phone);
    expect(session?.status).toBe("active");
    expect(session?.currentNodeId).toBe(question.id);
    expect(sentTexts()).toContain("Qual seu email?");

    // Resposta inválida: reenvia erro e NÃO avança.
    await handleIncomingMessage(phone, "isso-nao-e-email");
    session = await getSession(phone);
    expect(session?.currentNodeId).toBe(question.id);
    expect(sentTexts()).toContain("Email inválido, tente de novo.");

    // Resposta válida: captura, interpola e conclui.
    await handleIncomingMessage(phone, "ana@empresa.com");
    session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(session?.sessionData?.email).toBe("ana@empresa.com");
    expect(sentTexts()).toContain("Obrigado, ana@empresa.com!");
  });

  it("ramifica por palavra-chave no nó de condição (modo reply)", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const condition = await addNode(bot.id, {
      type: "condition",
      data: {
        mode: "reply",
        defaultHandle: "h-def",
        branches: [
          { handle: "h-sim", label: "Sim", keywords: ["sim"] },
          { handle: "h-nao", label: "Não", keywords: ["nao", "não"] },
        ],
      },
    });
    const yes = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Você disse sim" },
    });
    const no = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Você disse não" },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, condition.id);
    await addEdge(bot.id, condition.id, yes.id, "h-sim");
    await addEdge(bot.id, condition.id, no.id, "h-nao");
    await addEdge(bot.id, yes.id, end.id);
    await addEdge(bot.id, no.id, end.id);

    await startBotSession(bot.id, phone);

    // Condição em modo reply pausa aguardando a mensagem.
    const paused = await getSession(phone);
    expect(paused?.currentNodeId).toBe(condition.id);

    await handleIncomingMessage(phone, "Sim, quero!");

    expect(sentTexts()).toContain("Você disse sim");
    expect(sentTexts()).not.toContain("Você disse não");
    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
  });

  it("resolve a escolha do menu pelo id do botão e captura o label", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const menu = await addNode(bot.id, {
      type: "menu",
      data: {
        bodyText: "Escolha uma opção:",
        captureVariable: "escolha",
        options: [
          { handle: "opt-a", label: "Opção A" },
          { handle: "opt-b", label: "Opção B" },
        ],
      },
    });
    const a = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Você escolheu A" },
    });
    const b = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Você escolheu B" },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, menu.id);
    await addEdge(bot.id, menu.id, a.id, "opt-a");
    await addEdge(bot.id, menu.id, b.id, "opt-b");
    await addEdge(bot.id, a.id, end.id);
    await addEdge(bot.id, b.id, end.id);

    await startBotSession(bot.id, phone);

    expect(sendButtonsMessage).toHaveBeenCalledTimes(1);
    const paused = await getSession(phone);
    expect(paused?.currentNodeId).toBe(menu.id);

    // Simula o clique no botão "Opção B" (interactive reply id === handle).
    await handleIncomingMessage(phone, "Opção B", "opt-b");

    expect(sentTexts()).toContain("Você escolheu B");
    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(session?.sessionData?.escolha).toBe("Opção B");
    expect(session?.sessionData?.escolha_index).toBe("1");
  });

  it("retorna 'no_start_node' quando o bot não tem nó inicial", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const result = await startBotSession(bot.id, phone);

    expect(result).toBe("no_start_node");
  });

  it("retorna 'already_active' quando já há sessão ativa para o telefone", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const question = await addNode(bot.id, {
      type: "question",
      data: { messageText: "Aguardando...", captureVariable: "x" },
    });
    await addEdge(bot.id, start.id, question.id);

    const first = await startBotSession(bot.id, phone);
    const second = await startBotSession(bot.id, phone);

    expect(first).toBe("started");
    expect(second).toBe("already_active");
  });
});
