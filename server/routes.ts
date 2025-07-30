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

  // Categories routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  // Origins routes
  app.get("/api/origins", async (req, res) => {
    try {
      const origins = await storage.getOrigins();
      res.json(origins);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar origens" });
    }
  });

  // Markers routes
  app.get("/api/markers", async (req, res) => {
    try {
      const markers = await storage.getMarkers();
      res.json(markers);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar marcadores" });
    }
  });

  // Cashback routes
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
  app.post("/api/sales", async (req, res) => {
    try {
      const saleData = req.body;
      const sale = await storage.createSale(saleData);
      res.status(201).json(sale);
    } catch (error) {
      console.error("Erro ao criar venda:", error);
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
      const category = await storage.createCategory(validatedData);
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
      const origin = await storage.createOrigin(validatedData);
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
      const marker = await storage.createMarker(validatedData);
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
      if (!success) {
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