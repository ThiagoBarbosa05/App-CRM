import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  validateBody,
  validateParams,
  validateQuery,
  requireAuth,
  errorHandler,
  dealQuestionParamsSchema,
  dealAnswersParamsSchema,
  dealQuestionsQuerySchema,
  saveDealAnswersBodySchema,
} from "./middleware/validation";
import {
  insertClientSchema,
  insertCompanySchema,
  insertDealSchema,
  updateDealSchema,
  insertDealQuestionSchema,
  updateDealQuestionSchema,
  insertDealAnswerSchema,
  insertUserSchema,
  insertSalesFunnelSchema,
  insertFunnelStageSchema,
  insertBirthdayReminderSchema,
  insertBirthdayReminderSettingsSchema,
  insertTagSchema,
  insertCategorySchema,
  insertMarkerSchema,
  insertSectorSchema,
  insertOriginSchema,
  insertClientInteractionSchema,
  insertUserGoalSchema,
  insertTelemarketingGoalSchema,
  insertClientRegistrationGoalSchema,
  insertCashbackSettingSchema,
  insertCashbackTransactionSchema,
  insertWeeklyResultSchema,
  insertTrainingSchema,
  createTrainingSchema,
  trainings,
  trainingAttachments,
  createDocumentTrainingSchema,
  updateDocumentTrainingSchema,
  createScriptSchema,
  insertProductSchema,
  insertEventSchema,
  insertEventAttachmentSchema,
  insertEventParticipantSchema,
  insertMarkerGoalSchema,
  insertInteractionGoalSchema,
  markerGoals,
  markerWeeklyResults,
  interactionGoals,
  interactionWeeklyResults,
  clientInteractions,
  clients,
  users,
  serviceChannels,
  userServiceChannel,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcrypt";
import { Client } from "@replit/object-storage";
import multer, { MulterError } from "multer";
import { nanoid } from "nanoid";
import { generateAIResponse, generateAIMessage } from "./ai-helpers";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { randomUUID } from "crypto";
import {
  createFileController,
  uploadMiddleware,
} from "./controllers/create-file.controller";
import { deleteFileController } from "./controllers/delete-file.controller";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { db } from "./db";
import { and, asc, eq, like, lte, or, sql, count, gt } from "drizzle-orm";
import {
  createCashback,
  createChat,
  createContactSchema,
  getBirthdayBots,
  getBirthdayTodayBotsAutomation,
  getBirthdayDaysBeforeBotAutomation,
  getBot,
  getBotCashback,
  getCashbackField,
  getChannels,
  getChat,
  getChatById,
  getContactByPhone,
  sendMessage,
  startBirthdayBot,
  syncContact,
  updateCashback,
} from "./integrations/umbler";
import { createCashbackSettingsController } from "./controllers/cashback/create-cashback-settings.controller";
import { deleteCashbackSettingsController } from "./controllers/cashback/delete-cashback-settings.controller";
import { getCashbackSettingsController } from "./controllers/cashback/get-cashback-settings.controller";
import { updateCashbackSettingsController } from "./controllers/cashback/update-cashback-settings.controller";
import {
  getCashbackStatisticsController,
  getExpiringCashbacks,
  getCashbackBalancesController,
  getCashbackTransactionsController,
  getCashbackUsageController,
} from "./controllers/cashback";
import { getCashbackReports } from "./controllers/cashback/get-cashback-reports.controller";
import { getCashbackPerformance } from "./controllers/cashback/get-cashback-performance.controller";
import {
  getSalesStatisticsController,
  getSalesHistoryController,
} from "./controllers/sales";
import {
  getCompanyReportsController,
  getGeneralReportsController,
  getClientReportsController,
} from "./controllers/reports";
import { createMessageAutomationSettingsController } from "./controllers/create-message-automation-settings.controller";
import { getMessageAutomationSettingsController } from "./controllers/get-message-automation-settings.controller";
import { updateMessageAutomationSettingsController } from "./controllers/update-message-automation-settings.controller";
import { deleteMessageAutomationSettingsController } from "./controllers/delete-message-automation-settings.controller";
import { createMessageJobsLogController } from "./controllers/create-message-jobs-logs.controller";
import { getMessageJobsLogsController } from "./controllers/get-message-jobs-logs.controller";
import { updateMessageJobsLogController } from "./controllers/update-message-jobs-logs.controller";
import { deleteMessageJobsLogController } from "./controllers/delete-message-jobs-logs.controller";
import { getTemplatesController } from "./controllers/get-templates-controller";
import { getDealAnsweredQuestionsController } from "./controllers/get-deal-answered-questions.controller";
import { apiRouter } from "./routes/index";

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // === NOVA ARQUITETURA REFATORADA ===
  // Usar novo sistema de rotas modular
  app.use("/api", apiRouter);

  // === ROTAS ANTIGAS (EM MIGRAÇÃO) ===
  // TODO: Migrar gradualmente todas as rotas para a nova arquitetura

  // Umbler Integrations
  app.get("/api/umbler/channels", async (req, res) => {
    try {
      const channels = await db.select().from(serviceChannels);

      res.json(channels);
    } catch (error) {
      console.error("Erro ao buscar canais:", error);
      res.status(500).json({ message: "Erro ao buscar canais" });
    }
  });

  app.get("/api/umbler/whatsapp-api/channels", async (req, res) => {
    try {
      const channels = await getChannels();

      res.json(channels);
    } catch (error) {
      console.error("Erro ao buscar canais:", error);
      res.status(500).json({ message: "Erro ao buscar canais" });
    }
  });

  app.get("/api/umbler/contacts/:phone", async (req, res) => {
    try {
      const { phone } = req.params as { phone: string };
      const contact = await getContactByPhone(phone);

      if (!contact) {
        return res.status(404).json({ message: "Contato não encontrado" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Erro ao buscar contato:", error);
      res.status(500).json({ message: "Erro ao buscar contato" });
    }
  });

  app.get("/api/umbler/bot", async (req, res) => {
    try {
      const { title } = req.query as {
        title: string;
      };

      const result = await getBot(title);

      res.json({ result: result?.items });
    } catch (error) {
      console.error("Erro ao buscar bot:", error);
      res.status(500).json({ message: "Erro ao buscar bot" });
    }
  });

  app.get("/api/umbler/chats", async (req, res) => {
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
          eq(userServiceChannel.serviceChannelId, serviceChannels.id)
        );

      if (!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
      }

      const chats = await getChat({
        customerPhone,
        selectedChannel: user.channelId!,
      });

      if (!chats) {
        return res.status(404).json({ message: "Chat não encontrado" });
      }

      res.json(chats);
    } catch (error) {
      console.error("Erro ao buscar chats:", error);
      res.status(500).json({ message: "Erro ao buscar chats" });
    }
  });

  app.post("/api/users/channel", async (req, res) => {
    try {
      const { userId, serviceChannelId } = req.body;

      if (!userId || !serviceChannelId) {
        return res
          .status(400)
          .json({ message: "ID do usuário e ID do canal são obrigatórios" });
      }

      // Verificar se o usuário e o canal existem
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId));
      if (userExists.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const channelExists = await db
        .select({ id: serviceChannels.id })
        .from(serviceChannels)
        .where(eq(serviceChannels.id, serviceChannelId));
      if (channelExists.length === 0) {
        return res
          .status(404)
          .json({ message: "Canal de serviço não encontrado" });
      }

      // Verificar se já existe uma vinculação para este usuário
      const [existingLink] = await db
        .select()
        .from(userServiceChannel)
        .where(eq(userServiceChannel.userId, userId));

      if (existingLink) {
        // Se já existe, apenas atualiza o canal
        await db
          .update(userServiceChannel)
          .set({ serviceChannelId: serviceChannelId })
          .where(eq(userServiceChannel.userId, userId));

        res.status(200).json({
          message: "Canal do usuário atualizado com sucesso",
          channelId: serviceChannelId,
        });
      } else {
        // Se não existe, cria uma nova vinculação
        await db.insert(userServiceChannel).values({
          userId,
          serviceChannelId,
        });

        res.status(200).json({
          message: "Canal vinculado ao usuário com sucesso",
          channelId: serviceChannelId,
        });
      }
    } catch (error) {
      console.error("Erro ao vincular/atualizar canal do usuário:", error);
      res
        .status(500)
        .json({ message: "Erro interno ao processar a solicitação" });
    }
  });

  app.post("/api/umbler/contacts/create", async (req, res) => {
    try {
      const { userId } = req.query as {
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
          eq(userServiceChannel.serviceChannelId, serviceChannels.id)
        );

      if (!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
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

      res
        .status(201)
        .json({ message: "Contato sincronizado com sucesso", newChat });
    } catch (error) {
      console.error("Erro ao sincronizar contato:", error);
      res.status(500).json({ message: "Erro ao sincronizar contato" });
    }
  });

  app.get("/api/umbler/chats/:id", async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const chat = await getChatById(id);

      if (!chat) {
        res.status(404).json({ message: "Chat não encontrado" });
      }

      res.json(chat);
    } catch (error) {
      console.error("Erro ao buscar chat:", error);
      res.status(500).json({ message: "Erro ao buscar chat" });
    }
  });

  app.post("/api/umbler/chats", async (req, res) => {
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
          eq(userServiceChannel.serviceChannelId, serviceChannels.id)
        );

      if (!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
      }

      const newChat = await createChat({
        channelId: user.channelId!,
        contactId,
      });

      res.status(201).json({ message: "Chat criado com sucesso", newChat });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  app.post("/api/umbler/messages", async (req, res) => {
    try {
      const { chatId, message } = req.body as {
        message: string;
        chatId: string;
      };

      const result = await sendMessage({ chatId, message });

      res.status(201).json({ message: "Mensagem enviada com sucesso", result });
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  app.get("/api/umbler/birthday-bots", async (req, res) => {
    try {
      const bots = await getBirthdayBots();

      res.json({ items: bots?.items });
    } catch (error) {
      console.error("Erro ao buscar bots de aniversário:", error);
      res.status(500).json({ message: "Erro ao buscar bots de aniversário" });
    }
  });

  app.get("/api/umbler/birthday-bots-today", async (req, res) => {
    try {
      const bots = await getBirthdayTodayBotsAutomation();

      res.json({ items: bots?.items || [] });
    } catch (error) {
      console.error("Erro ao buscar bots de aniversário do dia:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar bots de aniversário do dia" });
    }
  });

  app.get("/api/umbler/birthday-bots-days-before", async (req, res) => {
    try {
      const bots = await getBirthdayDaysBeforeBotAutomation();

      res.json({ items: bots?.items || [] });
    } catch (error) {
      console.error("Erro ao buscar bots de aniversário dias antes:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar bots de aniversário dias antes" });
    }
  });

  app.post("/api/start/birthday-bot", async (req, res) => {
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

      res
        .status(201)
        .json({ message: "Bot de aniversário iniciado com sucesso", result });
    } catch (error) {
      console.error("Erro ao iniciar bot de aniversário:", error);
      res.status(500).json({ message: "Erro ao iniciar bot de aniversário" });
    }
  });

  app.get("/api/umbler/:contactId/cashback-field", async (req, res) => {
    try {
      const { contactId } = req.params as { contactId: string };
      const fields = await getCashbackField(contactId);

      res.json({
        result: fields
          ? fields.filter(
              (field) => field.customFieldDefinitionId === "aIpL5QxBcwmaXxEo"
            )[0]
          : [],
      });
    } catch (error) {
      console.error("Erro ao buscar campos personalizados:", error);
      res.status(500).json({ message: "Erro ao buscar campos personalizados" });
    }
  });

  app.get("/api/umbler/bot-cashback", async (req, res) => {
    try {
      const result = await getBotCashback();

      res.json({ result: result?.bot });
    } catch (error) {
      console.error("Erro ao buscar bot de cashback:", error);
      res.status(500).json({ message: "Erro ao buscar bot de cashback" });
    }
  });

  app.post("/api/umbler/cashback", async (req, res) => {
    try {
      const { contactId, value } = req.body as {
        contactId: string;
        value: string;
      };
      const result = await createCashback({ contactId, value });

      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar bot de cashback:", error);
      res.send(500).json({ message: "Erro ao buscar bot de cashback" });
    }
  });

  app.put("/api/umbler/cashback/:cashbackId", async (req, res) => {
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

      res.json(result);
    } catch (error) {
      console.error("Erro ao atualizar cashback:", error);
      res.status(500).json({ message: "Erro ao atualizar cashback" });
    }
  });

  // File management routes
  app.post("/api/files/upload", uploadMiddleware, createFileController);

  app.delete("/api/files/:fileId", deleteFileController);

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log("Tentativa de login:", {
        email,
        password: password ? "***" : "não fornecida",
      });

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: "Email e senha são obrigatórios" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase());
      console.log("Usuário encontrado:", user ? "Sim" : "Não");

      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      console.log("Verificando senha...");
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log("Senha válida:", isValidPassword);

      if (!isValidPassword) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      const userWithoutPassword = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        serviceChannelId: user.serviceChannel?.id,
      };

      console.log("Login bem-sucedido para:", userWithoutPassword);

      res.json({
        user: userWithoutPassword,
        message: "Login realizado com sucesso",
      });
    } catch (error) {
      console.error("Erro no login:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  // Rota da página de Acompanhamento
  app.get("/api/acompanhamento", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const searchQuery = req.query.search as string | undefined;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;

      // --- Base de Condições para as Queries ---
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const clientsWithInteractions = db
        .selectDistinct({ clientId: clientInteractions.clientId })
        .from(clientInteractions);

      const baseConditions = [
        sql`${clients.id} NOT IN ${clientsWithInteractions}`,
        lte(clients.createdAt, oneDayAgo),
      ];

      if (userRole !== "admin" && userRole !== "administrador") {
        baseConditions.push(eq(clients.responsavelId, userId));
      }

      if (searchQuery) {
        const lowercasedQuery = `%${searchQuery.toLowerCase()}%`;
        const searchCondition = or(
          like(clients.name, lowercasedQuery),
          like(clients.phone, lowercasedQuery),
          like(clients.cpf, lowercasedQuery)
        );
        if (searchCondition) {
          baseConditions.push(searchCondition);
        }
      }

      const finalConditions = and(...baseConditions);

      // --- Queries ---

      // 1. Query para buscar os clientes da página atual
      const clientsQuery = db
        .select({
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          email: clients.email,
          cpf: clients.cpf,
          createdAt: clients.createdAt,
          responsavelName: users.name,
        })
        .from(clients)
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .where(finalConditions)
        .orderBy(asc(clients.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      // 2. Query para contar o total de clientes pendentes (para stats e paginação)
      const totalPendentesQuery = db
        .select({ count: count() })
        .from(clients)
        .where(finalConditions);

      // 3. Queries para as estatísticas de prioridade
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const criticosQuery = db
        .select({ count: count() })
        .from(clients)
        .where(and(finalConditions, lte(clients.createdAt, thirtyDaysAgo)));
      const altaQuery = db
        .select({ count: count() })
        .from(clients)
        .where(
          and(
            finalConditions,
            lte(clients.createdAt, fourteenDaysAgo),
            gt(clients.createdAt, thirtyDaysAgo)
          )
        );
      const mediaQuery = db
        .select({ count: count() })
        .from(clients)
        .where(
          and(
            finalConditions,
            lte(clients.createdAt, sevenDaysAgo),
            gt(clients.createdAt, fourteenDaysAgo)
          )
        );
      const normalQuery = db
        .select({ count: count() })
        .from(clients)
        .where(and(finalConditions, gt(clients.createdAt, sevenDaysAgo)));

      // 4. Queries para estatísticas gerais
      const totalClientsInSystemQuery =
        userRole !== "admin" && userRole !== "administrador"
          ? db
              .select({ count: count() })
              .from(clients)
              .where(eq(clients.responsavelId, userId))
          : db.select({ count: count() }).from(clients);
      const totalInteracoesQuery = db
        .select({ count: count() })
        .from(clientInteractions);

      // --- Execução das Queries em Paralelo ---
      const [
        clientsToContactRaw,
        totalPendentesResult,
        criticosResult,
        altaResult,
        mediaResult,
        normalResult,
        totalClientsResult,
        totalInteracoesResult,
      ] = await Promise.all([
        clientsQuery,
        totalPendentesQuery,
        criticosQuery,
        altaQuery,
        mediaQuery,
        normalQuery,
        totalClientsInSystemQuery,
        totalInteracoesQuery,
      ]);

      // --- Processamento e Resposta ---
      const today = new Date();
      const clientsToContact = clientsToContactRaw.map((client) => {
        const createdDate = new Date(client.createdAt);
        const daysSinceCreated = Math.floor(
          (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          ...client,
          daysSinceCreated,
          responsavelName: client.responsavelName || "Não definido",
        };
      });

      const totalPendentes = totalPendentesResult[0].count;
      const totalClientes = totalClientsResult[0].count;
      const totalInteracoes = totalInteracoesResult[0].count;

      const stats = {
        totalPendentes,
        criticos: criticosResult[0].count,
        alta: altaResult[0].count,
        media: mediaResult[0].count,
        normal: normalResult[0].count,
        produtividade:
          totalClientes > 0
            ? Math.round(
                ((totalClientes - totalPendentes) / totalClientes) * 100
              )
            : 100,
        totalInteracoes,
        mediaInteracoes:
          totalClientes > 0
            ? (totalInteracoes / totalClientes).toFixed(1)
            : "0",
      };

      res.json({
        clients: clientsToContact,
        stats,
        pagination: {
          currentPage: page,
          pageSize,
          totalPages: Math.ceil(totalPendentes / pageSize),
          totalItems: totalPendentes,
        },
      });
    } catch (error) {
      console.error("Erro ao buscar dados de acompanhamento:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar dados de acompanhamento" });
    }
  });

  // Client routes
  // app.get("/api/clients", async (req, res) => {
  //   try {
  //     const userId =
  //       (req.query.userId as string) || (req.headers["x-user-id"] as string);
  //     const userRole =
  //       (req.query.userRole as string) ||
  //       (req.headers["x-user-role"] as string);

  //     const clients = await storage.getClients(userId, userRole);
  //     res.json(clients);
  //   } catch (error) {
  //     res.status(500).json({ message: "Erro ao buscar clientes" });
  //   }
  // });

  // MIGRADO: GET /api/clients - Agora utiliza nova arquitetura modular
  // app.get("/api/clients", async (req, res) => {
  //   try {
  //     // Pegar informações do usuário logado da query string ou headers
  //     const userId =
  //       (req.query.userId as string) || (req.headers["x-user-id"] as string);
  //     const userRole =
  //       (req.query.userRole as string) ||
  //       (req.headers["x-user-role"] as string);

  //     // Extrair paginação da query string
  //     const page = parseInt(req.query.page as string) || 1;
  //     const pageSize = parseInt(req.query.pageSize as string) || 100;

  //     // Extrair filtros da query string
  //     const filters = {
  //       search: req.query.search as string | undefined,
  //       name: req.query.name as string | undefined,
  //       phone: req.query.phone as string | undefined,
  //       cpf: req.query.cpf as string | undefined,
  //       responsavelId: req.query.responsavelId as string | undefined,
  //       categoria: req.query.categoria as string | undefined,
  //       origem: req.query.origem as string | undefined,
  //       markers: req.query.markers as string | undefined,
  //     };

  //     const clients = await storage.getClients(
  //       userId,
  //       userRole,
  //       filters,
  //       page,
  //       pageSize
  //     );

  //     // Por enquanto, retorna formato simples com estimativa baseada no tamanho da página
  //     res.json({
  //       data: clients,
  //       currentPage: page,
  //       hasNextPage: clients.length === pageSize,
  //       totalPages: clients.length === pageSize ? page + 1 : page,
  //       totalItems: null, // Será implementado depois
  //     });
  //   } catch (error) {
  //     console.error("Erro ao buscar clientes:", error);
  //     res.status(500).json({ message: "Erro ao buscar clientes" });
  //   }
  // });

  // MIGRADO: GET /api/clients/by-phone/:phone - Agora utiliza nova arquitetura modular
  // app.get("/api/clients/by-phone/:phone", async (req, res) => {
  //   try {
  //     const { phone } = req.params;
  //     const client = await storage.getClientByPhone(phone);
  //     if (!client) {
  //       return res.status(404).json({ message: "Cliente não encontrado" });
  //     }
  //     res.json(client);
  //   } catch (error) {
  //     console.error("Erro ao buscar cliente por telefone:", error);
  //     res.status(500).json({ message: "Erro ao buscar cliente por telefone" });
  //   }
  // });

  // Rota para buscar usuário por email
  app.get("/api/users/by-email/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      res.json(user);
    } catch (error) {
      console.error("Erro ao buscar usuário por email:", error);
      res.status(500).json({ message: "Erro ao buscar usuário por email" });
    }
  });

  // MIGRATED: Rota para buscar clientes sem contato recente
  // Migrated to server/routes/clients.routes.ts - GET /without-contact
  /*
    app.get("/api/clients/without-contact", async (req, res) => {
      try {
        const userId =
          (req.query.userId as string) || (req.headers["x-user-id"] as string);
        const userRole =
          (req.query.userRole as string) ||
          (req.headers["x-user-role"] as string);
        const days = parseInt(req.query.days as string) || 1;

        const clients = await storage.getClientsWithoutRecentContact(
          userId,
          userRole,
          days
        );
        res.json(clients);
      } catch (error) {
        console.error("Erro ao buscar clientes sem contato:", error);
        res.status(500).json({ message: "Erro ao buscar clientes sem contato" });
      }
    });
    */

  // MIGRATED: Rota específica para exportação - retorna TODOS os clientes do sistema
  // Migrated to server/routes/clients.routes.ts - GET /export-all
  /*
    app.get("/api/clients/export-all", async (req, res) => {
      try {
        // Verificar se o usuário é admin (apenas admins podem exportar todos os dados)
        const userRole = req.headers["x-user-role"] as string;

        if (userRole !== "admin" && userRole !== "administrador") {
          return res.status(403).json({
            message:
              "Acesso negado. Apenas administradores podem exportar todos os dados.",
          });
        }

        const clients = await storage.getAllClientsForExport();
        res.json(clients);
      } catch (error) {
        console.error("Erro ao buscar todos os clientes para exportação:", error);
        res.status(500).json({ message: "Erro ao buscar dados para exportação" });
      }
    });
    */

  // MIGRATED: POST /api/clients - Criação de cliente
  // Migrated to server/routes/clients.routes.ts - POST /
  /*
    app.post("/api/clients", async (req, res) => {
      try {
        console.log(
          "Dados recebidos para criação de cliente:",
          JSON.stringify(req.body, null, 2)
        );

        // Pegar informações do usuário logado
        const userId =
          (req.query.userId as string) || (req.headers["x-user-id"] as string);
        const userRole =
          (req.query.userRole as string) ||
          (req.headers["x-user-role"] as string);

        // Converter strings vazias em null para campos opcionais
        let processedData = {
          ...req.body,
          responsavelId:
            req.body.responsavelId === "" ? null : req.body.responsavelId,
          cpf: req.body.cpf === "" ? null : req.body.cpf,
          email: req.body.email === "" ? null : req.body.email,
          categoria: req.body.categoria || "Geral",
          origem: req.body.origem || "Website",
        };

        // Se não for admin e não foi especificado um responsável, usar o usuário atual
        if (userRole !== "admin" && !processedData.responsavelId) {
          processedData.responsavelId = userId;
        }

        const validatedData = insertClientSchema.parse(processedData);
        const client = await storage.createClient(validatedData);
        res.status(201).json(client);
      } catch (error) {
        console.error("Erro na criação do cliente:", error);
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          console.error("Erro de validação Zod:", validationError.toString());
          return res.status(400).json({ message: validationError.toString() });
        }

        // Verificar se é erro de telefone duplicado (abordagem simples)
        if (error && error.toString().includes("clients_phone_unique")) {
          return res.status(400).json({
            message:
              "Este número de telefone já está cadastrado para outro cliente.",
          });
        }

        res.status(500).json({ message: "Erro ao criar cliente" });
      }
    });
    */

  // MIGRATED: PUT /api/clients/:id - Atualização de cliente
  // Migrated to server/routes/clients.routes.ts - PUT /:id
  /*
    app.put("/api/clients/:id", async (req, res) => {
      try {
        // Pegar informações do usuário logado
        const userId =
          (req.query.userId as string) || (req.headers["x-user-id"] as string);
        const userRole =
          (req.query.userRole as string) ||
          (req.headers["x-user-role"] as string);

        // Converter strings vazias em null para campos opcionais
        let processedData = {
          ...req.body,
          responsavelId:
            req.body.responsavelId === "" ? null : req.body.responsavelId,
          cpf: req.body.cpf === "" ? null : req.body.cpf,
          email: req.body.email === "" ? null : req.body.email,
        };

        // Se não for admin e não foi especificado um responsável, usar o usuário atual
        if (userRole !== "admin" && !processedData.responsavelId) {
          processedData.responsavelId = userId;
        }

        const validatedData = insertClientSchema.partial().parse(processedData);
        const client = await storage.updateClient(req.params.id, validatedData);
        res.json(client);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }

        // Verificar se é erro de telefone duplicado (abordagem simples)
        if (error && error.toString().includes("clients_phone_unique")) {
          return res.status(400).json({
            message:
              "Este número de telefone já está cadastrado para outro cliente.",
          });
        }

        res.status(500).json({ message: "Erro ao atualizar cliente" });
      }
    });
    */

  // MIGRATED: DELETE /api/clients/:id - Exclusão de cliente individual
  // Migrated to server/routes/clients.routes.ts - DELETE /:id
  /*
    app.delete("/api/clients/:id", async (req, res) => {
      try {
        const success = await storage.deleteClient(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Cliente não encontrado" });
        }
        res.json({
          message: "Cliente e dados relacionados excluídos com sucesso",
        });
      } catch (error) {
        console.error("Erro ao excluir cliente:", error);
        res.status(500).json({ message: "Erro ao excluir cliente" });
      }
    });
    */

  // MIGRATED: DELETE /api/clients - Exclusão em lote de clientes (admin only)
  /*
    app.delete("/api/clients", async (req, res) => {
      try {
        // Verificar se o usuário é administrador
        const userEmail = req.headers["x-user-email"] as string;
        const userRole = req.headers["x-user-role"] as string;

        if (
          !userEmail ||
          !userRole ||
          (userRole !== "administrador" && userRole !== "admin")
        ) {
          return res.status(403).json({
            message:
              "Acesso negado. Apenas administradores podem excluir clientes.",
          });
        }

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "Lista de IDs é obrigatória" });
        }

        const deletedCount = await storage.deleteClients(ids);

        res.json({
          message: `${deletedCount} cliente(s) e dados relacionados excluídos com sucesso`,
          deletedCount,
        });
      } catch (error) {
        console.error("Erro na exclusão em lote:", error);
        res.status(500).json({
          message:
            "Erro ao excluir clientes. Alguns podem ter dados relacionados.",
        });
      }
    });
    */

  // Company routes
  // MIGRATED: GET /api/companies - Busca de empresas com filtros e paginação
  /*
    app.get("/api/companies", async (req, res) => {
      try {
        const {
          userId,
          userRole,
          search,
          nomeFantasia,
          razaoSocial,
          cnpj,
          responsavelId,
        } = req.query;
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 20;

        const filters = {
          search: search as string | undefined,
          nomeFantasia: nomeFantasia as string | undefined,
          razaoSocial: razaoSocial as string | undefined,
          cnpj: cnpj as string | undefined,
          responsavelId: responsavelId as string | undefined,
        };

        const { data, total } = await storage.getCompanies(
          userId as string,
          userRole as string,
          filters,
          page,
          pageSize
        );

        res.json({
          data,
          currentPage: page,
          totalPages: Math.ceil(total / pageSize),
          totalItems: total,
        });
      } catch (error) {
        console.error("Erro ao buscar empresas:", error);
        res.status(500).json({ message: "Erro ao buscar empresas" });
      }
    });
    */

  // MIGRATED: POST /api/companies - Criação de empresa
  /*
    app.post("/api/companies", async (req, res) => {
      try {
        const validatedData = insertCompanySchema.parse(req.body);
        const company = await storage.createCompany(validatedData);
        res.status(201).json(company);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        res.status(500).json({ message: "Erro ao criar empresa" });
      }
    });
    */

  // MIGRATED: PUT /api/companies/:id - Atualização de empresa
  /*
    app.put("/api/companies/:id", async (req, res) => {
      try {
        const validatedData = insertCompanySchema.partial().parse(req.body);
        const company = await storage.updateCompany(req.params.id, validatedData);
        if (!company) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }
        res.json(company);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        res.status(500).json({ message: "Erro ao atualizar empresa" });
      }
    });
    */

  // MIGRATED: DELETE /api/companies/:id - Exclusão de empresa individual
  /*
    app.delete("/api/companies/:id", async (req, res) => {
      try {
        const success = await storage.deleteCompany(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Empresa não encontrada" });
        }
        res.json({ message: "Empresa excluída com sucesso" });
      } catch (error) {
        console.error("Erro ao excluir empresa:", error);
        res.status(500).json({ message: "Erro ao deletar empresa" });
      }
    });
    */

  // MIGRATED: DELETE /api/companies - Exclusão em lote de empresas
  /*
    app.delete("/api/companies", async (req, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ message: "IDs das empresas são obrigatórios" });
        }

        console.log("Tentando excluir empresas com IDs:", ids);
        const deletedCount = await storage.deleteCompanies(ids);
        console.log("Empresas excluídas:", deletedCount);

        res.json({
          message: deletedCount + " empresa(s) excluída(s) com sucesso",
          deletedCount,
        });
      } catch (error) {
        console.error("Erro ao excluir empresas:", error);
        res.status(500).json({ message: "Erro ao excluir empresas" });
      }
    });
    */

  // MIGRATED: GET /api/funnels - Busca de funis de vendas
  /*
    app.get("/api/funnels", async (req, res) => {
      try {
        const funnels = await storage.getSalesFunnels();
        res.json(funnels);
      } catch (error) {
        res.status(500).json({ message: "Erro ao buscar funis de vendas" });
      }
    });
    */

  // MIGRATED: POST /api/funnels - Criação de funil de vendas
  /*
    app.post("/api/funnels", async (req, res) => {
      try {
        const validatedData = insertSalesFunnelSchema.parse(req.body);
        const funnel = await storage.createSalesFunnel(validatedData);
        res.status(201).json(funnel);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: fromZodError(error).toString() });
        }
        res.status(500).json({ message: "Erro ao criar funil de vendas" });
      }
    });
    */

  // MIGRATED: PUT /api/funnels/:id - Atualização de funil de vendas
  /*
    app.put("/api/funnels/:id", async (req, res) => {
      try {
        const funnelId = req.params.id;
        const validatedData = insertSalesFunnelSchema.partial().parse(req.body);
        const funnel = await storage.updateSalesFunnel(funnelId, validatedData);
        res.status(201).json(funnel);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: fromZodError(error).toString() });
        }
        res.status(500).json({ message: "Erro ao criar funil de vendas" });
      }
    });
    */

  // MIGRATED: DELETE /api/funnels/:id - Exclusão de funil de vendas
  /*
    app.delete("/api/funnels/:id", async (req, res) => {
      try {
        const funnelsId = req.params.id;
        await storage.deleteSalesFunnel(funnelsId);

        res.send({ message: "Funil de vendas excluído com sucesso" });
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Erro ao excluir funil de vendas" });
      }
    });
    */

  // Funnel Stage routes
  // MIGRADO: GET /api/funnels/:funnelId/stages - ver funnels.routes.ts
  /*
    app.get("/api/funnels/:funnelId/stages", async (req, res) => {
      try {
        const stages = await storage.getFunnelStages(req.params.funnelId);
        res.json(stages);
      } catch (error) {
        res.status(500).json({ message: "Erro ao buscar estágios do funil" });
      }
    });
    */

  // MIGRADO: POST /api/funnel-stages/:funnelId - ver funnels.routes.ts
  /*
    app.post("/api/funnel-stages/:funnelId", async (req, res) => {
      try {
        const validatedData = insertFunnelStageSchema.parse(req.body);
        const stage = await storage.createFunnelStage({
          ...validatedData,
          funnelId: req.params.funnelId,
        });
        res.status(201).json(stage);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: fromZodError(error).toString() });
        }
        res.status(500).json({ message: "Erro ao criar estágio" });
      }
    });
    */

  // MIGRADO: PUT /api/funnel-stages/reorder - ver funnels.routes.ts
  /*
    app.put("/api/funnel-stages/reorder", async (req, res) => {
      try {
        const { stageUpdates } = req.body;
        if (!Array.isArray(stageUpdates)) {
          return res
            .status(400)
            .json({ message: "stageUpdates deve ser um array" });
        }

        const success = await storage.reorderFunnelStages(stageUpdates);
        if (success) {
          res.json({ message: "Etapas reordenadas com sucesso" });
        } else {
          res.status(500).json({ message: "Erro ao reordenar etapas" });
        }
      } catch (error) {
        res.status(500).json({ message: "Erro ao reordenar etapas" });
      }
    });
    */

  // Deal routes
  // MIGRADO: GET /api/deals - ver deals.routes.ts
  /*
    app.get("/api/deals", async (req, res) => {
      try {
        const { userId, userRole, funnelId } = req.query;
        const deals = await storage.getDealsWithClients(
          funnelId as string,
          userId as string,
          userRole as string
        );
        res.json(deals);
      } catch (error) {
        console.error("API /deals error:", error);
        res.status(500).json({ message: "Erro ao buscar deals" });
      }
    });
    */

  // MIGRADO: PUT /api/deals/:dealId - ver deals.routes.ts
  /*
    app.put("/api/deals/:dealId", async (req, res) => {
      try {
        const dealId = req.params.dealId;
        const data = updateDealSchema.parse(req.body);

        // Validar o valor se estiver presente
        if (data.value !== undefined && data.value !== null) {
          const numeric = parseFloat(data.value.toString());

          if (isNaN(numeric)) {
            return res.status(400).json({ message: "Valor inválido" });
          }

          data.value = numeric.toString();
        }

        const deals = await storage.updateDeal(dealId, data);
        res.json(deals);
      } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Erro ao atualizar deals" });
      }
    });
    */

  // MIGRADO: DELETE /api/deals/:id - ver deals.routes.ts
  /*
    app.delete("/api/deals/:id", async (req, res) => {
      try {
        const success = await storage.deleteDeal(req.params.id);
        if (!success) {
          return res.status(404).json({ message: "Negócio não encontrado" });
        }
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ message: "Erro ao deletar negócio" });
      }
    });
    */

  // MIGRADO PARA MODULAR: server/routes/deals.routes.ts - POST /api/deals
  /*
    app.post("/api/deals", async (req, res) => {
      try {
        const validatedData = insertDealSchema.parse(req.body);

        // Validar o valor se estiver presente
        if (validatedData.value !== undefined && validatedData.value !== null) {
          const numeric = parseFloat(validatedData.value.toString());

          if (isNaN(numeric)) {
            return res.status(400).json({ message: "Valor inválido" });
          }

          validatedData.value = numeric.toString();
        }

        // If no title is provided, generate one based on client/company name
        if (!validatedData.title) {
          if (validatedData.clientId) {
            const client = await storage.getClient(validatedData.clientId);
            validatedData.title = client
              ? `Negócio - ${client.name}`
              : "Novo Negócio";
          } else if (validatedData.companyId) {
            const company = await storage.getCompany(validatedData.companyId);
            validatedData.title = company
              ? `Negócio - ${company.nomeFantasia || company.razaoSocial}`
              : "Novo Negócio";
          } else {
            validatedData.title = "Novo Negócio";
          }
        }

        const deal = await storage.createDeal(validatedData);
        res.status(201).json(deal);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        console.error("Erro ao criar deal:", error);
        res.status(500).json({ message: "Erro ao criar deal" });
      }
    });
    */

  // MIGRADO PARA MODULAR: server/routes/deals.routes.ts - POST /api/deals/bulk
  /*
    // Bulk deal creation
    app.post("/api/deals/bulk", async (req, res) => {
      try {
        console.log(
          "=== BULK DEALS - BODY COMPLETO ===",
          JSON.stringify(req.body, null, 2)
        );
        const { companies, funnelId, stageId, value, assignedTo, notes, title } =
          req.body;

        console.log("=== BULK DEALS - DADOS EXTRAIDOS ===", {
          companies: companies?.length,
          funnelId,
          stageId,
          value,
          assignedTo,
          notes,
          title,
        });

        if (!companies || !Array.isArray(companies) || companies.length === 0) {
          return res.status(400).json({ message: "Empresas são obrigatórias" });
        }

        // Verificar se assignedTo está definido
        if (!assignedTo) {
          return res.status(400).json({ message: "Responsável é obrigatório" });
        }

        const deals = [];
        const errors = [];

        for (const companyId of companies) {
          try {
            const company = await storage.getCompany(companyId);
            if (!company) {
              errors.push(`Empresa com ID ${companyId} não encontrada`);
              continue;
            }

            const dealTitle =
              title || `Negócio - ${company.nomeFantasia || company.razaoSocial}`;

            const dealData = {
              companyId,
              funnelId,
              stageId,
              value,
              assignedTo: assignedTo || "87dddc4d-2b4a-4cdd-8b5f-d2ab72ba7aca", // Fallback para admin user
              notes,
              title: dealTitle,
              createdBy: assignedTo || "87dddc4d-2b4a-4cdd-8b5f-d2ab72ba7aca", // Fallback para admin user
            };

            const validatedData = insertDealSchema.parse(dealData);
            const deal = await storage.createDeal(validatedData);
            deals.push(deal);
          } catch (error) {
            errors.push(
              `Erro ao criar negócio para empresa ${companyId}: ${
                error instanceof Error ? error.message : "Erro desconhecido"
              }`
            );
          }
        }

        if (deals.length === 0) {
          return res.status(400).json({
            message: "Nenhum negócio foi criado",
            errors,
          });
        }

        res.status(201).json({
          success: true,
          created: deals.length,
          total: companies.length,
          deals,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (error) {
        console.error("Erro na criação de negócios em lote:", error);
        res.status(500).json({ message: "Erro ao criar negócios em lote" });
      }
    });
    */

  // MIGRADO PARA MODULAR: server/routes/deals.routes.ts - POST /api/deals/bulk-clients
  /*
    // Bulk deal creation for clients
    app.post("/api/deals/bulk-clients", async (req, res) => {
      try {
        console.log(
          "=== BULK DEALS CLIENTS - BODY COMPLETO ===",
          JSON.stringify(req.body, null, 2)
        );
        const { clients, funnelId, stageId, value, assignedTo, notes, title } =
          req.body;

        console.log("=== BULK DEALS CLIENTS - DADOS EXTRAIDOS ===", {
          clients: clients?.length,
          funnelId,
          stageId,
          value,
          assignedTo,
          notes,
          title,
        });

        if (!clients || !Array.isArray(clients) || clients.length === 0) {
          return res.status(400).json({ message: "Clientes são obrigatórios" });
        }

        // Verificar se assignedTo está definido
        if (!assignedTo) {
          return res.status(400).json({ message: "Responsável é obrigatório" });
        }

        const deals = [];
        const errors = [];

        for (const clientId of clients) {
          try {
            const client = await storage.getClient(clientId);
            if (!client) {
              errors.push(`Cliente com ID ${clientId} não encontrado`);
              continue;
            }

            const dealTitle = title || `Negócio - ${client.name}`;

            const dealData = {
              clientId,
              funnelId,
              stageId,
              value,
              assignedTo: assignedTo || "87dddc4d-2b4a-4cdd-8b5f-d2ab72ba7aca", // Fallback para admin user
              notes,
              title: dealTitle,
              createdBy: assignedTo || "87dddc4d-2b4a-4cdd-8b5f-d2ab72ba7aca", // Fallback para admin user
            };

            const validatedData = insertDealSchema.parse(dealData);
            const deal = await storage.createDeal(validatedData);
            deals.push(deal);
          } catch (error) {
            errors.push(
              `Erro ao criar negócio para cliente ${clientId}: ${
                error instanceof Error ? error.message : "Erro desconhecido"
              }`
            );
          }
        }

        if (deals.length === 0) {
          return res.status(400).json({
            message: "Nenhum negócio foi criado",
            errors,
          });
        }

        res.status(201).json({
          success: true,
          created: deals.length,
          total: clients.length,
          errors: errors.length,
          errorDetails: errors.length > 0 ? errors : undefined,
          deals,
        });
      } catch (error) {
        console.error(
          "Erro na criação de negócios em lote para clientes:",
          error
        );
        res
          .status(500)
          .json({ message: "Erro ao criar negócios em lote para clientes" });
      }
    });
    */

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - GET /api/deal-questions
  /*
    // Deal Questions Management Routes
    // Get all deal questions
    app.get(
      "/api/deal-questions",
      validateQuery(dealQuestionsQuerySchema),
      async (req, res) => {
        try {
          const { category, isActive } = req.query;

          // Converter parâmetros já validados pelo middleware
          const filters: { category?: string; isActive?: boolean } = {};

          if (category) {
            filters.category = category as string;
          }

          if (isActive) {
            filters.isActive = isActive === "true";
          }

          const questions = await storage.getDealQuestions(filters);
          res.json(questions);
        } catch (error) {
          console.error("Erro ao buscar perguntas dos deals:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao buscar perguntas",
            error:
              process.env.NODE_ENV === "development"
                ? (error as Error).message
                : undefined,
          });
        }
      }
    );
    */

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - POST /api/deal-questions
  /*
    // Create new deal question
    app.post(
      "/api/deal-questions",
      requireAuth,
      validateBody(insertDealQuestionSchema),
      async (req, res) => {
        try {
          const questionData = req.body;

          const question = await storage.createDealQuestion(questionData);
          res.status(201).json(question);
        } catch (error) {
          console.error("Erro ao criar pergunta do deal:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao criar pergunta",
            error:
              process.env.NODE_ENV === "development"
                ? (error as Error).message
                : undefined,
          });
        }
      }
    );
    */

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - PUT /api/deal-questions/:id
  /*
    // Update deal question
    app.put(
      "/api/deal-questions/:id",
      validateParams(dealQuestionParamsSchema),
      validateBody(updateDealQuestionSchema),
      async (req, res) => {
        try {
          const { id } = req.params;

          // Verificar se a pergunta existe antes de atualizar
          const existingQuestions = await storage.getDealQuestions();
          const existingQuestion = existingQuestions.find((q) => q.id === id);

          if (!existingQuestion) {
            return res.status(404).json({ message: "Pergunta não encontrada" });
          }

          const question = await storage.updateDealQuestion(id, req.body);

          if (!question) {
            return res.status(404).json({ message: "Pergunta não encontrada" });
          }

          res.json(question);
        } catch (error) {
          console.error("Erro ao atualizar pergunta do deal:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao atualizar pergunta",
            error:
              process.env.NODE_ENV === "development"
                ? (error as Error).message
                : undefined,
          });
        }
      }
    );
    */

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - DELETE /api/deal-questions/:id
  // Delete deal question
  /*app.delete(
      "/api/deal-questions/:id",
      validateParams(dealQuestionParamsSchema),
      async (req, res) => {
        try {
          const { id } = req.params;

          // Validar ID
          if (!id || typeof id !== "string" || id.trim().length === 0) {
            return res
              .status(400)
              .json({ message: "ID da pergunta é obrigatório" });
          }

          // Verificar se a pergunta existe
          const existingQuestions = await storage.getDealQuestions();
          const existingQuestion = existingQuestions.find((q) => q.id === id);

          if (!existingQuestion) {
            return res.status(404).json({ message: "Pergunta não encontrada" });
          }

          const success = await storage.deleteDealQuestion(id);
          if (!success) {
            return res.status(500).json({ message: "Falha ao deletar pergunta" });
          }

          res.status(204).send();
        } catch (error) {
          console.error("Erro ao deletar pergunta do deal:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao deletar pergunta",
            // error:
            //   process.env.NODE_ENV === "development" ? error.message : undefined,
          });
        }
      }
    );*/

  // MIGRADO PARA MODULAR: server/routes/deal-answers.routes.ts - GET /api/deals/:dealId/answers
  // Deal Answers Routes
  // Get answers for a specific deal
  /*app.get(
      "/api/deals/:dealId/answers",
      validateParams(dealAnswersParamsSchema),
      async (req, res) => {
        try {
          const { dealId } = req.params;

          // Validar dealId
          if (
            !dealId ||
            typeof dealId !== "string" ||
            dealId.trim().length === 0
          ) {
            return res.status(400).json({ message: "ID do deal é obrigatório" });
          }

          // Verificar se o deal existe
          const deal = await storage.getDealById(dealId);
          if (!deal) {
            return res.status(404).json({ message: "Deal não encontrado" });
          }

          const answers = await storage.getDealAnswers(dealId);
          res.json(answers || []);
        } catch (error) {
          console.error("Erro ao buscar respostas do deal:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao buscar respostas",
            // error:
            //   process.env.NODE_ENV === "development" ? error.message : undefined,
          });
        }
      }
    );*/

  // MIGRADO PARA MODULAR: server/routes/deal-answers.routes.ts - POST /api/deals/:dealId/answers
  // Save/update answers for a deal
  /*app.post(
      "/api/deals/:dealId/answers",
      validateParams(dealAnswersParamsSchema),
      validateBody(saveDealAnswersBodySchema),
      async (req, res) => {
        try {
          const { dealId } = req.params;
          const { answers } = req.body;

          // Verificar se o deal existe
          const deal = await storage.getDealById(dealId);
          if (!deal) {
            return res.status(404).json({ message: "Deal não encontrado" });
          }

          // Verificar se todas as perguntas referenciadas existem
          const questionIds = answers.map((a: any) => a.questionId);
          const questions = await storage.getDealQuestions();
          const existingQuestionIds = questions.map((q) => q.id);

          const invalidQuestionIds = questionIds.filter(
            (id: string) => !existingQuestionIds.includes(id)
          );
          if (invalidQuestionIds.length > 0) {
            return res.status(400).json({
              message: "Algumas perguntas não existem",
              invalidQuestionIds,
            });
          }

          // Os dados já foram validados pelo middleware, apenas garantir que dealId está correto
          const answersWithDealId = answers.map((answer: any) => ({
            dealId,
            questionId: answer.questionId,
            answerBoolean: answer.answerBoolean,
            answerNumber: answer.answerNumber,
            answerText: answer.answerText,
          }));

          const dealAnswers = await storage.saveDealAnswers(
            dealId,
            answersWithDealId
          );
          res.json(dealAnswers);
        } catch (error) {
          console.error("Erro ao salvar respostas do deal:", error);
          res.status(500).json({
            message: "Erro interno do servidor ao salvar respostas",
            error:
              process.env.NODE_ENV === "development"
                ? (error as Error).message
                : undefined,
          });
        }
      }
    );*/

  // MIGRADO PARA MODULAR: server/routes/deal-answers.routes.ts - GET /api/deals/:dealId/complete
  // Get deal with all information including answers
  /*app.get("/api/deals/:dealId/complete", async (req, res) => {
      try {
        const deal = await storage.getDealWithAnswers(req.params.dealId);
        if (!deal) {
          return res.status(404).json({ message: "Deal não encontrado" });
        }
        res.json(deal);
      } catch (error) {
        console.error("Erro ao buscar deal completo:", error);
        res.status(500).json({ message: "Erro ao buscar deal completo" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - GET /api/deal-questions/stats
  // Get deal questions statistics
  /*app.get("/api/deal-questions/stats", async (req, res) => {
      try {
        const stats = await storage.getDealQuestionsStats();
        res.json(stats);
      } catch (error) {
        console.error("Erro ao buscar estatísticas das perguntas:", error);
        res
          .status(500)
          .json({ message: "Erro ao buscar estatísticas das perguntas" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/deal-questions.routes.ts - POST /api/deal-questions/seed
  // Seed default questions
  /*app.post("/api/deal-questions/seed", async (req, res) => {
      try {
        await storage.seedDefaultDealQuestions();
        res.json({ message: "Perguntas padrão criadas com sucesso" });
      } catch (error) {
        console.error("Erro ao popular perguntas padrão:", error);
        res.status(500).json({ message: "Erro ao popular perguntas padrão" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/users.routes.ts - GET /api/users
  // User routes
  /*app.get("/api/users", async (req, res) => {
      try {
        const users = await storage.getUsers();
        // Remove passwords from response
        const usersWithoutPasswords = users.map(({ password, ...user }) => user);
        res.json(usersWithoutPasswords);
      } catch (error) {
        res.status(500).json({ message: "Erro ao buscar usuários" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/users.routes.ts - POST /api/users
  /*app.post("/api/users", async (req, res) => {
      try {
        const validatedData = insertUserSchema.parse(req.body);
        const newUser = await storage.createUser(validatedData);
        const { password: _, ...userWithoutPassword } = newUser;
        res.status(201).json(userWithoutPassword);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        res.status(500).json({ message: "Erro ao criar usuário" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/users.routes.ts - PUT /api/users/:id
  /*app.put("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const validatedData = insertUserSchema.partial().parse(req.body);
        const updatedUser = await storage.updateUser(id, validatedData);
        if (!updatedUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const { password: _, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        res.status(500).json({ message: "Erro ao atualizar usuário" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/users.routes.ts - DELETE /api/users/:id
  /*app.delete("/api/users/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const deleted = await storage.deleteUser(id);
        if (!deleted) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        res.json({ message: "Usuário excluído com sucesso" });
      } catch (error) {
        res.status(500).json({ message: "Erro ao excluir usuário" });
      }
    });*/

  // MIGRADO PARA MODULAR: server/routes/users.routes.ts - PATCH /api/users/:id/toggle-status
  /*app.patch("/api/users/:id/toggle-status", async (req, res) => {
      try {
        const { id } = req.params;
        const { isActive } = req.body;
        const updatedUser = await storage.updateUser(id, { isActive });
        if (!updatedUser) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const { password: _pwd, ...userWithoutPassword } = updatedUser;
        res.json(userWithoutPassword);
      } catch (error) {
        res.status(500).json({ message: "Erro ao atualizar status do usuário" });
      }
    });*/

  // Birthday routes
  // MIGRADO: GET /api/upcoming-birthdays -> GET /api/birthdays/upcoming (birthdays.routes.ts)
  // app.get("/api/upcoming-birthdays", async (req, res) => {
  //   try {
  //     const days = parseInt(req.query.days as string) || 7;
  //     const userId = req.headers["x-user-id"] as string;
  //     const userRole = req.headers["x-user-role"] as string;
  //     const responsibleId = req.query.responsibleId as string;

  //     // Se um responsibleId específico for passado, usar esse
  //     // Se não, e o usuário não for admin, filtrar pelos clientes do usuário atual
  //     let filterByResponsible = responsibleId;
  //     if (
  //       !filterByResponsible &&
  //       userRole !== "admin" &&
  //       userRole !== "administrador"
  //     ) {
  //       filterByResponsible = userId;
  //     }

  //     const upcomingBirthdays = await storage.getUpcomingBirthdays(
  //       days,
  //       filterByResponsible
  //     );
  //     res.json(upcomingBirthdays);
  //   } catch (error) {
  //     console.error("Erro ao buscar aniversários próximos:", error);
  //     res.status(500).json({ message: "Erro ao buscar aniversários próximos" });
  //   }
  // });

  // Tags routes (categories, origins, markers)
  // MIGRADO: GET /api/categories -> GET /api/tags/categories (tags.routes.ts)
  // app.get("/api/categories", async (req, res) => {
  //   try {
  //     const categories = await storage.getTagsByType("categoria");
  //     res.json(categories);
  //   } catch (error) {
  //     console.error("Erro ao buscar categorias:", error);
  //     res.status(500).json({ message: "Erro ao buscar categorias" });
  //   }
  // });

  // MIGRADO: GET /api/origins -> GET /api/tags/origins (tags.routes.ts)
  // app.get("/api/origins", async (req, res) => {
  //   try {
  //     const origins = await storage.getTagsByType("origem");
  //     res.json(origins);
  //   } catch (error) {
  //     console.error("Erro ao buscar origens:", error);
  //     res.status(500).json({ message: "Erro ao buscar origens" });
  //   }
  // });

  // MIGRADO: GET /api/markers -> GET /api/tags/markers (tags.routes.ts)
  // app.get("/api/markers", async (req, res) => {
  //   try {
  //     const markers = await storage.getTagsByType("marcador");
  //     res.json(markers);
  //   } catch (error) {
  //     console.error("Erro ao buscar marcadores:", error);
  //     res.status(500).json({ message: "Erro ao buscar marcadores" });
  //   }
  // });

  // Client Interactions routes
  // MIGRADO: POST /api/interactions -> POST /api/interactions (interactions.routes.ts)
  // app.post("/api/interactions", async (req, res) => {
  //   try {
  //     const userId = req.headers["x-user-id"] as string;
  //     if (!userId) {
  //       return res.status(401).json({ message: "Usuário não autenticado." });
  //     }

  //     const data = { ...req.body, userId };

  //     if (data.date && typeof data.date === "string") {
  //       data.date = new Date(data.date);
  //     }

  //     const validatedData = insertClientInteractionSchema.parse(data);

  //     const [newInteraction] = await db
  //       .insert(clientInteractions)
  //       .values(validatedData)
  //       .returning();

  //     res.status(201).json(newInteraction);
  //     res.send();
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       const validationError = fromZodError(error);
  //       console.error(
  //         "Erro de validação ao criar interação:",
  //         validationError.toString()
  //       );
  //       return res.status(400).json({ message: validationError.toString() });
  //     }
  //     console.error("Erro no servidor ao criar interação:", error);
  //     res.status(500).json({ message: "Erro interno ao criar a interação." });
  //   }
  // });

  // ========================================================================
  // CASHBACK SETTINGS ROUTES - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  //
  // Rotas disponíveis em /api/cashback-settings:
  // - GET    /api/cashback-settings          -> Busca todas as configurações
  // - POST   /api/cashback-settings          -> Cria nova configuração
  // - PUT    /api/cashback-settings/:id      -> Atualiza configuração
  // - DELETE /api/cashback-settings/:id      -> Exclui configuração
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-settings.repository.ts
  // - Service:    server/services/cashback-settings.service.ts
  // - Controllers: server/controllers/get-cashback-settings.controller.ts
  //                server/controllers/create-cashback-settings.controller.ts
  //                server/controllers/update-cashback-settings.controller.ts
  //                server/controllers/delete-cashback-settings.controller.ts
  // - Router:      server/routes/cashback-settings.routes.ts
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular
  // app.get("/api/cashback-settings", async (req, res) => {
  //   try {
  //     const settings = await storage.getCashbackSettings();
  //     res.json(settings);
  //   } catch (error) {
  //     console.error("Erro ao buscar configurações de cashback:", error);
  //     res.status(500).json({ message: "Erro ao buscar configurações" });
  //   }
  // });

  // app.post("/api/cashback-settings", async (req, res) => {
  //   try {
  //     const validatedData = insertCashbackSettingSchema.parse(req.body);
  //     const setting = await storage.createCashbackSetting(validatedData);
  //     res.status(201).json(setting);
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       const validationError = fromZodError(error);
  //       return res.status(400).json({ message: validationError.toString() });
  //     }
  //     console.error("Erro ao criar configuração:", error);
  //     res.status(500).json({ message: "Erro ao criar configuração" });
  //   }
  // });

  // app.put("/api/cashback-settings/:id", async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     const validatedData = insertCashbackSettingSchema
  //       .partial()
  //       .parse(req.body);
  //     const setting = await storage.updateCashbackSetting(id, validatedData);
  //     if (!setting) {
  //       return res.status(404).json({ message: "Configuração não encontrada" });
  //     }
  //     res.json(setting);
  //   } catch (error) {
  //     if (error instanceof z.ZodError) {
  //       const validationError = fromZodError(error);
  //       return res.status(400).json({ message: validationError.toString() });
  //     }
  //     console.error("Erro ao atualizar configuração:", error);
  //     res.status(500).json({ message: "Erro ao atualizar configuração" });
  //   }
  // });

  // app.delete("/api/cashback-settings/:id", async (req, res) => {
  //   try {
  //     const { id } = req.params;
  //     const success = await storage.deleteCashbackSetting(id);
  //     if (!success) {
  //       return res.status(404).json({ message: "Configuração não encontrada" });
  //     }
  //     res.json({ message: "Configuração excluída com sucesso" });
  //   } catch (error) {
  //     console.error("Erro ao excluir configuração:", error);
  //     res.status(500).json({ message: "Erro ao excluir configuração" });
  //   }
  // });

  // ========================================================================
  // CASHBACK STATISTICS ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/statistics
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-statistics.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /statistics)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/statistics
  // app.get("/api/cashback-statistics", getCashbackStatisticsController);

  // ========================================================================
  // CASHBACK EXPIRING ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/expiring
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-expiring-cashbacks.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /expiring)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/expiring
  // app.get("/api/cashback-expiring", getExpiringCashbacks);

  // ========================================================================
  // CASHBACK BALANCES ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/balances
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-balances.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /balances)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/balances
  // app.get("/api/cashback-balances-list", getCashbackBalancesController);

  // ========================================================================
  // CASHBACK TRANSACTIONS ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/transactions
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-transactions.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /transactions)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/transactions
  // app.get("/api/cashback-transactions-list", getCashbackTransactionsController);

  // ========================================================================
  // CASHBACK USAGE ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/usage
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-usage.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /usage)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/usage
  // app.get("/api/cashback-usage-list", getCashbackUsageController);

  // ========================================================================
  // CASHBACK REPORTS ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/reports
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-reports.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /reports)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/reports
  // app.get("/api/cashback-reports", getCashbackReports);

  // ========================================================================
  // CASHBACK PERFORMANCE ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/performance
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts
  // - Service:    server/services/cashback-statistics.service.ts
  // - Controller: server/controllers/cashback/get-cashback-performance.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /performance)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/performance
  // app.get("/api/cashback-performance", getCashbackPerformance);

  // ========================================================================
  // CASHBACK TRANSACTIONS SIMPLE ROUTE - MIGRADO PARA SISTEMA MODULAR
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Rota disponível em /api/cashback-settings/transactions-simple
  //
  // Arquitetura modular:
  // - Repository: server/repositories/cashback-statistics.repository.ts (getCashbackTransactions)
  // - Service:    server/services/cashback-statistics.service.ts (getCashbackTransactions)
  // - Controller: server/controllers/cashback/get-cashback-transactions-simple.controller.ts
  // - Router:     server/routes/cashback-settings.routes.ts (GET /transactions-simple)
  // - Integration: server/routes/index.ts (apiRouter.use("/cashback-settings"))
  // ========================================================================

  // COMENTADO - Agora usa router modular em /api/cashback-settings/transactions-simple
  /*
  app.get("/api/cashback-transactions", async (req, res) => {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const transactions = await storage.getCashbackTransactions(
        userId,
        userRole
      );
      res.json(transactions);
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
      res.status(500).json({ message: "Erro ao buscar transações" });
    }
  });
  */

  /*
  ============================================================================
  MIGRATION: POST /api/cashback-transactions
  ============================================================================
  Migrated to modular Controller-Service-Repository architecture
  
  Architecture Components:
  - Repository: cashbackSettingsRepository.createCashbackTransaction() + updateClientCashbackBalance()
  - Service: cashbackSettingsService.createCashbackTransaction()
  - Controller: server/controllers/cashback/create-cashback-transaction.controller.ts
  - Router: server/routes/cashback-settings.routes.ts
  - Integration: POST /api/cashback-settings/transactions
  
  New route path: /api/cashback-settings/transactions
  Same logic maintained:
  - Validates request body using Zod schema (insertCashbackTransactionSchema)
  - Calculates expiresAt based on settingId configuration or 28 days default
  - Creates cashback transaction in database
  - Updates client cashback balance automatically
  - Returns created transaction with HTTP 201
  ============================================================================
  */
  /* app.post("/api/cashback-transactions", async (req, res) => {
    try {
      const data = req.body;

      // Adicionar data de validade automaticamente (28 dias)
      if (!data.expiresAt) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 28);
        data.expiresAt = expirationDate;
      }

      const validatedData = insertCashbackTransactionSchema.parse(data);
      const transaction = await storage.createCashbackTransaction(
        validatedData
      );
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar transação:", error);
      res.status(500).json({ message: "Erro ao criar transação" });
    }
  });
  */

  app.post("/api/calculate-cashback", async (req, res) => {
    try {
      const { purchaseAmount, netAmount } = req.body;

      // Use netAmount if provided, otherwise fall back to purchaseAmount
      const valueForCalculation = netAmount || purchaseAmount;

      if (!valueForCalculation || valueForCalculation <= 0) {
        return res.status(400).json({ message: "Valor de compra inválido" });
      }

      // Buscar configurações ativas de cashback
      const settings = await storage.getCashbackSettings();
      const activeSetting = settings.find((s) => s.isActive === "true");

      if (!activeSetting) {
        return res.json({
          cashbackAmount: 0,
          rate: 0,
          setting: null,
        });
      }

      const rate = parseFloat(activeSetting.percentageRate);
      const minPurchase = parseFloat(activeSetting.minimumPurchase || "0");
      const maxCashback = activeSetting.maximumCashback
        ? parseFloat(activeSetting.maximumCashback)
        : null;

      if (valueForCalculation < minPurchase) {
        return res.json({
          cashbackAmount: 0,
          rate: 0,
          setting: activeSetting,
        });
      }

      let cashbackAmount = (valueForCalculation * rate) / 100;

      if (maxCashback && cashbackAmount > maxCashback) {
        cashbackAmount = maxCashback;
      }

      res.json({
        cashbackAmount,
        rate,
        setting: activeSetting,
      });
    } catch (error) {
      console.error("Erro ao calcular cashback:", error);
      res.status(500).json({ message: "Erro ao calcular cashback" });
    }
  });

  app.get("/api/cashback-balances", async (req, res) => {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const balances = await storage.getAllCashbackBalances(userId, userRole);
      res.json(balances);
    } catch (error) {
      console.error("Erro ao buscar saldos:", error);
      res.status(500).json({ message: "Erro ao buscar saldos" });
    }
  });

  app.get("/api/cashback-balances/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const clientBalance = await storage.getClientCashbackBalance(clientId);

      if (clientBalance) {
        res.json(clientBalance);
      } else {
        // Se não existe registro, criar um com saldo zero
        await storage.updateClientCashbackBalance(clientId);
        const newBalance = await storage.getClientCashbackBalance(clientId);
        res.json(newBalance || { currentBalance: "0.00" });
      }
    } catch (error) {
      console.error("Erro ao buscar saldo de cashback:", error);
      res.status(500).json({ message: "Erro ao buscar saldo de cashback" });
    }
  });

  app.delete("/api/cashback-balances/:balanceId", async (req, res) => {
    try {
      // Verificar se o usuário é administrador
      const userEmail = req.headers["x-user-email"] as string;
      const userRole = req.headers["x-user-role"] as string;

      if (
        !userEmail ||
        !userRole ||
        (userRole !== "administrador" && userRole !== "admin")
      ) {
        return res.status(403).json({
          message:
            "Acesso negado. Apenas administradores podem excluir saldos de cashback.",
        });
      }

      const { balanceId } = req.params;
      const deleted = await storage.deleteCashbackBalance(balanceId);
      if (deleted) {
        res.json({ message: "Saldo de cashback excluído com sucesso" });
      } else {
        res.status(404).json({ message: "Saldo de cashback não encontrado" });
      }
    } catch (error) {
      console.error("Erro ao excluir saldo de cashback:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });

  app.get("/api/cashback-usage", async (req, res) => {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const usage = await storage.getAllCashbackUsage(userId, userRole);
      res.json(usage);
    } catch (error) {
      console.error("Erro ao buscar histórico de uso:", error);
      res.status(500).json({ message: "Erro ao buscar histórico" });
    }
  });

  app.post("/api/cashback-usage", async (req, res) => {
    try {
      const usageData = req.body;
      const usage = await storage.createCashbackUsage(usageData);
      res.status(201).json(usage);
    } catch (error) {
      console.error("Erro ao criar uso de cashback:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.get("/api/cashback-usage/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const usage = await storage.getClientCashbackUsage(clientId);
      res.json(usage);
    } catch (error) {
      console.error("Erro ao buscar uso de cashback:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Reports routes
  app.get("/api/reports/general", getGeneralReportsController);
  app.get("/api/reports/clients", getClientReportsController);
  app.get("/api/reports/companies", getCompanyReportsController);

  // Sales routes
  app.get("/api/sales-statistics", getSalesStatisticsController);
  app.get("/api/sales-history", getSalesHistoryController);

  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
      res.status(500).json({ message: "Erro ao buscar vendas" });
    }
  });

  // Relatórios de cashback dos últimos 30 dias
  app.get("/api/cashback-reports/30-days", async (req, res) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Buscar vendas dos últimos 30 dias
      const sales = await storage.getSales();
      const recentSales = sales.filter(
        (sale) => new Date(sale.date) >= thirtyDaysAgo
      );

      // Buscar transações de cashback dos últimos 30 dias
      const transactions = await storage.getCashbackTransactions();
      const recentTransactions = transactions.filter((item: any) => {
        const transaction = item.cashback_transactions || item;
        return (
          new Date(transaction.createdAt) >= thirtyDaysAgo &&
          transaction.status === "approved"
        );
      });

      // Buscar resgates dos últimos 30 dias
      const allUsage = await storage.getAllCashbackUsage();
      const recentUsage = allUsage.filter((item: any) => {
        const usage = item.cashback_usage || item;
        return new Date(usage.createdAt) >= thirtyDaysAgo;
      });

      // Calcular totais
      const totalSales = recentSales.reduce(
        (sum, sale) => sum + parseFloat(sale.grossValue),
        0
      );
      const totalCashbackGenerated = recentSales.reduce(
        (sum, sale) => sum + parseFloat(sale.cashbackGenerated),
        0
      );
      const totalCashbackUsed = recentSales.reduce(
        (sum, sale) => sum + parseFloat(sale.cashbackUsed),
        0
      );
      const totalCashbackRedeemed = recentUsage.reduce((sum, item) => {
        const usage = (item as any).cashback_usage || item;
        return sum + parseFloat(usage.usedAmount || 0);
      }, 0);

      res.json({
        totalSales,
        totalCashbackGenerated,
        totalCashbackUsed,
        totalCashbackRedeemed,
        salesCount: recentSales.length,
        period: "30 days",
      });
    } catch (error) {
      console.error("Erro ao buscar relatórios de cashback:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar relatórios de cashback" });
    }
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const {
        clientId,
        date,
        grossValue,
        notes,
        invoiceNumber,
        userId,
        useCashback = true,
      } = req.body;

      if (!clientId || !date || !grossValue) {
        return res
          .status(400)
          .json({ message: "Campos obrigatórios: clientId, date, grossValue" });
      }

      // Buscar saldo atual de cashback do cliente
      const clientBalance = await storage.getClientCashbackBalance(clientId);
      const currentBalance = clientBalance
        ? parseFloat(clientBalance.currentBalance)
        : 0;

      // Buscar configuração ativa de cashback
      const settings = await storage.getCashbackSettings();
      const activeSetting = settings.find((s: any) => s.isActive === "true");

      // Calcular valores da venda
      let cashbackUsed = 0;
      if (useCashback === true && currentBalance > 0) {
        const maxCashbackUsage = grossValue * 0.5; // Máximo 50% do valor bruto
        cashbackUsed = Math.min(currentBalance, maxCashbackUsage);
      }
      // Garantir que se useCashback for false, cashbackUsed seja 0
      if (useCashback === false) {
        cashbackUsed = 0;
      }
      const netValue = grossValue - cashbackUsed;

      // Calcular cashback usando a configuração ativa
      let cashbackGenerated = 0;
      if (activeSetting) {
        const minimumPurchase = parseFloat(
          activeSetting.minimumPurchase || "0"
        );
        if (netValue >= minimumPurchase) {
          const rate = parseFloat(activeSetting.percentageRate) / 100;
          cashbackGenerated = netValue * rate;

          // Aplicar limite máximo se definido
          if (activeSetting.maximumCashback) {
            const maxCashback = parseFloat(activeSetting.maximumCashback);
            cashbackGenerated = Math.min(cashbackGenerated, maxCashback);
          }
        }
      }

      // Registrar a venda
      const sale = await storage.createSale({
        clientId,
        date,
        grossValue,
        cashbackUsed,
        netValue,
        cashbackGenerated,
        notes,
        invoiceNumber,
        userId,
        useCashback,
      });

      // O saldo de cashback será atualizado automaticamente pelo createSale

      // Buscar o saldo atualizado do cliente após a venda
      const updatedClientBalance = await storage.getClientCashbackBalance(
        clientId
      );
      const updatedBalance = updatedClientBalance
        ? parseFloat(updatedClientBalance.currentBalance)
        : 0;

      res.status(201).json({
        ...sale,
        clientCurrentBalance: updatedBalance,
      });
    } catch (error) {
      console.error("Erro ao criar venda:", error);
      res.status(500).json({ message: "Erro ao criar venda" });
    }
  });

  app.delete("/api/sales/:id", async (req, res) => {
    try {
      // Verificar se o usuário é administrador
      const userRole = req.headers["x-user-role"] as string;

      if (userRole !== "admin" && userRole !== "administrador") {
        return res.status(403).json({
          message:
            "Acesso negado. Apenas administradores podem excluir vendas.",
        });
      }

      const { id } = req.params;
      const success = await storage.deleteSale(id);

      if (!success) {
        return res.status(404).json({ message: "Venda não encontrada" });
      }

      res.json({ message: "Venda excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
      res.status(500).json({ message: "Erro ao excluir venda" });
    }
  });

  // Sectors routes
  app.get("/api/sectors", async (req, res) => {
    try {
      const sectors = await storage.getSectors();
      res.json(sectors);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar setores" });
    }
  });

  app.post("/api/sectors", async (req, res) => {
    try {
      const validatedData = insertSectorSchema.parse(req.body);
      const sector = await storage.createSector(validatedData);
      res.status(201).json(sector);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar setor" });
    }
  });

  // Tags routes
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar tag" });
    }
  });

  // Categories routes
  app.post("/api/categories", async (req, res) => {
    try {
      const categoryData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "categoria",
      };

      const validatedData = insertTagSchema.parse(categoryData);
      const category = await storage.createTag(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const categoryData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "categoria",
      };

      const validatedData = insertTagSchema.parse(categoryData);
      const category = await storage.updateTag(id, validatedData);
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });

  // Origins routes
  app.post("/api/origins", async (req, res) => {
    try {
      const originData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "origem",
      };

      const validatedData = insertTagSchema.parse(originData);
      const origin = await storage.createTag(validatedData);
      res.status(201).json(origin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar origem" });
    }
  });

  app.put("/api/origins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const originData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "origem",
      };

      const validatedData = insertTagSchema.parse(originData);
      const origin = await storage.updateTag(id, validatedData);
      res.json(origin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar origem" });
    }
  });

  app.delete("/api/origins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir origem" });
    }
  });

  // Markers routes
  app.post("/api/markers", async (req, res) => {
    try {
      const markerData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "marcador",
      };

      const validatedData = insertTagSchema.parse(markerData);
      const marker = await storage.createTag(validatedData);
      res.status(201).json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar marcador" });
    }
  });

  app.put("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const markerData = {
        name: req.body.name,
        color: req.body.color || "#6B7280",
        type: "marcador",
      };

      const validatedData = insertTagSchema.parse(markerData);
      const marker = await storage.updateTag(id, validatedData);
      res.json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar marcador" });
    }
  });

  app.delete("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir marcador" });
    }
  });

  // User Goals routes
  app.get("/api/user-goals", async (req, res) => {
    try {
      const goals = await storage.getUserGoals();
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas:", error);
      res.status(500).json({ message: "Erro ao buscar metas" });
    }
  });

  app.get("/api/user-goals/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const goal = await storage.getUserGoalByUserId(userId);
      res.json(goal);
    } catch (error) {
      console.error("Erro ao buscar meta do usuário:", error);
      res.status(500).json({ message: "Erro ao buscar meta" });
    }
  });

  app.get("/api/user-goals-with-results/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const goals = await storage.getUserGoalsWithResults(
        Number(month),
        Number(year)
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas com resultados:", error);
      res.status(500).json({ message: "Erro ao buscar metas com resultados" });
    }
  });

  app.get("/api/user-registration-stats", async (req, res) => {
    try {
      const stats = await storage.getUserRegistrationStats();
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de cadastro:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de cadastro" });
    }
  });

  // Rotas de interações com clientes
  app.get("/api/clients/:clientId/interactions", async (req, res) => {
    try {
      const { clientId } = req.params;
      const interactions = await storage.getClientInteractions(clientId);
      res.json(interactions);
    } catch (error) {
      console.error("Erro ao buscar interações:", error);
      res.status(500).json({ message: "Erro ao buscar interações" });
    }
  });

  app.get("/api/clients/:clientId/funnels", async (req, res) => {
    try {
      const { clientId } = req.params;
      const funnels = await storage.getClientFunnels(clientId);
      res.json(funnels);
    } catch (error) {
      console.error("Erro ao buscar funis do cliente:", error);
      res.status(500).json({ message: "Erro ao buscar funis do cliente" });
    }
  });

  // Company interactions and funnels routes
  app.get("/api/companies/:companyId/interactions", async (req, res) => {
    try {
      const { companyId } = req.params;
      const interactions = await storage.getCompanyInteractions(companyId);
      res.json(interactions);
    } catch (error) {
      console.error("Erro ao buscar interações da empresa:", error);
      res.status(500).json({ message: "Erro ao buscar interações da empresa" });
    }
  });

  app.get("/api/companies/:companyId/funnels", async (req, res) => {
    try {
      const { companyId } = req.params;
      const funnels = await storage.getCompanyFunnels(companyId);
      res.json(funnels);
    } catch (error) {
      console.error("Erro ao buscar funis da empresa:", error);
      res.status(500).json({ message: "Erro ao buscar funis da empresa" });
    }
  });

  // Get answered questions for a specific deal of a company
  app.get(
    "/api/companies/:companyId/deals/:dealId/answered-questions",
    getDealAnsweredQuestionsController
  );

  // app.post("/api/interactions", async (req, res) => {
  //   try {
  //     const interaction = await storage.createClientInteraction(req.body);
  //     res.status(201).json(interaction);
  //   } catch (error) {
  //     console.error("Erro ao criar interação:", error);
  //     res.status(500).json({ message: "Erro ao criar interação" });
  //   }
  // });

  app.put("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const interaction = await storage.updateClientInteraction(id, req.body);
      res.json(interaction);
    } catch (error) {
      console.error("Erro ao atualizar interação:", error);
      res.status(500).json({ message: "Erro ao atualizar interação" });
    }
  });

  app.delete("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteClientInteraction(id);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir interação:", error);
      res.status(500).json({ message: "Erro ao excluir interação" });
    }
  });

  app.post("/api/user-goals", async (req, res) => {
    try {
      const validatedData = insertUserGoalSchema.parse(req.body);

      // Verificar se já existe uma meta para este usuário no mês/ano especificado
      const existingGoal = await storage.getUserGoalByUserIdMonthYear(
        validatedData.userId,
        validatedData.month,
        validatedData.year
      );

      if (existingGoal) {
        // Se já existe, atualizar a meta existente
        const updatedGoal = await storage.updateUserGoal(
          existingGoal.id,
          validatedData
        );
        return res.json(updatedGoal);
      }

      // Se não existe, criar uma nova meta
      const goal = await storage.createUserGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar meta:", error);
      res.status(500).json({ message: "Erro ao criar meta" });
    }
  });

  app.put("/api/user-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertUserGoalSchema.partial().parse(req.body);
      const goal = await storage.updateUserGoal(id, validatedData);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar meta:", error);
      res.status(500).json({ message: "Erro ao atualizar meta" });
    }
  });

  app.delete("/api/user-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteUserGoal(id);
      if (success === false) {
        return res.status(404).json({ message: "Meta não encontrada" });
      }
      res.json({ message: "Meta excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta:", error);
      res.status(500).json({ message: "Erro ao excluir meta" });
    }
  });

  // Weekly Results routes
  app.get("/api/weekly-results", async (req, res) => {
    try {
      const results = await storage.getAllWeeklyResults();
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar resultados semanais:", error);
      res.status(500).json({ message: "Erro ao buscar resultados semanais" });
    }
  });

  app.get("/api/weekly-results/:goalId", async (req, res) => {
    try {
      const { goalId } = req.params;
      const results = await storage.getWeeklyResultsByGoalId(goalId);
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar resultados semanais:", error);
      res.status(500).json({ message: "Erro ao buscar resultados semanais" });
    }
  });

  app.post("/api/weekly-results", async (req, res) => {
    try {
      const validatedData = insertWeeklyResultSchema.parse(req.body);

      // Verificar se já existe resultado para essa meta e semana
      const existingResult = await storage.getWeeklyResult(
        validatedData.goalId,
        validatedData.week
      );

      if (existingResult) {
        // Se existe, atualizar
        const updatedResult = await storage.updateWeeklyResult(
          existingResult.id,
          validatedData
        );
        return res.json(updatedResult);
      }

      // Se não existe, criar novo
      const result = await storage.createWeeklyResult(validatedData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao salvar resultado semanal:", error);
      res.status(500).json({ message: "Erro ao salvar resultado semanal" });
    }
  });

  app.put("/api/weekly-results/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertWeeklyResultSchema.partial().parse(req.body);
      const result = await storage.updateWeeklyResult(id, validatedData);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar resultado semanal:", error);
      res.status(500).json({ message: "Erro ao atualizar resultado semanal" });
    }
  });

  app.delete("/api/weekly-results/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteWeeklyResult(id);
      if (success === false) {
        return res
          .status(404)
          .json({ message: "Resultado semanal não encontrado" });
      }
      res.json({ message: "Resultado semanal excluído com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir resultado semanal:", error);
      res.status(500).json({ message: "Erro ao excluir resultado semanal" });
    }
  });

  // Telemarketing Goals routes
  app.get("/api/telemarketing-goals", async (req, res) => {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const goals = await storage.getTelemarketingGoals(userId, userRole);
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de telemarketing:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar metas de telemarketing" });
    }
  });

  app.get("/api/telemarketing-goals/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const goals = await storage.getTelemarketingGoalsByMonthYear(
        Number(month),
        Number(year),
        userId,
        userRole
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de telemarketing:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar metas de telemarketing" });
    }
  });

  app.post("/api/telemarketing-goals", async (req, res) => {
    try {
      const validatedData = insertTelemarketingGoalSchema.parse(req.body);
      const goal = await storage.createTelemarketingGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar meta de telemarketing:", error);
      res.status(500).json({ message: "Erro ao criar meta de telemarketing" });
    }
  });

  app.put("/api/telemarketing-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTelemarketingGoalSchema
        .partial()
        .parse(req.body);
      const goal = await storage.updateTelemarketingGoal(id, validatedData);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar meta de telemarketing:", error);
      res
        .status(500)
        .json({ message: "Erro ao atualizar meta de telemarketing" });
    }
  });

  app.delete("/api/telemarketing-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTelemarketingGoal(id);
      if (success === false) {
        return res
          .status(404)
          .json({ message: "Meta de telemarketing não encontrada" });
      }
      res.json({ message: "Meta de telemarketing excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de telemarketing:", error);
      res
        .status(500)
        .json({ message: "Erro ao excluir meta de telemarketing" });
    }
  });

  // Telemarketing statistics route
  app.get("/api/telemarketing-stats/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getTelemarketingStatsByPeriod(
        parseInt(month),
        parseInt(year)
      );
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de telemarketing:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de telemarketing" });
    }
  });

  // Client Registration Goals routes
  app.get("/api/client-registration-goals", async (req, res) => {
    try {
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const goals = await storage.getClientRegistrationGoals(userId, userRole);
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de cadastros:", error);
      res.status(500).json({ message: "Erro ao buscar metas de cadastros" });
    }
  });

  app.get("/api/client-registration-goals/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      const goals = await storage.getClientRegistrationGoalsByMonthYear(
        parseInt(month),
        parseInt(year),
        userId,
        userRole
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de cadastros:", error);
      res.status(500).json({ message: "Erro ao buscar metas de cadastros" });
    }
  });

  app.post("/api/client-registration-goals", async (req, res) => {
    try {
      const validatedData = insertClientRegistrationGoalSchema.parse(req.body);
      const goal = await storage.createClientRegistrationGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar meta de cadastros:", error);
      res.status(500).json({ message: "Erro ao criar meta de cadastros" });
    }
  });

  app.put("/api/client-registration-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertClientRegistrationGoalSchema
        .partial()
        .parse(req.body);
      const goal = await storage.updateClientRegistrationGoal(
        id,
        validatedData
      );
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar meta de cadastros:", error);
      res.status(500).json({ message: "Erro ao atualizar meta de cadastros" });
    }
  });

  app.delete("/api/client-registration-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteClientRegistrationGoal(id);
      if (success === false) {
        return res
          .status(404)
          .json({ message: "Meta de cadastros não encontrada" });
      }
      res.json({ message: "Meta de cadastros excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de cadastros:", error);
      res.status(500).json({ message: "Erro ao excluir meta de cadastros" });
    }
  });

  // Client Registration statistics route
  app.get("/api/client-registration-stats/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getClientRegistrationStatsByPeriod(
        parseInt(month),
        parseInt(year)
      );
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de cadastros:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de cadastros" });
    }
  });

  // Marker Goals routes
  app.get("/api/marker-goals", async (req, res) => {
    try {
      const { userId, userRole } = req.query;
      const goals = await storage.getMarkerGoals(
        userId as string,
        userRole as string
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de marcadores:", error);
      res.status(500).json({ message: "Erro ao buscar metas de marcadores" });
    }
  });

  app.get("/api/marker-goals/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const { userId, userRole } = req.query;
      const goals = await storage.getMarkerGoalsByMonthYear(
        parseInt(month),
        parseInt(year),
        userId as string,
        userRole as string
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de marcadores:", error);
      res.status(500).json({ message: "Erro ao buscar metas de marcadores" });
    }
  });

  app.post("/api/marker-goals", async (req, res) => {
    try {
      const validatedData = insertMarkerGoalSchema.parse(req.body);
      const goal = await storage.createMarkerGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar meta de marcadores:", error);
      res.status(500).json({ message: "Erro ao criar meta de marcadores" });
    }
  });

  app.put("/api/marker-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertMarkerGoalSchema.partial().parse(req.body);
      const goal = await storage.updateMarkerGoal(id, validatedData);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar meta de marcadores:", error);
      res.status(500).json({ message: "Erro ao atualizar meta de marcadores" });
    }
  });

  app.delete("/api/marker-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteMarkerGoal(id);
      if (success === false) {
        return res
          .status(404)
          .json({ message: "Meta de marcadores não encontrada" });
      }
      res.json({ message: "Meta de marcadores excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de marcadores:", error);
      res.status(500).json({ message: "Erro ao excluir meta de marcadores" });
    }
  });

  // Marker statistics route
  app.get("/api/marker-stats/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getMarkerStatsByPeriod(
        parseInt(month),
        parseInt(year)
      );
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de marcadores:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de marcadores" });
    }
  });

  // Interaction Goals routes
  app.get("/api/interaction-goals", async (req, res) => {
    try {
      const { userId, userRole } = req.query;
      const goals = await storage.getInteractionGoals(
        userId as string,
        userRole as string
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de interações:", error);
      res.status(500).json({ message: "Erro ao buscar metas de interações" });
    }
  });

  app.get("/api/interaction-goals/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const { userId, userRole } = req.query;
      const goals = await storage.getInteractionGoalsByMonthYear(
        parseInt(month),
        parseInt(year),
        userId as string,
        userRole as string
      );
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas de interações:", error);
      res.status(500).json({ message: "Erro ao buscar metas de interações" });
    }
  });

  app.post("/api/interaction-goals", async (req, res) => {
    try {
      const validatedData = insertInteractionGoalSchema.parse(req.body);
      const goal = await storage.createInteractionGoal(validatedData);
      res.status(201).json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar meta de interações:", error);
      res.status(500).json({ message: "Erro ao criar meta de interações" });
    }
  });

  app.put("/api/interaction-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertInteractionGoalSchema
        .partial()
        .parse(req.body);
      const goal = await storage.updateInteractionGoal(id, validatedData);
      res.json(goal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar meta de interações:", error);
      res.status(500).json({ message: "Erro ao atualizar meta de interações" });
    }
  });

  app.delete("/api/interaction-goals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteInteractionGoal(id);
      if (success === false) {
        return res
          .status(404)
          .json({ message: "Meta de interações não encontrada" });
      }
      res.json({ message: "Meta de interações excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir meta de interações:", error);
      res.status(500).json({ message: "Erro ao excluir meta de interações" });
    }
  });

  // Interaction statistics route
  app.get("/api/interaction-stats/:month/:year", async (req, res) => {
    try {
      const { month, year } = req.params;
      const stats = await storage.getInteractionStatsByPeriod(
        parseInt(month),
        parseInt(year)
      );
      res.json(stats);
    } catch (error) {
      console.error("Erro ao buscar estatísticas de interações:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de interações" });
    }
  });

  // Client import route
  app.post("/api/clients/import", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não fornecido" });
      }

      const results = {
        success: 0,
        errors: [] as any[],
      };

      res.json(results);
    } catch (error) {
      console.error("Erro na importação:", error);
      res.status(500).json({ message: "Erro ao importar clientes" });
    }
  });

  // Object Storage routes for public file serving
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object Storage routes for file upload
  app.post("/api/objects/upload", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Object Storage route for serving uploaded objects
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Route for setting image metadata after upload
  app.put("/api/training-images", async (req, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(
        req.body.imageURL
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error) {
      console.error("Error setting training image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // trainings

  app.post("/api/trainings/video", async (req, res) => {
    try {
      const validatedData = createTrainingSchema.parse(req.body);
      const training = await storage.createTraining(validatedData);

      await storage.createTrainingAttachments({
        trainingId: training.id,
        fileType: "video",
        name: training.title,
        url: validatedData.videoUrl,
      });
      res.status(201).json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar treinamento:", error);
      res.status(500).json({ message: "Erro ao criar treinamento" });
    }
  });

  app.put("/api/trainings/video/:trainingId", async (req, res) => {
    try {
      const trainingId = req.params.trainingId;
      const validatedData = createTrainingSchema.parse(req.body);

      const training = await storage.getTraining(trainingId);

      const trainingUpdated = await storage.updateTraining(
        validatedData,
        trainingId
      );

      await storage.updateTrainingAttachments(
        {
          trainingId: trainingUpdated.id,
          fileType: "video",
          name: trainingUpdated.title,
          url: validatedData.videoUrl,
        },
        training.training_attachments?.url!
      );

      res.status(201).json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar treinamento:", error);
      res.status(500).json({ message: "Erro ao criar treinamento" });
    }
  });

  app.get("/api/trainings", async (req, res) => {
    try {
      const type = req.query.type as string;
      const trainingsList = await storage.getTrainings(type);

      res.json(trainingsList);
    } catch (error) {
      console.error("Erro ao Treinamentos: ", error);
      res.status(500).json({ message: "Erro ao buscar treinamentos" });
    }
  });

  app.delete("/api/trainings/:id", async (req, res) => {
    try {
      const trainingId = req.params.id;

      await storage.deleteTrainingAttachments(trainingId),
        await storage.deleteTraining(trainingId),
        res.json({ message: "Treinamento deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar Treinamento: ", error);
      res.status(500).json({ message: "Erro ao deletar treinamento" });
    }
  });

  app.post("/api/trainings/documents", async (req, res) => {
    try {
      const data = createDocumentTrainingSchema.parse(req.body);
      const [training] = await db
        .insert(trainings)
        .values({
          category: data.category,
          title: data.title,
          description: data.description,
          type: "document",
        })
        .returning();

      await db.insert(trainingAttachments).values({
        name: data.documentUrl,
        url: data.documentUrl,
        fileType: data.documentType,
        trainingId: training.id,
      });

      res.status(201).json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar treinamento:", error);

      res.status(500).json({ message: "Erro ao criar treinamento" });
    }
  });

  app.put("/api/trainings/documents/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const data = updateDocumentTrainingSchema.parse(req.body);

      const [training] = await db
        .update(trainings)
        .set({ ...data })
        .where(eq(trainings.id, id))
        .returning();

      res.json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar treinamento (documento):", error);

      res
        .status(500)
        .json({ message: "Erro ao atualizar treinamento (documento)" });
    }
  });

  app.put(
    "/api/trainings/documents/:id/file",
    upload.single("file"),
    async (req, res) => {
      try {
        const id = req.params.id;

        const training = await storage.getTraining(id);

        if (!req.file) {
          res.status(400).json({ message: "Arquivo não fornecido" });
        }

        await s3.send(
          new DeleteObjectCommand({
            Bucket: "crm-test",
            Key: training.training_attachments?.url!,
          })
        );

        const url = randomUUID() + "-" + req.file?.originalname;

        const upload = await s3.send(
          new PutObjectCommand({
            Bucket: "crm-test",
            Body: req.file?.buffer,
            Key: url,
            ContentType: req.file?.mimetype,
          })
        );

        const [trainingsAttachmentsUpdated] = await db
          .update(trainingAttachments)
          .set({ url })
          .where(eq(trainingAttachments.trainingId, id))
          .returning();

        res.json({ url, fileType: req.file?.mimetype });
      } catch (error) {
        if (error instanceof MulterError) {
          res.status(400).json({
            message: "O arquivo enviado é maior que o tamanho permitido",
          });
        }
        console.error("Erro ao atualizar arquivo:", error);
        res.status(500).json({ message: "Erro ao atualizar arquivo" });
      }
    }
  );

  app.delete("/api/trainings/documents/:id", async (req, res) => {
    try {
      const id = req.params.id;
      const training = await storage.getTraining(id);

      await s3.send(
        new DeleteObjectCommand({
          Bucket: "crm-test",
          Key: training.training_attachments?.url!,
        })
      );

      await storage.deleteTrainingAttachments(id);
      await storage.deleteTraining(id);

      res.json({ message: "Treinamento deletado com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir treinamento:", error);
      res.status(500).json({ message: "Erro ao excluir treinamento" });
    }
  });

  app.post("/api/trainings/scripts", async (req, res) => {
    try {
      const data = createScriptSchema.parse(req.body);
      const [training] = await db
        .insert(trainings)
        .values({
          title: data.title,
          description: data.description,
          content: data.content,
          category: data.category,
          type: "script",
        })
        .returning();

      res.status(201).json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar treinamento:", error);

      res.status(500).json({ message: "Erro ao criar treinamento" });
    }
  });

  app.put("/api/trainings/scripts/:id", async (req, res) => {
    try {
      const data = createScriptSchema.parse(req.body);
      const [training] = await db
        .update(trainings)
        .set({ ...data })
        .where(eq(trainings.id, req.params.id))
        .returning();

      res.status(201).json(training);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar treinamento:", error);

      res.status(500).json({ message: "Erro ao atualizar treinamento" });
    }
  });

  app.put("/api/trainings/:id/order", async (req, res) => {
    try {
      const { id } = req.params;
      const { direction, type } = req.body;

      if (!direction || !type) {
        return res.status(400).json({
          message: "direction ('up' ou 'down') e type são obrigatórios",
        });
      }

      if (direction !== "up" && direction !== "down") {
        return res.status(400).json({
          message: "direction deve ser 'up' ou 'down'",
        });
      }

      const training = await storage.reorderTrainings(id, direction, type);
      if (!training) {
        return res.status(404).json({ message: "Treinamento não encontrado" });
      }

      res.json(training);
    } catch (error) {
      console.error("Erro ao atualizar ordem do treinamento:", error);
      res
        .status(500)
        .json({ message: "Erro ao atualizar ordem do treinamento" });
    }
  });

  // Upload
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ message: "Arquivo não fornecido" });
      }

      const url = randomUUID() + "-" + req.file?.originalname;

      const upload = await s3.send(
        new PutObjectCommand({
          Bucket: "crm-test",
          Body: req.file?.buffer,
          Key: url,
          ContentType: req.file?.mimetype,
        })
      );

      res.json({ url, fileType: req.file?.mimetype });
    } catch (error) {
      if (error instanceof MulterError) {
        res.status(400).json({
          message: "O arquivo enviado é maior que o tamanho permitido",
        });
      }
      console.error("Erro ao fazer upload:", error);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  // Delete file from S3
  app.delete("/api/delete-file", async (req, res) => {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res
          .status(400)
          .json({ message: "URL do arquivo é obrigatória" });
      }

      // Remover arquivo do S3
      await s3.send(
        new DeleteObjectCommand({
          Bucket: "crm-test",
          Key: fileUrl,
        })
      );

      res.json({ message: "Arquivo removido com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
      res.status(500).json({ message: "Erro ao deletar arquivo" });
    }
  });

  // Client Debts Routes
  app.get("/api/client-debts", async (req, res) => {
    try {
      const { responsibleId } = req.query;
      const debts = await storage.getClientDebts(responsibleId as string);
      res.json(debts);
    } catch (error) {
      console.error("Error fetching client debts:", error);
      res.status(500).json({ error: "Failed to fetch client debts" });
    }
  });

  app.post("/api/client-debts", async (req, res) => {
    try {
      // Get user ID from headers or fallback to first user
      const userIdFromHeader = req.headers["x-user-id"] as string;
      let createdById = userIdFromHeader;

      if (!createdById) {
        const users = await storage.getUsers();
        createdById = users.length > 0 ? users[0].id : null;
      }

      if (!createdById) {
        return res.status(400).json({ error: "No users found in system" });
      }

      const debt = await storage.createClientDebt({
        id: nanoid(),
        clientId: req.body.clientId,
        amount: req.body.amount,
        description: req.body.description,
        dueDate: new Date(req.body.dueDate),
        status: req.body.status || "pending",
        createdAt: new Date(),
        createdBy: createdById,
      });
      res.json(debt);
    } catch (error) {
      console.error("Error creating client debt:", error);
      res.status(500).json({ error: "Failed to create client debt" });
    }
  });

  app.put("/api/client-debts/:id", async (req, res) => {
    try {
      const debt = await storage.updateClientDebt(req.params.id, req.body);
      res.json(debt);
    } catch (error) {
      console.error("Error updating client debt:", error);
      res.status(500).json({ error: "Failed to update client debt" });
    }
  });

  app.delete("/api/client-debts/:id", async (req, res) => {
    try {
      await storage.deleteClientDebt(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting client debt:", error);
      res.status(500).json({ error: "Failed to delete client debt" });
    }
  });

  // Dashboard Stats Route
  app.get("/api/dashboard/stats/:userId", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats(req.params.userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Products routes
  app.get("/api/products", async (req, res) => {
    try {
      const { name, type, country, volume } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      const filters = {
        name: name as string | undefined,
        type: type as string | undefined,
        country: country as string | undefined,
        volume: volume as string | undefined,
      };

      const { data, total } = await storage.getProducts(
        filters,
        page,
        pageSize
      );

      res.json({
        data,
        currentPage: page,
        totalPages: Math.ceil(total / pageSize),
        totalItems: total,
      });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Erro ao buscar produtos" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const productData = {
        ...req.body,
        createdBy: userId,
      };

      const validatedData = insertProductSchema.parse(productData);
      const product = await storage.createProduct(validatedData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Error creating product:", error);
      res.status(500).json({ message: "Erro ao criar produto" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validatedData);
      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Error updating product:", error);
      res.status(500).json({ message: "Erro ao atualizar produto" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteProduct(id);
      if (!success) {
        return res.status(404).json({ message: "Produto não encontrado" });
      }
      res.json({ message: "Produto excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Erro ao excluir produto" });
    }
  });

  // Company Products routes (carta de vinhos)
  app.get("/api/companies/:companyId/products", async (req, res) => {
    try {
      const { companyId } = req.params;
      const products = await storage.getCompanyProducts(companyId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching company products:", error);
      res.status(500).json({ message: "Erro ao buscar carta de vinhos" });
    }
  });

  app.get("/api/companies/:companyId/available-products", async (req, res) => {
    try {
      const { companyId } = req.params;
      const products = await storage.getAvailableProductsForCompany(companyId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching available products:", error);
      res.status(500).json({ message: "Erro ao buscar produtos disponíveis" });
    }
  });

  app.post("/api/companies/:companyId/products", async (req, res) => {
    try {
      const { companyId } = req.params;
      const { productId } = req.body;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const companyProduct = await storage.addProductToCompany({
        companyId,
        productId,
        addedBy: userId,
        isActive: "true",
      });

      res.status(201).json(companyProduct);
    } catch (error) {
      console.error("Error adding product to company:", error);
      if (
        error instanceof Error &&
        error.message === "Produto já vinculado a esta empresa"
      ) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Erro ao adicionar produto à carta" });
    }
  });

  // Remove product from company wine list
  app.delete(
    "/api/companies/:companyId/products/:productId",
    async (req, res) => {
      const { companyId, productId } = req.params;

      try {
        await storage.removeProductFromCompany(companyId, productId);
        res.json({ message: "Product removed from company wine list" });
      } catch (error) {
        console.error("Error removing product from company:", error);
        res
          .status(500)
          .json({ error: "Failed to remove product from company" });
      }
    }
  );

  // Update custom negotiated price for company product
  app.put(
    "/api/companies/:companyId/products/:productId/price",
    async (req, res) => {
      try {
        const { companyId, productId } = req.params;
        const { customPrice } = req.body;

        console.log("Atualizando preço:", {
          companyId,
          productId,
          customPrice,
        });

        if (!companyId || !productId) {
          return res
            .status(400)
            .json({ message: "CompanyId e ProductId são obrigatórios" });
        }

        if (
          !customPrice ||
          customPrice === "" ||
          isNaN(parseFloat(customPrice))
        ) {
          return res.status(400).json({ message: "Preço inválido" });
        }

        const numericPrice = parseFloat(customPrice);
        if (numericPrice < 0) {
          return res
            .status(400)
            .json({ message: "Preço não pode ser negativo" });
        }

        const result = await storage.updateCompanyProductPrice(
          companyId,
          productId,
          numericPrice.toString()
        );

        if (!result) {
          return res
            .status(404)
            .json({ message: "Produto não encontrado na carta da empresa" });
        }

        console.log("Preço atualizado com sucesso:", result);
        res.json({ message: "Preço atualizado com sucesso", data: result });
      } catch (error) {
        console.error("Erro ao atualizar preço customizado:", error);
        res.status(500).json({ message: "Erro interno do servidor" });
      }
    }
  );

  // Get companies that have a specific product
  app.get("/api/products/:productId/companies", async (req, res) => {
    try {
      const { productId } = req.params;
      console.log(`API: Fetching companies for product ${productId}`);
      const companiesWithProduct = await storage.getCompaniesWithProduct(
        productId
      );
      console.log(
        `API: Found ${companiesWithProduct.length} companies for product ${productId}`
      );
      res.json(companiesWithProduct);
    } catch (error) {
      console.error("Error fetching companies with product:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar empresas com o produto" });
    }
  });

  // Get products statistics
  app.get("/api/products/statistics", async (req, res) => {
    try {
      console.log("Fetching products statistics...");
      const statistics = await storage.getProductsStatistics();
      console.log("Statistics fetched:", {
        topCompaniesByProductsCount:
          statistics.topCompaniesByProducts?.length || 0,
        topProductsByCompaniesCount:
          statistics.topProductsByCompanies?.length || 0,
      });
      res.json(statistics);
    } catch (error) {
      console.error("Error fetching products statistics:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar estatísticas de produtos" });
    }
  });

  // Events routes
  app.get("/api/events", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;

      const events = await storage.getEvents(userId, userRole);
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Erro ao buscar eventos" });
    }
  });

  // Upload de imagem para evento
  app.post(
    "/api/events/upload-image",
    upload.single("image"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res
            .status(400)
            .json({ message: "Nenhuma imagem foi enviada" });
        }

        // Validar tipo de arquivo (JPEG, JPG, PNG)
        const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png"];
        if (!allowedMimeTypes.includes(req.file.mimetype)) {
          return res.status(400).json({
            message: "Formato de arquivo inválido. Use JPEG, JPG ou PNG",
          });
        }

        // Validar tamanho (15MB máximo)
        if (req.file.size > 15 * 1024 * 1024) {
          return res.status(400).json({
            message: "Arquivo muito grande. O tamanho máximo é 15MB",
          });
        }

        const fileExtension = req.file.originalname.split(".").pop();
        const fileName = `event-${nanoid()}.${fileExtension}`;

        // Upload para S3
        await s3.send(
          new PutObjectCommand({
            Bucket: "crm-test",
            Body: req.file.buffer,
            Key: fileName,
            ContentType: req.file.mimetype,
          })
        );

        res.json({ imageUrl: fileName });
      } catch (error) {
        console.error("Erro ao fazer upload da imagem:", error);
        res.status(500).json({ message: "Erro ao fazer upload da imagem" });
      }
    }
  );

  app.post("/api/events", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      console.log(
        "Dados recebidos para criar evento:",
        JSON.stringify(req.body, null, 2)
      );

      const eventData = {
        ...req.body,
        createdBy: userId,
      };

      // Validar dados antes de enviar para o schema
      if (!eventData.name || !eventData.name.trim()) {
        return res
          .status(400)
          .json({ message: "Nome do evento é obrigatório" });
      }

      if (!eventData.eventDate) {
        return res
          .status(400)
          .json({ message: "Data do evento é obrigatória" });
      }

      if (!eventData.location || !eventData.location.trim()) {
        return res
          .status(400)
          .json({ message: "Local do evento é obrigatório" });
      }

      if (
        !eventData.pricePerPerson ||
        isNaN(parseFloat(eventData.pricePerPerson))
      ) {
        return res
          .status(400)
          .json({ message: "Valor por pessoa deve ser um número válido" });
      }

      // Converter strings de data para objetos Date preservando timezone brasileiro
      if (typeof eventData.eventDate === "string") {
        // Para datetime-local, tratar como horário de São Paulo
        // O datetime-local vem no formato YYYY-MM-DDTHH:mm
        eventData.eventDate = new Date(eventData.eventDate + ":00-03:00"); // Forçar timezone brasileiro
      }
      if (
        eventData.registrationDeadline &&
        typeof eventData.registrationDeadline === "string"
      ) {
        eventData.registrationDeadline = new Date(
          eventData.registrationDeadline + ":00-03:00"
        ); // Forçar timezone brasileiro
      }

      // Separar dados do evento e anexos
      const { attachments, ...eventDataOnly } = eventData;

      const validatedData = insertEventSchema.parse(eventDataOnly);
      console.log("Dados validados:", validatedData);

      const event = await storage.createEvent(validatedData);
      console.log("Evento criado com sucesso:", event.id);

      // Se há imagens/anexos, salvá-los
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const attachment of attachments) {
          if (attachment.fileUrl && attachment.fileName) {
            await storage.addEventAttachment({
              eventId: event.id,
              fileName: attachment.fileName,
              fileUrl: attachment.fileUrl,
            });
          }
        }
      }

      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Erro de validação Zod:", error.errors);
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar evento:", error);
      res.status(500).json({
        message: "Erro ao criar evento",
        error: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Converter strings de data para objetos Date preservando timezone brasileiro
      const eventData = { ...req.body };
      if (eventData.eventDate && typeof eventData.eventDate === "string") {
        // Para datetime-local, tratar como horário de São Paulo
        eventData.eventDate = new Date(eventData.eventDate + ":00-03:00"); // Forçar timezone brasileiro
      }
      if (
        eventData.registrationDeadline &&
        typeof eventData.registrationDeadline === "string"
      ) {
        eventData.registrationDeadline = new Date(
          eventData.registrationDeadline + ":00-03:00"
        ); // Forçar timezone brasileiro
      }

      // Separar dados do evento e anexos
      const { attachments, ...eventDataOnly } = eventData;

      const validatedData = insertEventSchema.partial().parse(eventDataOnly);
      const event = await storage.updateEvent(id, validatedData);

      // Se há informações de anexos, gerenciar as imagens
      if (attachments !== undefined) {
        // Remove todos os anexos existentes
        await storage.deleteEventAttachmentsByEventId(id);

        // Adiciona os novos anexos se houver
        if (Array.isArray(attachments) && attachments.length > 0) {
          for (const attachment of attachments) {
            if (attachment.fileUrl && attachment.fileName) {
              await storage.addEventAttachment({
                eventId: id,
                fileName: attachment.fileName,
                fileUrl: attachment.fileUrl,
              });
            }
          }
        }
      }

      res.json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Erro ao atualizar evento" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteEvent(id);
      if (!success) {
        return res.status(404).json({ message: "Evento não encontrado" });
      }
      res.json({ message: "Evento excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting event:", error);
      res.status(500).json({ message: "Erro ao excluir evento" });
    }
  });

  app.get("/api/events/:id/participants", async (req, res) => {
    try {
      const { id } = req.params;
      const participants = await storage.getEventParticipants(id);
      res.json(participants);
    } catch (error) {
      console.error("Error fetching event participants:", error);
      res
        .status(500)
        .json({ message: "Erro ao buscar participantes do evento" });
    }
  });

  app.post("/api/events/:id/participants", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }

      const participantData = {
        ...req.body,
        eventId: id,
        registeredBy: userId,
      };

      const validatedData = insertEventParticipantSchema.parse(participantData);
      const participant = await storage.addEventParticipant(validatedData);
      res.status(201).json(participant);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Error adding event participant:", error);
      res.status(500).json({ message: "Erro ao adicionar participante" });
    }
  });

  app.put(
    "/api/events/:eventId/participants/:participantId",
    async (req, res) => {
      try {
        const { participantId } = req.params;
        const validatedData = insertEventParticipantSchema
          .partial()
          .parse(req.body);
        const participant = await storage.updateEventParticipant(
          participantId,
          validatedData
        );
        res.json(participant);
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = fromZodError(error);
          return res.status(400).json({ message: validationError.toString() });
        }
        console.error("Error updating event participant:", error);
        res.status(500).json({ message: "Erro ao atualizar participante" });
      }
    }
  );

  app.delete(
    "/api/events/:eventId/participants/:participantId",
    async (req, res) => {
      try {
        const { participantId } = req.params;
        const success = await storage.removeEventParticipant(participantId);
        if (!success) {
          return res
            .status(404)
            .json({ message: "Participante não encontrado" });
        }
        res.json({ message: "Participante removido com sucesso" });
      } catch (error) {
        console.error("Error removing event participant:", error);
        res.status(500).json({ message: "Erro ao remover participante" });
      }
    }
  );

  // Event attachments routes
  app.get("/api/events/:id/attachments", async (req, res) => {
    try {
      const { id } = req.params;
      const attachments = await storage.getEventAttachments(id);
      res.json(attachments);
    } catch (error) {
      console.error("Error fetching event attachments:", error);
      res.status(500).json({ message: "Erro ao buscar anexos do evento" });
    }
  });

  app.post("/api/events/:id/attachments", async (req, res) => {
    try {
      const { id } = req.params;
      const { fileName, fileUrl } = req.body;

      if (!fileName || !fileUrl) {
        return res.status(400).json({
          message: "Nome do arquivo e URL são obrigatórios",
        });
      }

      const attachment = await storage.addEventAttachment({
        eventId: id,
        fileName,
        fileUrl,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Error adding event attachment:", error);
      res.status(500).json({ message: "Erro ao adicionar anexo do evento" });
    }
  });

  app.delete(
    "/api/events/:eventId/attachments/:attachmentId",
    async (req, res) => {
      try {
        const { attachmentId } = req.params;
        const success = await storage.deleteEventAttachment(attachmentId);

        if (!success) {
          return res.status(404).json({ message: "Anexo não encontrado" });
        }

        res.json({ message: "Anexo removido com sucesso" });
      } catch (error) {
        console.error("Error deleting event attachment:", error);
        res.status(500).json({ message: "Erro ao remover anexo do evento" });
      }
    }
  );

  // ========================================================================
  // CASHBACK SETTINGS V2 ROUTES - REMOVIDO (Agora em sistema modular)
  // ========================================================================
  // ✅ MIGRADO para server/routes/cashback-settings.routes.ts
  // Todas as rotas v2 foram consolidadas no router modular /api/cashback-settings
  // ========================================================================

  // REMOVIDO - Agora usa router modular via apiRouter
  // app.post("/api/v2/cashback-settings", createCashbackSettingsController);
  // app.delete("/api/v2/cashback-settings/:id", deleteCashbackSettingsController);
  // app.get("/api/v2/cashback-settings", getCashbackSettingsController);
  // app.put("/api/v2/cashback-settings/:id", updateCashbackSettingsController);

  app.post(
    "/api/message-automation-settings",
    createMessageAutomationSettingsController
  );
  app.get(
    "/api/message-automation-settings",
    getMessageAutomationSettingsController
  );
  app.put(
    "/api/message-automation-settings/:id",
    updateMessageAutomationSettingsController
  );
  app.delete(
    "/api/message-automation-settings/:id",
    deleteMessageAutomationSettingsController
  );

  // Rotas para Message Jobs Logs
  app.post("/api/message-jobs-logs", createMessageJobsLogController);
  app.get("/api/message-jobs-logs", getMessageJobsLogsController);
  app.put("/api/message-jobs-logs/:id", updateMessageJobsLogController);
  app.delete("/api/message-jobs-logs/:id", deleteMessageJobsLogController);

  // Rota para buscar templates do Umbler
  app.get("/api/templates", getTemplatesController);

  // Rota para disparar automação de aniversário manualmente (para testes)
  app.post("/api/birthday-automation/trigger", async (req, res) => {
    try {
      console.log(
        "[Manual Trigger] Disparando automação de aniversário manualmente..."
      );

      const { sendBirthdayMessages } = await import(
        "./jobs/send-birthday-mensage"
      );

      // Disparar o job principal (todas as automações ativas)
      await sendBirthdayMessages();

      res.json({
        success: true,
        message: "Automação de aniversário executada com sucesso",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("[Manual Trigger] Erro ao executar automação:", error);
      res.status(500).json({
        success: false,
        message: "Erro ao executar automação de aniversário",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Rota para disparar automação de aniversário agendada manualmente (para testes)
  app.post("/api/birthday-automation/trigger-scheduled", async (req, res) => {
    try {
      console.log(
        "[Manual Trigger Scheduled] Disparando automação de aniversário agendada manualmente..."
      );

      const { sendBirthdayMessagesScheduled } = await import(
        "./jobs/send-birthday-mensage"
      );

      // Disparar o job agendado (apenas automações no horário correto)
      await sendBirthdayMessagesScheduled();

      res.json({
        success: true,
        message: "Automação de aniversário agendada executada com sucesso",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "[Manual Trigger Scheduled] Erro ao executar automação agendada:",
        error
      );
      res.status(500).json({
        success: false,
        message: "Erro ao executar automação de aniversário agendada",
        error: error instanceof Error ? error.message : "Erro desconhecido",
        timestamp: new Date().toISOString(),
      });
    }
  });

  app.get("/api/health", async (req, res) => {
    res.json({ status: "ok" });
  });

  // Seed default deal questions (development only)
  app.post("/api/admin/seed-deal-questions", async (req, res) => {
    try {
      const { createdBy } = req.body;

      if (!createdBy) {
        return res.status(400).json({ message: "createdBy é obrigatório" });
      }

      // const { seedDefaultDealQuestions } = await import(
      //   "./db/seeds/default-deal-questions"
      // );
      // await seedDefaultDealQuestions(createdBy);

      res.json({ message: "Perguntas padrão inseridas com sucesso!" });
    } catch (error) {
      console.error("Erro ao inserir perguntas padrão:", error);
      res.status(500).json({ message: "Erro ao inserir perguntas padrão" });
    }
  });

  // Middleware de tratamento de erros deve ser o último
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
