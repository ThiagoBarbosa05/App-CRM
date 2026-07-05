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
  clientInteractions,
  clients,
  users,
  serviceChannels,
  userServiceChannel,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { Client } from "@replit/object-storage";
import { nanoid } from "nanoid";
import { generateAIResponse, generateAIMessage } from "./ai-helpers";
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
  getChat,
  getChatById,
  getContactByPhone,
  getContacts,
  sendMessage,
  startBirthdayBot,
  syncContact,
  updateCashback,
  updateContact,
  deleteContact,
  getContactTags,
  getContactConversations,
  getTags,
  getBots,
  getChannels,
  getManualStartsBot,
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
import { apiRouter } from "./routes/index";
import { mcpRouter } from "./routes/mcp.routes";
import {
  createObjectStorageApiRouter,
  objectEntitiesRouter,
  publicObjectsRouter,
} from "./routes/object-storage.routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // MCP Server — também acessível em /mcp (sem prefixo /api)
  // Clientes MCP externos (Claude Desktop, etc.) usam esta URL mais curta
  app.use("/mcp", mcpRouter);

  // === NOVA ARQUITETURA REFATORADA ===
  // Usar novo sistema de rotas modular
  app.use("/api", apiRouter);
  app.use(createObjectStorageApiRouter());
  app.use(publicObjectsRouter);
  app.use(objectEntitiesRouter);

  // === ROTAS ANTIGAS (EM MIGRAÇÃO) ===
  // TODO: Migrar gradualmente todas as rotas para a nova arquitetura

  // MIGRADO: Rotas para Message Jobs Logs - ver message-jobs-logs.routes.ts

  // Umbler Integrations

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

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-transactions
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

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - POST /api/calculate-cashback
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-balances
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-balances/:clientId
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - DELETE /api/cashback-balances/:balanceId
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-usage
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - POST /api/cashback-usage
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-usage/:clientId
  /*
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
  */

  // Reports routes

  // Sales routes
  app.get("/api/sales-statistics", getSalesStatisticsController);
  app.get("/api/sales-history", getSalesHistoryController);

  // MIGRADO PARA MODULAR: server/routes/sales.routes.ts - GET /api/sales
  /*
  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Erro ao buscar vendas:", error);
      res.status(500).json({ message: "Erro ao buscar vendas" });
    }
  });
  */

  // MIGRADO PARA MODULAR: server/routes/cashback.routes.ts - GET /api/cashback-reports/30-days
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/sales.routes.ts - POST /api/sales
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/sales.routes.ts - DELETE /api/sales/:id
  /*
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
  */

  // Sectors routes
  // MIGRADO PARA MODULAR: server/routes/sectors.routes.ts - GET /api/sectors
  /*
  app.get("/api/sectors", async (req, res) => {
    try {
      const sectors = await storage.getSectors();
      res.json(sectors);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar setores" });
    }
  });
  */

  // MIGRADO PARA MODULAR: server/routes/sectors.routes.ts - POST /api/sectors
  /*
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
  */

  // Tags routes
  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - GET /api/tags
  /*
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar tags" });
    }
  });
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - POST /api/tags
  /*
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
  */

  // Categories routes
  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - POST /api/categories
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - PUT /api/categories/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - DELETE /api/categories/:id
  /*
  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });
  */

  // Origins routes
  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - POST /api/origins
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - PUT /api/origins/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - DELETE /api/origins/:id
  /*
  app.delete("/api/origins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir origem" });
    }
  });
  */

  // Markers routes
  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - POST /api/markers
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - PUT /api/markers/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/tags.routes.ts - DELETE /api/markers/:id
  /*
  app.delete("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteTag(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir marcador" });
    }
  });
  */

  // User Goals routes
  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - GET /api/user-goals
  /*
  app.get("/api/user-goals", async (req, res) => {
    try {
      const goals = await storage.getUserGoals();
      res.json(goals);
    } catch (error) {
      console.error("Erro ao buscar metas:", error);
      res.status(500).json({ message: "Erro ao buscar metas" });
    }
  });
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - GET /api/user-goals/:userId
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - GET /api/user-goals-with-results/:month/:year
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - GET /api/user-registration-stats
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/clients.routes.ts - GET /api/clients/:clientId/interactions
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/clients.routes.ts - GET /api/clients/:clientId/funnels
  /*
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
  */

  // Company interactions and funnels routes
  // MIGRADO PARA MODULAR: server/routes/companies.routes.ts - GET /api/companies/:companyId/interactions
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/companies.routes.ts - GET /api/companies/:companyId/funnels
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/companies.routes.ts - GET /api/companies/:companyId/deals/:dealId/answered-questions
  /*
  // Get answered questions for a specific deal of a company
  app.get(
    "/api/companies/:companyId/deals/:dealId/answered-questions",
    getDealAnsweredQuestionsController
  );
  */

  // app.post("/api/interactions", async (req, res) => {
  //   try {
  //     const interaction = await storage.createClientInteraction(req.body);
  //     res.status(201).json(interaction);
  //   } catch (error) {
  //     console.error("Erro ao criar interação:", error);
  //     res.status(500).json({ message: "Erro ao criar interação" });
  //   }
  // });

  // MIGRADO PARA MODULAR: server/routes/interactions.routes.ts - PUT /api/interactions/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/interactions.routes.ts - DELETE /api/interactions/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - POST /api/user-goals
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts - PUT /api/user-goals/:id
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/user-goals.routes.ts (DELETE /api/user-goals/:id)
  /*
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
  */

  // Weekly Results routes
  // MIGRADO PARA MODULAR: server/routes/weekly-results.routes.ts (GET /api/weekly-results)
  /*
  app.get("/api/weekly-results", async (req, res) => {
    try {
      const results = await storage.getAllWeeklyResults();
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar resultados semanais:", error);
      res.status(500).json({ message: "Erro ao buscar resultados semanais" });
    }
  });
  */

  // app.get("/api/weekly-results/:goalId", async (req, res) => {
  //   try {
  //     const { goalId } = req.params;
  //     const results = await storage.getWeeklyResultsByGoalId(goalId);
  //     res.json(results);
  //   } catch (error) {
  //     console.error("Erro ao buscar resultados semanais:", error);
  //     res.status(500).json({ message: "Erro ao buscar resultados semanais" });
  //   }
  // });

  // MIGRADO PARA MODULAR: server/routes/weekly-results.routes.ts (POST /api/weekly-results)
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/weekly-results.routes.ts (PUT /api/weekly-results/:id)
  /*
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
  */

  // MIGRADO PARA MODULAR: server/routes/weekly-results.routes.ts (DELETE /api/weekly-results/:id)
  /*
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
  */

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

  // [DEPRECADO] Rotas de sincronização Umbler → CRM — desabilitadas na migração para WA Cloud API
  // const umblerSyncRoutes = await import("./routes/umbler-sync.routes");
  // app.use("/api/umbler-sync", umblerSyncRoutes.default);

  // Middleware de tratamento de erros deve ser o último.
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
