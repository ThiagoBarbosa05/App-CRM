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
import * as r2lib from "../../lib/r2";
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
const sendTemplateMessage = vi.mocked(wa.sendTemplateMessage);
const sendMediaMessage = vi.mocked(wa.sendMediaMessage);
const uploadMedia = vi.mocked(wa.uploadMedia);
const r2Send = vi.mocked(r2lib.r2.send);

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

  // ── send_message: template ───────────────────────────────────────────────

  it("send_message template: chama sendTemplateMessage com nome e idioma corretos", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: {
        messageType: "template",
        metaTemplateName: "boas_vindas",
        metaTemplateLanguage: "pt_BR",
        templateParams: [],
      },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    await startBotSession(bot.id, phone);

    expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
    const [toArg, nameArg, langArg] = sendTemplateMessage.mock.calls[0];
    expect(toArg).toBe(phone);
    expect(nameArg).toBe("boas_vindas");
    expect(langArg).toBe("pt_BR");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
  });

  it("send_message template: interpola variáveis de sessão nos parâmetros de texto", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const question = await addNode(bot.id, {
      type: "question",
      data: { messageText: "Qual seu nome?", captureVariable: "nome" },
    });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: {
        messageType: "template",
        metaTemplateName: "tpl_com_nome",
        metaTemplateLanguage: "pt_BR",
        templateParams: [
          {
            type: "body",
            parameters: [{ type: "text", text: "{{nome}}" }],
          },
        ],
      },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, question.id);
    await addEdge(bot.id, question.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    await startBotSession(bot.id, phone);
    await handleIncomingMessage(phone, "Maria");

    expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
    const components = sendTemplateMessage.mock.calls[0][3] as Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>;
    const bodyComp = components.find((c) => c.type === "body");
    expect(bodyComp?.parameters[0]?.text).toBe("Maria");
  });

  it("send_message template: injeta mídia de header via URL pública do R2", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: {
        messageType: "template",
        metaTemplateName: "tpl_com_imagem",
        metaTemplateLanguage: "pt_BR",
        templateParams: [],
        templateHeaderMedia: {
          storageKey: "uploads/header-img.jpg",
          type: "image",
          name: "header-img.jpg",
          mimeType: "image/jpeg",
        },
      },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    await startBotSession(bot.id, phone);

    expect(sendTemplateMessage).toHaveBeenCalledTimes(1);
    const components = sendTemplateMessage.mock.calls[0][3] as Array<{
      type: string;
      parameters: Array<{ type: string; image: { link: string } }>;
    }>;
    const headerComp = components.find((c) => c.type === "header");
    expect(headerComp).toBeDefined();
    expect(headerComp?.parameters[0]?.image?.link).toBe(
      "https://cdn.test/uploads/header-img.jpg",
    );
  });

  // ── send_message: texto + anexo ──────────────────────────────────────────

  it("send_message com anexo: faz upload no R2 e envia mídia com o texto como legenda", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const fakeBody = (async function* () {
      yield Buffer.from("fake-image-bytes");
    })();
    r2Send.mockResolvedValueOnce({ Body: fakeBody } as never);

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: {
        messageType: "text",
        text: "Veja a imagem:",
        attachment: {
          storageKey: "uploads/foto.jpg",
          type: "image",
          name: "foto.jpg",
          mimeType: "image/jpeg",
        },
      },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    await startBotSession(bot.id, phone);

    expect(uploadMedia).toHaveBeenCalledTimes(1);
    expect(sendMediaMessage).toHaveBeenCalledTimes(1);
    const [toArg, mediaIdArg, typeArg, captionArg] =
      sendMediaMessage.mock.calls[0];
    expect(toArg).toBe(phone);
    expect(mediaIdArg).toBe("media-id-test");
    expect(typeArg).toBe("image");
    expect(captionArg).toBe("Veja a imagem:");
    expect(sendTextMessage).not.toHaveBeenCalled();

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
  });

  it("send_message com anexo: lança erro quando a janela de 24h está fechada", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    // Intencionalmente NÃO abre a janela de 24h

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: {
        messageType: "text",
        attachment: {
          storageKey: "uploads/doc.pdf",
          type: "document",
          name: "doc.pdf",
          mimeType: "application/pdf",
        },
      },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, end.id);

    await expect(startBotSession(bot.id, phone)).rejects.toThrow(
      "Janela de 24h fechada",
    );
    expect(uploadMedia).not.toHaveBeenCalled();
  });
});
