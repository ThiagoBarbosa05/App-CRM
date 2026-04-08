import { Router } from "express";

import {
  createCashback,
  getBirthdayBots,
  getBirthdayDaysBeforeBotAutomation,
  getBirthdayTodayBotsAutomation,
  getBotCashback,
  getBot,
  getBots,
  getCashbackField,
  getChannels,
  getChat,
  getChatById,
  getManualStartsBot,
  getContactByPhone,
  getContactConversations,
  getContacts,
  getContactTags,
  getTags,
  sendMessage,
  syncContact,
  startBirthdayBot,
  createChat,
  createContactSchema,
  updateContact,
  updateCashback,
  deleteContact,
} from "../integrations/umbler";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { serviceChannels, userServiceChannel, users } from "../../shared/schema";
import { createCampaignController } from "../controllers/campaigns/create-campaign.controller";
import { listCampaignsController } from "../controllers/campaigns/list-campaigns.controller";
import { getCampaignDetailsController } from "../controllers/campaigns/get-campaign-details.controller";
import { getCampaignStatsController } from "../controllers/campaigns/get-campaign-stats.controller";

export const umblerRouter = Router();

umblerRouter.get("/umbler/channels", async (_req, res) => {
  try {
    const channels = await getChannels();
    return res.json(channels);
  } catch (error) {
    console.error("Erro ao buscar canais:", error);
    return res.status(500).json({ message: "Erro ao buscar canais" });
  }
});

umblerRouter.get("/umbler/whatsapp-api/channels", async (_req, res) => {
  try {
    const channels = await getChannels();
    return res.json(channels);
  } catch (error) {
    console.error("Erro ao buscar canais:", error);
    return res.status(500).json({ message: "Erro ao buscar canais" });
  }
});

umblerRouter.get("/umbler/bot", async (req, res) => {
  try {
    const { title } = req.query as { title: string };
    const result = await getBot(title);

    return res.json({ result: result?.items });
  } catch (error) {
    console.error("Erro ao buscar bot:", error);
    return res.status(500).json({ message: "Erro ao buscar bot" });
  }
});

umblerRouter.get("/umbler/manual-starts/bot", async (req, res) => {
  try {
    const { query, hidden } = req.query as {
      query?: string;
      hidden?: string;
    };

    console.log("Buscando bots com parâmetros:", { query, hidden });

    const result = await getManualStartsBot(query || "");

    if (!result) {
      console.error("getManualStartsBot retornou null");
      return res.status(500).json({
        message: "Erro ao buscar bots",
        error: "API retornou null",
      });
    }

    console.log("Bots recebidos:", result);
    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar bot:", error);
    return res.status(500).json({
      message: "Erro ao buscar bot",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

umblerRouter.get("/umbler/contacts/conversations", async (req, res) => {
  try {
    const { phoneNumber, channelId } = req.query;
    const conversations = await getContactConversations(
      phoneNumber as string,
      channelId as string,
    );

    return res.json(conversations);
  } catch (error) {
    console.error("Erro ao buscar conversas do contato:", error);
    return res.status(500).json({ message: "Erro ao buscar conversas do contato" });
  }
});

umblerRouter.get("/umbler/contacts/:phone", async (req, res) => {
  try {
    const { phone } = req.params as { phone: string };
    const contact = await getContactByPhone(phone);

    if (!contact) {
      return res.status(404).json({ message: "Contato não encontrado" });
    }

    return res.json(contact);
  } catch (error) {
    console.error("Erro ao buscar contato:", error);
    return res.status(500).json({ message: "Erro ao buscar contato" });
  }
});

umblerRouter.get("/umbler/bots", async (req, res) => {
  try {
    const { query, skip, take, hidden } = req.query;

    const skipNumber = skip ? parseInt(skip as string, 10) : 0;
    const takeNumber = take ? parseInt(take as string, 10) : 34;
    const hiddenBoolean = hidden === "true";

    const bots = await getBots(
      query as string | undefined,
      skipNumber,
      takeNumber,
      // hiddenBoolean
    );

    void hiddenBoolean;

    if (!bots) {
      return res.status(500).json({ error: "Failed to fetch bots" });
    }

    return res.json(bots);
  } catch (error) {
    console.error("Erro ao buscar bots:", error);
    return res.status(500).json({
      message: "Erro ao buscar bots",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/chats", async (req, res) => {
  try {
    const { customerPhone, userId } = req.query as {
      customerPhone: string;
      userId: string;
    };

    const [user] = await db
      .select({
        id: users.id,
        channelId: serviceChannels.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      );

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const chats = await getChat({
      customerPhone,
      selectedChannel: user.channelId!,
    });

    if (!chats) {
      return res.status(404).json({ message: "Chat não encontrado" });
    }

    return res.json(chats);
  } catch (error) {
    console.error("Erro ao buscar chats:", error);
    return res.status(500).json({ message: "Erro ao buscar chats" });
  }
});

umblerRouter.post("/umbler/contacts/create", async (req, res) => {
  try {
    const { userId } = req.query as { userId: string };

    const [user] = await db
      .select({
        id: users.id,
        channelId: serviceChannels.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      );

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const validatedData = createContactSchema.parse(req.body);
    const contact = await syncContact({
      ...validatedData,
      name: validatedData.name ?? undefined,
      email: validatedData.email ?? undefined,
    });

    if (!contact) {
      const result = contact;
      return res
        .status(400)
        .json({ message: "Erro ao sincronizar contato" + result });
    }

    const newChat = await createChat({
      channelId: user.channelId!,
      contactId: contact.contact.id,
    });

    return res
      .status(201)
      .json({ message: "Contato sincronizado com sucesso", newChat });
  } catch (error) {
    console.error("Erro ao criar contato/chat:", error);
    return res.status(500).json({ message: "Erro ao criar contato/chat" });
  }
});

umblerRouter.get("/umbler/contacts", async (req, res) => {
  try {
    const { query, tags, exclusiveTag, fetchAll } = req.query;

    const tagIds = Array.isArray(tags)
      ? (tags as string[])
      : tags
        ? [tags as string]
        : undefined;

    const contacts = await getContacts(
      query as string | undefined,
      tagIds,
      exclusiveTag === "true",
      fetchAll === "true",
    );

    return res.json(contacts);
  } catch (error) {
    console.error("Erro ao buscar contatos:", error);
    return res.status(500).json({ message: "Erro ao buscar contatos" });
  }
});

umblerRouter.put("/umbler/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const updatedContact = await updateContact(id, req.body);

    return res.json(updatedContact);
  } catch (error) {
    console.error("Erro ao atualizar contato:", error);
    return res.status(500).json({ message: "Erro ao atualizar contato" });
  }
});

umblerRouter.delete("/umbler/contacts/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    await deleteContact(id);

    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar contato:", error);
    return res.status(500).json({ message: "Erro ao deletar contato" });
  }
});

umblerRouter.get("/umbler/contacts/:id/tags", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const tags = await getContactTags(id);

    return res.json(tags);
  } catch (error) {
    console.error("Erro ao buscar tags do contato:", error);
    return res.status(500).json({ message: "Erro ao buscar tags do contato" });
  }
});

umblerRouter.get("/umbler/tags", async (req, res) => {
  try {
    const tags = await getTags();
    const query = req.query.query as string | undefined;

    if (!tags) {
      return res.status(500).json({ message: "Erro ao buscar tags" });
    }

    if (!query) {
      return res.json(tags);
    }

    const normalizedQuery = query.toLowerCase();
    const filteredItems = tags.items.filter((tag: { name: string }) =>
      tag.name.toLowerCase().includes(normalizedQuery),
    );

    return res.json({ ...tags, items: filteredItems });
  } catch (error) {
    console.error("Erro ao buscar tags:", error);
    return res.status(500).json({ message: "Erro ao buscar tags" });
  }
});

umblerRouter.get("/umbler/chats/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const chat = await getChatById(id);

    if (!chat) {
      res.status(404).json({ message: "Chat não encontrado" });
    }

    return res.json(chat);
  } catch (error) {
    console.error("Erro ao buscar chat:", error);
    return res.status(500).json({ message: "Erro ao buscar chat" });
  }
});

umblerRouter.post("/umbler/chats", async (req, res) => {
  try {
    const { userId, contactId } = req.body as {
      contactId: string;
      userId: string;
    };

    const [user] = await db
      .select({
        id: users.id,
        channelId: serviceChannels.id,
      })
      .from(users)
      .where(eq(users.id, userId))
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      );

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    const newChat = await createChat({
      channelId: user.channelId!,
      contactId,
    });

    if (!newChat) {
      return res.status(502).json({
        message: "O Umbler não confirmou a solicitação de criação do chat",
      });
    }

    return res.status(201).json({
      status: "requested",
      message: "Solicitação de criação do chat enviada com sucesso",
      contactId,
      channelId: user.channelId,
      newChat,
    });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
});

umblerRouter.post("/umbler/messages", async (req, res) => {
  try {
    const { chatId, message } = req.body as {
      message: string;
      chatId: string;
    };

    const result = await sendMessage({ chatId, message });

    return res.status(201).json({ message: "Mensagem enviada com sucesso", result });
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return res.status(500).json({ message: "Erro ao enviar mensagem" });
  }
});

umblerRouter.post("/umbler/campaigns", async (req, res) => {
  try {
    await createCampaignController(req, res);
  } catch (error) {
    console.error("Erro ao criar campanha:", error);
    return res.status(500).json({
      message: "Erro ao criar campanha",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/campaigns", async (req, res) => {
  try {
    await listCampaignsController(req, res);
  } catch (error) {
    console.error("Erro ao listar campanhas:", error);
    return res.status(500).json({
      message: "Erro ao listar campanhas",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/campaigns/:id", async (req, res) => {
  try {
    await getCampaignDetailsController(req, res);
  } catch (error) {
    console.error("Erro ao buscar detalhes da campanha:", error);
    return res.status(500).json({
      message: "Erro ao buscar detalhes da campanha",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/campaigns/:id/stats", async (req, res) => {
  try {
    await getCampaignStatsController(req, res);
  } catch (error) {
    console.error("Erro ao buscar estatísticas da campanha:", error);
    return res.status(500).json({
      message: "Erro ao buscar estatísticas da campanha",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

umblerRouter.get("/umbler/bot-cashback", async (_req, res) => {
  try {
    const result = await getBotCashback();
    return res.json({ result: result?.bot });
  } catch (error) {
    console.error("Erro ao buscar bot de cashback:", error);
    return res.status(500).json({ message: "Erro ao buscar bot de cashback" });
  }
});

umblerRouter.post("/umbler/cashback", async (req, res) => {
  try {
    const { contactId, value } = req.body as {
      contactId: string;
      value: string;
    };
    const result = await createCashback({ contactId, value });

    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar bot de cashback:", error);
    return res.status(500).json({ message: "Erro ao buscar bot de cashback" });
  }
});

umblerRouter.put("/umbler/cashback/:cashbackId", async (req, res) => {
  try {
    const { cashbackId } = req.params as { cashbackId: string };
    const { value, contactId } = req.body as {
      value: string;
      contactId: string;
    };
    const result = await updateCashback({
      contactId,
      customFieldId: cashbackId,
      value,
    });

    return res.json(result);
  } catch (error) {
    console.error("Erro ao atualizar cashback:", error);
    return res.status(500).json({ message: "Erro ao atualizar cashback" });
  }
});

umblerRouter.post("/client/umbler/tag", async (req, res) => {
  console.log("[UMB_TAG] Webhook recebido:", JSON.stringify(req.body, null, 2));
  return res.status(200).json({ received: true });
});

umblerRouter.get("/umbler/birthday-bots", async (_req, res) => {
  try {
    const bots = await getBirthdayBots();
    return res.json({ items: bots?.items });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário:", error);
    return res.status(500).json({ message: "Erro ao buscar bots de aniversário" });
  }
});

umblerRouter.get("/umbler/birthday-bots-today", async (_req, res) => {
  try {
    const bots = await getBirthdayTodayBotsAutomation();
    return res.json({ items: bots?.items || [] });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário do dia:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar bots de aniversário do dia" });
  }
});

umblerRouter.get("/umbler/birthday-bots-days-before", async (_req, res) => {
  try {
    const bots = await getBirthdayDaysBeforeBotAutomation();
    return res.json({ items: bots?.items || [] });
  } catch (error) {
    console.error("Erro ao buscar bots de aniversário dias antes:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar bots de aniversário dias antes" });
  }
});

umblerRouter.post("/start/birthday-bot", async (req, res) => {
  try {
    const { botId, chatId, triggerName } = req.body as {
      chatId: string;
      botId: string;
      triggerName: string;
    };

    const result = await startBirthdayBot({
      botId,
      chatId,
      triggerName,
    });

    return res
      .status(201)
      .json({ message: "Bot de aniversário iniciado com sucesso", result });
  } catch (error) {
    console.error("Erro ao iniciar bot de aniversário:", error);
    return res.status(500).json({ message: "Erro ao iniciar bot de aniversário" });
  }
});

umblerRouter.get("/umbler/:contactId/cashback-field", async (req, res) => {
  try {
    const { contactId } = req.params as { contactId: string };
    const fields = await getCashbackField(contactId);

    return res.json({
      result: fields
        ? fields.filter(
            (field) => field.customFieldDefinitionId === "aIpL5QxBcwmaXxEo",
          )[0]
        : [],
    });
  } catch (error) {
    console.error("Erro ao buscar campos personalizados:", error);
    return res.status(500).json({ message: "Erro ao buscar campos personalizados" });
  }
});

export default umblerRouter;
