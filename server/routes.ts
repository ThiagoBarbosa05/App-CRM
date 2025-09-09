import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertClientSchema,
  insertCompanySchema,
  insertDealSchema,
  updateDealSchema,
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
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { db } from "./db";
import { and, asc, eq, like, lte, or, sql, count, gt } from "drizzle-orm";
import {
  createChat,
  createContactSchema,
  getBirthdayBots,
  getChannels,
  getChat,
  getChatById,
  getContactByPhone,
  sendMessage,
  startBirthdayBot,
  syncContact,
} from "./integrations/umbler";

// Configure multer for file uploads
const upload = multer({
  // limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Initialize Replit Object Storage client
let objectStorageClient: Client | null = null;
try {
  // Skip Object Storage in development to avoid bucket configuration issues
  if (process.env.NODE_ENV === "production") {
    objectStorageClient = new Client();
    console.log("Object Storage initialized successfully");
  } else {
    console.log("Object Storage disabled in development mode");
  }
} catch (error) {
  console.warn("Object Storage not available:", error);
  objectStorageClient = null;
}

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.get("/api/umbler/chats", async (req, res) => {
    try {
      const { customerPhone, userId } = req.query as {
        customerPhone: string;
        userId: string;
      };

       const [user] = await db.select({
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

      if(!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
      }

      const chats = await getChat({ customerPhone, selectedChannel: user.channelId! });

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
      const {userId} = req.query as {
        userId: string
      }

       const [user] = await db.select({
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

      if(!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
      }

      const validatedData = createContactSchema.parse(req.body);
      const contact = await syncContact(validatedData);

      if (!contact) {
        const result = contact;
        return res
          .status(400)
          .json({ message: "Erro ao sincronizar contato" + result });
      }

      const newChat = await createChat({ channelId: user.channelId!, contactId: contact.contact.id });


      res.status(201).json({ message: "Contato sincronizado com sucesso", newChat });
    } catch (error) {
      console.error("Erro ao sincronizar contato:", error);
      res.status(500).json({ message: "Erro ao sincronizar contato" });
    }
  });

  app.get("/api/umbler/chats/:id", async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const chat = await getChatById(id);

      if(!chat) {
        res.status(404).json({ message: "Chat não encontrado" });
      }

      res.json(chat);

    }
    catch (error)  {
      console.error("Erro ao buscar chat:", error);
      res.status(500).json({ message: "Erro ao buscar chat" });
    }
  })

  app.post("/api/umbler/chats", async (req, res) => {
    try {

      const { userId, contactId } = req.body as {
        contactId: string;
        userId: string;
      };

      const [user] = await db.select({
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

      if(!user) {
        res.status(404).json({ message: "Usuário não encontrado" });
        return;
      }

      const newChat = await createChat({ channelId: user.channelId!, contactId });

      res.status(201).json({message: "Chat criado com sucesso", newChat});
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

  // Rota para a página de Acompanhamento
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
        baseConditions.push(
          or(
            like(clients.name, lowercasedQuery),
            like(clients.phone, lowercasedQuery),
            like(clients.cpf, lowercasedQuery)
          )
        );
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
      let totalClientsInSystemQuery = db
        .select({ count: count() })
        .from(clients);
      if (userRole !== "admin" && userRole !== "administrador") {
        totalClientsInSystemQuery = totalClientsInSystemQuery.where(
          eq(clients.responsavelId, userId)
        );
      }
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

  app.get("/api/clients", async (req, res) => {
    try {
      // Pegar informações do usuário logado da query string ou headers
      const userId =
        (req.query.userId as string) || (req.headers["x-user-id"] as string);
      const userRole =
        (req.query.userRole as string) ||
        (req.headers["x-user-role"] as string);

      // Extrair paginação da query string
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 100;

      // Extrair filtros da query string
      const filters = {
        search: req.query.search as string | undefined,
        name: req.query.name as string | undefined,
        phone: req.query.phone as string | undefined,
        cpf: req.query.cpf as string | undefined,
        responsavelId: req.query.responsavelId as string | undefined,
        categoria: req.query.categoria as string | undefined,
        origem: req.query.origem as string | undefined,
        markers: req.query.markers as string | undefined,
      };

      const clients = await storage.getClients(
        userId,
        userRole,
        filters,
        page,
        pageSize
      );

      // Por enquanto, retorna formato simples com estimativa baseada no tamanho da página
      res.json({
        data: clients,
        currentPage: page,
        hasNextPage: clients.length === pageSize,
        totalPages: clients.length === pageSize ? page + 1 : page,
        totalItems: null, // Será implementado depois
      });
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  });

  // Rota para buscar cliente por telefone
  app.get("/api/clients/by-phone/:phone", async (req, res) => {
    try {
      const { phone } = req.params;
      const client = await storage.getClientByPhone(phone);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      res.json(client);
    } catch (error) {
      console.error("Erro ao buscar cliente por telefone:", error);
      res.status(500).json({ message: "Erro ao buscar cliente por telefone" });
    }
  });

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

  // Rota para buscar clientes sem contato recente
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

  // Rota específica para exportação - retorna TODOS os clientes do sistema
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

  // Bulk delete clients (admin only)
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

  // Company routes
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

  // Funnel route
  app.get("/api/funnels", async (req, res) => {
    try {
      const funnels = await storage.getSalesFunnels();
      res.json(funnels);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar funis de vendas" });
    }
  });

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

  // Funnel Stage routes
  app.get("/api/funnels/:funnelId/stages", async (req, res) => {
    try {
      const stages = await storage.getFunnelStages(req.params.funnelId);
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar estágios do funil" });
    }
  });

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

  app.put("/api/funnel-stages/reorder", async (req, res) => {
    try {
      const { stageUpdates } = req.body;
      if (!Array.isArray(stageUpdates)) {
        return res.status(400).json({ message: "stageUpdates deve ser um array" });
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

  // Deal routes
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

  app.put("/api/deals/:dealId", async (req, res) => {
    try {
      const dealId = req.params.dealId;
      const data = updateDealSchema.parse(req.body);
      let rawValue: string;

      if (data.value) {
        rawValue = data.value!.replace(/\./g, "").replace(",", ".");
        const numeric = parseFloat(rawValue);
        const deals = await storage.updateDeal(dealId, {
          ...data,
          value: numeric.toString(),
        });
        res.json(deals);
      } else {
        const deals = await storage.updateDeal(dealId, data);
        res.json(deals);
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Erro ao atualizar deals" });
    }
  });

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

  app.post("/api/deals", async (req, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);

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

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      // Remove passwords from response
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.post("/api/users", async (req, res) => {
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
  });

  app.put("/api/users/:id", async (req, res) => {
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
  });

  app.delete("/api/users/:id", async (req, res) => {
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
  });

  app.patch("/api/users/:id/toggle-status", async (req, res) => {
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
  });

  // Birthday routes
  app.get("/api/upcoming-birthdays", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const userId = req.headers["x-user-id"] as string;
      const userRole = req.headers["x-user-role"] as string;
      const responsibleId = req.query.responsibleId as string;

      // Se um responsibleId específico for passado, usar esse
      // Se não, e o usuário não for admin, filtrar pelos clientes do usuário atual
      let filterByResponsible = responsibleId;
      if (
        !filterByResponsible &&
        userRole !== "admin" &&
        userRole !== "administrador"
      ) {
        filterByResponsible = userId;
      }

      const upcomingBirthdays = await storage.getUpcomingBirthdays(
        days,
        filterByResponsible
      );
      res.json(upcomingBirthdays);
    } catch (error) {
      console.error("Erro ao buscar aniversários próximos:", error);
      res.status(500).json({ message: "Erro ao buscar aniversários próximos" });
    }
  });

  // Tags routes (categories, origins, markers)
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getTagsByType("categoria");
      res.json(categories);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  app.get("/api/origins", async (req, res) => {
    try {
      const origins = await storage.getTagsByType("origem");
      res.json(origins);
    } catch (error) {
      console.error("Erro ao buscar origens:", error);
      res.status(500).json({ message: "Erro ao buscar origens" });
    }
  });

  app.get("/api/markers", async (req, res) => {
    try {
      const markers = await storage.getTagsByType("marcador");
      res.json(markers);
    } catch (error) {
      console.error("Erro ao buscar marcadores:", error);
      res.status(500).json({ message: "Erro ao buscar marcadores" });
    }
  });

  // Cashback routes
  app.get("/api/cashback-settings", async (req, res) => {
    try {
      const settings = await storage.getCashbackSettings();
      res.json(settings);
    } catch (error) {
      console.error("Erro ao buscar configurações de cashback:", error);
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.post("/api/cashback-settings", async (req, res) => {
    try {
      const validatedData = insertCashbackSettingSchema.parse(req.body);
      const setting = await storage.createCashbackSetting(validatedData);
      res.status(201).json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao criar configuração:", error);
      res.status(500).json({ message: "Erro ao criar configuração" });
    }
  });

  app.put("/api/cashback-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertCashbackSettingSchema
        .partial()
        .parse(req.body);
      const setting = await storage.updateCashbackSetting(id, validatedData);
      if (!setting) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }
      res.json(setting);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      console.error("Erro ao atualizar configuração:", error);
      res.status(500).json({ message: "Erro ao atualizar configuração" });
    }
  });

  app.delete("/api/cashback-settings/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteCashbackSetting(id);
      if (!success) {
        return res.status(404).json({ message: "Configuração não encontrada" });
      }
      res.json({ message: "Configuração excluída com sucesso" });
    } catch (error) {
      console.error("Erro ao excluir configuração:", error);
      res.status(500).json({ message: "Erro ao excluir configuração" });
    }
  });

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

  app.post("/api/cashback-transactions", async (req, res) => {
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

  // Sales routes
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
        const usage = item.cashback_usage || item;
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

      res.status(201).json(sale);
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

  app.post("/api/interactions", async (req, res) => {
    try {
      const interaction = await storage.createClientInteraction(req.body);
      res.status(201).json(interaction);
    } catch (error) {
      console.error("Erro ao criar interação:", error);
      res.status(500).json({ message: "Erro ao criar interação" });
    }
  });

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
      if (error.message === "Produto já vinculado a esta empresa") {
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

  const httpServer = createServer(app);
  return httpServer;
}
