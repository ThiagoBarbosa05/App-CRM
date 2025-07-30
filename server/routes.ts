import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertClientSchema,
  insertCompanySchema,
  insertDealSchema,
  insertUserSchema,
  insertSalesFunnelSchema,
  insertFunnelStageSchema,
  insertBirthdayReminderSchema,
  insertBirthdayReminderSettingsSchema,
  insertTagSchema,
  insertSectorSchema,
  insertOriginSchema,
  insertClientInteractionSchema,
  insertUserGoalSchema,
  insertCashbackSettingSchema,
  insertCashbackTransactionSchema,
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcrypt";
import { Client } from "@replit/object-storage";
import multer from "multer";
import { nanoid } from "nanoid";
import { generateAIResponse, generateAIMessage } from "./ai-helpers";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Client routes
  app.get("/api/clients", async (req, res) => {
    try {
      const clients = await storage.getClients();
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar cliente" });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const validatedData = insertClientSchema.partial().parse(req.body);
      const client = await storage.updateClient(req.params.id, validatedData);
      res.json(client);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
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
      res.json({ message: "Cliente excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir cliente" });
    }
  });

  // Company routes
  app.get("/api/companies", async (req, res) => {
    try {
      const companies = await storage.getCompanies();
      res.json(companies);
    } catch (error) {
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

  // Deal routes
  app.get("/api/deals", async (req, res) => {
    try {
      const deals = await storage.getDeals();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar deals" });
    }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      const deal = await storage.createDeal(validatedData);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar deal" });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuários" });
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
      const validatedData = insertCashbackSettingSchema.partial().parse(req.body);
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
      const transactions = await storage.getCashbackTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Erro ao buscar transações:", error);
      res.status(500).json({ message: "Erro ao buscar transações" });
    }
  });

  app.post("/api/cashback-transactions", async (req, res) => {
    try {
      const validatedData = insertCashbackTransactionSchema.parse(req.body);
      const transaction = await storage.createCashbackTransaction(validatedData);
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
      const { purchaseAmount } = req.body;
      
      if (!purchaseAmount || purchaseAmount <= 0) {
        return res.status(400).json({ message: "Valor de compra inválido" });
      }

      // Buscar configurações ativas de cashback
      const settings = await storage.getCashbackSettings();
      const activeSetting = settings.find(s => s.isActive === "true");

      if (!activeSetting) {
        return res.json({
          cashbackAmount: 0,
          rate: 0,
          setting: null
        });
      }

      const rate = parseFloat(activeSetting.percentageRate);
      const minPurchase = parseFloat(activeSetting.minimumPurchase || "0");
      const maxCashback = activeSetting.maximumCashback ? parseFloat(activeSetting.maximumCashback) : null;

      if (purchaseAmount < minPurchase) {
        return res.json({
          cashbackAmount: 0,
          rate: 0,
          setting: activeSetting
        });
      }

      let cashbackAmount = (purchaseAmount * rate) / 100;

      if (maxCashback && cashbackAmount > maxCashback) {
        cashbackAmount = maxCashback;
      }

      res.json({
        cashbackAmount,
        rate,
        setting: activeSetting
      });
    } catch (error) {
      console.error("Erro ao calcular cashback:", error);
      res.status(500).json({ message: "Erro ao calcular cashback" });
    }
  });

  app.get("/api/cashback-balances", async (req, res) => {
    try {
      const balances = await storage.getAllCashbackBalances();
      res.json(balances);
    } catch (error) {
      console.error("Erro ao buscar saldos:", error);
      res.status(500).json({ message: "Erro ao buscar saldos" });
    }
  });

  app.get("/api/cashback-balances/:clientId", async (req, res) => {
    try {
      const { clientId } = req.params;
      const balance = await storage.getClientCashbackBalance(clientId);
      res.json(balance);
    } catch (error) {
      console.error("Erro ao buscar saldo de cashback:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  app.get("/api/cashback-usage", async (req, res) => {
    try {
      const usage = await storage.getAllCashbackUsage();
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

  // Sales routes (redirect to cashback transactions)
  app.post("/api/sales", async (req, res) => {
    try {
      // Redirect sale creation to cashback transaction
      res.status(200).json({ message: "Use /api/cashback-transactions para criar vendas" });
    } catch (error) {
      console.error("Erro:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
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
      const validatedData = insertTagSchema.parse(req.body);
      const category = await storage.createTag({ ...validatedData, type: "categoria" });
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  // Origins routes
  app.post("/api/origins", async (req, res) => {
    try {
      const validatedData = insertOriginSchema.parse(req.body);
      const origin = await storage.createTag({ ...validatedData, type: "origem" });
      res.status(201).json(origin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar origem" });
    }
  });

  // Markers routes  
  app.post("/api/markers", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const marker = await storage.createTag({ ...validatedData, type: "marcador" });
      res.status(201).json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar marcador" });
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

  app.post("/api/user-goals", async (req, res) => {
    try {
      const validatedData = insertUserGoalSchema.parse(req.body);
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

  const httpServer = createServer(app);
  return httpServer;
}