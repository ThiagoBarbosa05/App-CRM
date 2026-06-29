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
  handleTemplateDeliveryFailure,
  processTemplateTimeouts,
  expireInactiveSessions,
  startBotSession,
} from "../whatsapp-bot-engine.service";
import * as wa from "../../integrations/whatsapp";
import * as r2lib from "../../lib/r2";
import {
  addEdge,
  addNode,
  attachTag,
  createBot,
  createClient,
  createTag,
  createUser,
  describeBotE2E,
  getOutboundMessages,
  getSession,
  openCustomerWindow,
  resetBotTables,
} from "../../test/bot-fixtures";
import { db } from "../../db";
import { contactTags, whatsappBotSessions, whatsappConversations, whatsappMessages } from "@shared/schema";
import { eq, and } from "drizzle-orm";

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

  it("edit_tags (modo add): adiciona etiqueta ao cliente e conclui a sessão", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const tag = await createTag("VIP");
    const client = await createClient({ phone });
    await openCustomerWindow(phone, client.id);

    const start = await addNode(bot.id, { type: "start" });
    const editTags = await addNode(bot.id, {
      type: "edit_tags",
      data: { mode: "add", tagIds: [tag.id] },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, editTags.id);
    await addEdge(bot.id, editTags.id, end.id);

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const rows = await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.clientId, client.id));
    expect(rows.map((r) => r.tagId)).toContain(tag.id);
  });

  it("edit_tags (modo remove): remove etiqueta do cliente e conclui a sessão", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const tag = await createTag("Removível");
    const client = await createClient({ phone });
    await attachTag(client.id, tag.id);
    await openCustomerWindow(phone, client.id);

    const start = await addNode(bot.id, { type: "start" });
    const editTags = await addNode(bot.id, {
      type: "edit_tags",
      data: { mode: "remove", tagIds: [tag.id] },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, editTags.id);
    await addEdge(bot.id, editTags.id, end.id);

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const rows = await db
      .select()
      .from(contactTags)
      .where(eq(contactTags.clientId, client.id));
    expect(rows.map((r) => r.tagId)).not.toContain(tag.id);
  });

  // ── send_template ────────────────────────────────────────────────────────────

  it("send_template: envia o template e pausa a sessão no nó", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
      },
    });
    await addEdge(bot.id, start.id, tmpl.id);

    await startBotSession(bot.id, phone);

    expect(sendTemplateMessage).toHaveBeenCalledOnce();
    expect(sendTemplateMessage.mock.calls[0][1]).toBe("promo_verao");

    const session = await getSession(phone);
    expect(session?.status).toBe("active");
    expect(session?.currentNodeId).toBe(tmpl.id);
    expect(session?.pendingMessageId).toBe("wamid.test");
  });

  it("send_template: clique no botão roteia para o handle correto e conclui", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
      },
    });
    const msg = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Ótimo! Em breve entraremos em contato." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, msg.id, "btn-0");
    await addEdge(bot.id, msg.id, end.id);

    await startBotSession(bot.id, phone);
    // Session paused at tmpl
    await handleIncomingMessage(phone, "Quero!", "btn-0");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Ótimo! Em breve entraremos em contato.");
  });

  it("send_template: resposta inválida roteia para invalid_response handle", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
        invalidResponseHandle: true,
      },
    });
    const invalid = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Resposta não reconhecida." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, invalid.id, "invalid_response");
    await addEdge(bot.id, invalid.id, end.id);

    await startBotSession(bot.id, phone);
    await handleIncomingMessage(phone, "texto aleatório");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Resposta não reconhecida.");
  });

  it("send_template: processTemplateTimeouts roteia para no_response quando prazo expirou", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
        noResponseHandle: true,
      },
    });
    const noResp = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Sem resposta detectada." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, noResp.id, "no_response");
    await addEdge(bot.id, noResp.id, end.id);

    await startBotSession(bot.id, phone);

    // Forçar o prazo para o passado
    await db
      .update(whatsappBotSessions)
      .set({ responseDeadlineAt: new Date(Date.now() - 1000) })
      .where(eq(whatsappBotSessions.phoneNumber, phone));

    await processTemplateTimeouts();

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Sem resposta detectada.");
  });

  it("send_template: handleTemplateDeliveryFailure roteia para not_delivered quando entrega falha", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
        notDeliveredHandle: true,
      },
    });
    const notDel = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Falha na entrega." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, notDel.id, "not_delivered");
    await addEdge(bot.id, notDel.id, end.id);

    await startBotSession(bot.id, phone);
    // pending_message_id foi gravado como "wamid.test" pelo mock

    await handleTemplateDeliveryFailure("wamid.test");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Falha na entrega.");
  });

  // ── trigger_flow ─────────────────────────────────────────────────────────────

  it("trigger_flow: encerra a sessão atual e inicia o bot alvo do zero", async () => {
    const user = await createUser();

    const botB = await createBot(user.id, { name: "Bot B" });
    const startB = await addNode(botB.id, { type: "start" });
    const msgB = await addNode(botB.id, {
      type: "send_message",
      data: { messageType: "text", text: "Olá do Bot B!" },
    });
    const endB = await addNode(botB.id, { type: "end" });
    await addEdge(botB.id, startB.id, msgB.id);
    await addEdge(botB.id, msgB.id, endB.id);

    const botA = await createBot(user.id, { name: "Bot A" });
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const startA = await addNode(botA.id, { type: "start" });
    const trigger = await addNode(botA.id, {
      type: "trigger_flow",
      data: { targetBotId: botB.id },
    });
    await addEdge(botA.id, startA.id, trigger.id);

    await startBotSession(botA.id, phone);

    const session = await getSession(phone);
    expect(session?.botId).toBe(botB.id);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Olá do Bot B!");
  });

  it("trigger_flow: com targetNodeId inicia o bot alvo a partir do nó indicado", async () => {
    const user = await createUser();

    const botB = await createBot(user.id, { name: "Bot B" });
    const startB = await addNode(botB.id, { type: "start" });
    const midNode = await addNode(botB.id, {
      type: "send_message",
      data: { messageType: "text", text: "Iniciou no meio!" },
    });
    const endB = await addNode(botB.id, { type: "end" });
    await addEdge(botB.id, startB.id, midNode.id);
    await addEdge(botB.id, midNode.id, endB.id);

    const botA = await createBot(user.id, { name: "Bot A" });
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const startA = await addNode(botA.id, { type: "start" });
    const trigger = await addNode(botA.id, {
      type: "trigger_flow",
      data: { targetBotId: botB.id, targetNodeId: midNode.id },
    });
    await addEdge(botA.id, startA.id, trigger.id);

    await startBotSession(botA.id, phone);

    const session = await getSession(phone);
    expect(session?.botId).toBe(botB.id);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Iniciou no meio!");
  });

  // ── transfer_agent ───────────────────────────────────────────────────────────

  it("transfer_agent (specific): atribui o agente, registra nota de sistema e conclui a sessão", async () => {
    const user = await createUser();
    const agent = await createUser({ role: "vendedor" });
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const transfer = await addNode(bot.id, {
      type: "transfer_agent",
      data: { rule: "specific", agentId: agent.id },
    });
    await addEdge(bot.id, start.id, transfer.id);

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const [conv] = await db
      .select()
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, conversationId));
    expect(conv.assignedAgentId).toBe(agent.id);

    const notes = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversationId),
          eq(whatsappMessages.type, "system"),
        ),
      );
    expect(notes.length).toBeGreaterThan(0);
  });

  it("transfer_agent: agente não resolvido com activateFlowIfFailed segue para o próximo nó", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const transfer = await addNode(bot.id, {
      type: "transfer_agent",
      // specific sem agentId → não resolve
      data: { rule: "specific", activateFlowIfFailed: true },
    });
    const fallback = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Nenhum agente disponível no momento." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, transfer.id);
    await addEdge(bot.id, transfer.id, fallback.id);
    await addEdge(bot.id, fallback.id, end.id);

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Nenhum agente disponível no momento.");
  });

  // ── distribute_flow ───────────────────────────────────────────────────────────

  it("distribute_flow: roteia para o handle correto conforme Math.random stubado", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const dist = await addNode(bot.id, {
      type: "distribute_flow",
      data: {
        outputs: [
          { handle: "branch-a", percentage: 50 },
          { handle: "branch-b", percentage: 50 },
        ],
      },
    });
    const msgA = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Caiu em A" },
    });
    const msgB = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Caiu em B" },
    });
    const end = await addNode(bot.id, { type: "end" });

    await addEdge(bot.id, start.id, dist.id);
    await addEdge(bot.id, dist.id, msgA.id, "branch-a");
    await addEdge(bot.id, dist.id, msgB.id, "branch-b");
    await addEdge(bot.id, msgA.id, end.id);
    await addEdge(bot.id, msgB.id, end.id);

    // rng=0.1 → cai em branch-a (percentual 50/50)
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Caiu em A");
    expect(sentTexts()).not.toContain("Caiu em B");

    vi.restoreAllMocks();
  });

  it("end_conversation: fecha a conversa, completa a sessão e registra nota de sistema", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const send = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Encerrando o atendimento." },
    });
    const endConv = await addNode(bot.id, {
      type: "end_conversation",
      data: {},
    });
    await addEdge(bot.id, start.id, send.id);
    await addEdge(bot.id, send.id, endConv.id);

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const [conv] = await db
      .select()
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, conversationId));
    expect(conv.status).toBe("closed");

    const messages = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversationId),
          eq(whatsappMessages.type, "system"),
        ),
      );
    expect(messages.length).toBeGreaterThan(0);
  });

  it("end_conversation: é nó terminal — não precisa de aresta de saída para completar", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const endConv = await addNode(bot.id, {
      type: "end_conversation",
      data: {},
    });
    await addEdge(bot.id, start.id, endConv.id);
    // Sem aresta de saída a partir de endConv

    await startBotSession(bot.id, phone);

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");

    const [conv] = await db
      .select()
      .from(whatsappConversations)
      .where(eq(whatsappConversations.id, conversationId));
    expect(conv.status).toBe("closed");
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

  // ── FIX 1: expireInactiveSessions não mata sessão com responseDeadlineAt pendente ──

  it("expireInactiveSessions: não expira sessão de send_template com responseDeadlineAt futuro", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
        noResponseHandle: true,
      },
    });
    const noResp = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Sem resposta detectada." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, noResp.id, "no_response");
    await addEdge(bot.id, noResp.id, end.id);

    await startBotSession(bot.id, phone);

    // Forçar lastActivityAt muito antigo (além dos 30 min) mas mantendo responseDeadlineAt no futuro
    await db
      .update(whatsappBotSessions)
      .set({ lastActivityAt: new Date(Date.now() - 60 * 60 * 1000) }) // 1h atrás
      .where(eq(whatsappBotSessions.phoneNumber, phone));

    await expireInactiveSessions();

    const session = await getSession(phone);
    // Sessão deve continuar active — o job de expiração não deve matar sessões com prazo de resposta pendente
    expect(session?.status).toBe("active");
  });

  it("expireInactiveSessions: após correção, processTemplateTimeouts ainda pode rotear no_response", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
        noResponseHandle: true,
      },
    });
    const noResp = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Sem resposta detectada." },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, noResp.id, "no_response");
    await addEdge(bot.id, noResp.id, end.id);

    await startBotSession(bot.id, phone);

    // Simular lastActivityAt antigo + responseDeadlineAt expirado
    await db
      .update(whatsappBotSessions)
      .set({
        lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
        responseDeadlineAt: new Date(Date.now() - 1000),
      })
      .where(eq(whatsappBotSessions.phoneNumber, phone));

    // job de expiração NÃO deve matar a sessão (tem responseDeadlineAt)
    await expireInactiveSessions();
    const sessionAfterExpire = await getSession(phone);
    expect(sessionAfterExpire?.status).toBe("active");

    // job de timeout do template dispara o no_response
    await processTemplateTimeouts();
    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Sem resposta detectada.");
  });

  // ── FIX 3: end_conversation honra closedBy ────────────────────────────────────

  it("end_conversation: quando closedBy='owner', nota de sistema menciona dono do chat", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const endConv = await addNode(bot.id, {
      type: "end_conversation",
      data: { closedBy: "owner" },
    });
    await addEdge(bot.id, start.id, endConv.id);

    await startBotSession(bot.id, phone);

    const notes = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversationId),
          eq(whatsappMessages.type, "system"),
        ),
      );
    expect(notes.some((n) => n.content?.includes("dono"))).toBe(true);
  });

  it("end_conversation: quando closedBy='agent', nota de sistema menciona atendente", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();
    const { conversationId } = await openCustomerWindow(phone);

    const start = await addNode(bot.id, { type: "start" });
    const endConv = await addNode(bot.id, {
      type: "end_conversation",
      data: { closedBy: "agent" },
    });
    await addEdge(bot.id, start.id, endConv.id);

    await startBotSession(bot.id, phone);

    const notes = await db
      .select()
      .from(whatsappMessages)
      .where(
        and(
          eq(whatsappMessages.conversationId, conversationId),
          eq(whatsappMessages.type, "system"),
        ),
      );
    expect(notes.some((n) => n.content?.includes("atendente"))).toBe(true);
  });

  // ── FIX 4: matcher de botão — replyId não-correspondente cai para label ────────

  it("send_template: replyId preenchido mas sem match → fallback por label roteia corretamente", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [{ handle: "btn-0", label: "Quero!" }],
      },
    });
    const confirmed = await addNode(bot.id, {
      type: "send_message",
      data: { messageType: "text", text: "Confirmado pelo label!" },
    });
    const end = await addNode(bot.id, { type: "end" });
    await addEdge(bot.id, start.id, tmpl.id);
    await addEdge(bot.id, tmpl.id, confirmed.id, "btn-0");
    await addEdge(bot.id, confirmed.id, end.id);

    await startBotSession(bot.id, phone);

    // replyId preenchido mas não casa com nenhum btn-N; label "Quero!" casa
    await handleIncomingMessage(phone, "Quero!", "REPLYID_DESCONHECIDO");

    const session = await getSession(phone);
    expect(session?.status).toBe("completed");
    expect(sentTexts()).toContain("Confirmado pelo label!");
  });

  // ── FIX 5: try/catch no envio de send_template ────────────────────────────────

  it("send_template: falha no envio lança erro amigável em vez de silêncio", async () => {
    const user = await createUser();
    const bot = await createBot(user.id);
    const phone = nextPhone();

    const start = await addNode(bot.id, { type: "start" });
    const tmpl = await addNode(bot.id, {
      type: "send_template",
      data: {
        metaTemplateName: "promo_verao",
        metaTemplateLanguage: "pt_BR",
        buttonHandles: [],
      },
    });
    await addEdge(bot.id, start.id, tmpl.id);

    sendTemplateMessage.mockRejectedValueOnce(new Error("API fora do ar"));

    await expect(startBotSession(bot.id, phone)).rejects.toThrow(
      "Falha ao enviar template",
    );
  });
});
