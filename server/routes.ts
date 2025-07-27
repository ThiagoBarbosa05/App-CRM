import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertClientSchema, insertDealSchema, insertUserSchema, 
  insertSalesFunnelSchema, insertFunnelStageSchema,
  insertBirthdayReminderSchema, insertBirthdayReminderSettingsSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      if (user.isActive !== 'true') {
        return res.status(401).json({ message: "Usuário inativo" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(500).json({ message: "Erro interno do servidor" });
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
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }

      const user = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });

  // Sales Funnel routes
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
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar funil de vendas" });
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

  app.post("/api/stages", async (req, res) => {
    try {
      const validatedData = insertFunnelStageSchema.parse(req.body);
      const stage = await storage.createFunnelStage(validatedData);
      res.status(201).json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar estágio" });
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

  app.get("/api/clients/:id", async (req, res) => {
    try {
      const client = await storage.getClient(req.params.id);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
      res.json(client);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar cliente" });
    }
  });

  app.post("/api/clients", async (req, res) => {
    try {
      const validatedData = insertClientSchema.parse(req.body);
      
      // Check if CPF already exists
      const existingClientByCpf = await storage.getClientByCpf(validatedData.cpf);
      if (existingClientByCpf) {
        return res.status(400).json({ message: "CPF já cadastrado" });
      }

      // Check if phone already exists
      const existingClientByPhone = await storage.getClientByPhone(validatedData.phone);
      if (existingClientByPhone) {
        return res.status(400).json({ message: "Telefone já cadastrado" });
      }

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
      
      // If CPF is being updated, check if it's already in use by another client
      if (validatedData.cpf) {
        const existingClientByCpf = await storage.getClientByCpf(validatedData.cpf);
        if (existingClientByCpf && existingClientByCpf.id !== req.params.id) {
          return res.status(400).json({ message: "CPF já cadastrado" });
        }
      }

      // If phone is being updated, check if it's already in use by another client
      if (validatedData.phone) {
        const existingClientByPhone = await storage.getClientByPhone(validatedData.phone);
        if (existingClientByPhone && existingClientByPhone.id !== req.params.id) {
          return res.status(400).json({ message: "Telefone já cadastrado" });
        }
      }

      const client = await storage.updateClient(req.params.id, validatedData);
      if (!client) {
        return res.status(404).json({ message: "Cliente não encontrado" });
      }
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
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar cliente" });
    }
  });

  // Deal routes
  app.get("/api/deals", async (req, res) => {
    try {
      const deals = await storage.getDealsWithClients();
      res.json(deals);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar negócios" });
    }
  });

  app.get("/api/deals/:id", async (req, res) => {
    try {
      const deal = await storage.getDeal(req.params.id);
      if (!deal) {
        return res.status(404).json({ message: "Negócio não encontrado" });
      }
      res.json(deal);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar negócio" });
    }
  });

  app.post("/api/deals", async (req, res) => {
    try {
      const validatedData = insertDealSchema.parse(req.body);
      
      // Check if client exists
      const client = await storage.getClient(validatedData.clientId);
      if (!client) {
        return res.status(400).json({ message: "Cliente não encontrado" });
      }

      const deal = await storage.createDeal(validatedData);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar negócio" });
    }
  });

  app.put("/api/deals/:id", async (req, res) => {
    try {
      const validatedData = insertDealSchema.partial().parse(req.body);
      
      // If clientId is being updated, check if client exists
      if (validatedData.clientId) {
        const client = await storage.getClient(validatedData.clientId);
        if (!client) {
          return res.status(400).json({ message: "Cliente não encontrado" });
        }
      }

      const deal = await storage.updateDeal(req.params.id, validatedData);
      if (!deal) {
        return res.status(404).json({ message: "Negócio não encontrado" });
      }
      res.json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar negócio" });
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

  // Birthday Reminder routes
  app.get("/api/birthday-reminders", async (req, res) => {
    try {
      const reminders = await storage.getBirthdayReminders();
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar lembretes de aniversário" });
    }
  });

  app.get("/api/birthday-reminders/today", async (req, res) => {
    try {
      const reminders = await storage.getBirthdayRemindersForToday();
      res.json(reminders);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar lembretes de hoje" });
    }
  });

  app.post("/api/birthday-reminders", async (req, res) => {
    try {
      const validatedData = insertBirthdayReminderSchema.parse(req.body);
      const reminder = await storage.createBirthdayReminder(validatedData);
      res.status(201).json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar lembrete" });
    }
  });

  app.put("/api/birthday-reminders/:id", async (req, res) => {
    try {
      const validatedData = insertBirthdayReminderSchema.partial().parse(req.body);
      const reminder = await storage.updateBirthdayReminder(req.params.id, validatedData);
      if (!reminder) {
        return res.status(404).json({ message: "Lembrete não encontrado" });
      }
      res.json(reminder);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar lembrete" });
    }
  });

  app.delete("/api/birthday-reminders/:id", async (req, res) => {
    try {
      const success = await storage.deleteBirthdayReminder(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Lembrete não encontrado" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar lembrete" });
    }
  });

  app.put("/api/birthday-reminders/:id/mark-sent", async (req, res) => {
    try {
      const success = await storage.markReminderAsSent(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Lembrete não encontrado" });
      }
      res.json({ message: "Lembrete marcado como enviado" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao marcar lembrete como enviado" });
    }
  });

  // Birthday Reminder Settings routes
  app.get("/api/birthday-reminder-settings", async (req, res) => {
    try {
      const settings = await storage.getBirthdayReminderSettings();
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar configurações dos lembretes" });
    }
  });

  app.put("/api/birthday-reminder-settings", async (req, res) => {
    try {
      const validatedData = insertBirthdayReminderSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateBirthdayReminderSettings(validatedData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // Upcoming birthdays route
  app.get("/api/upcoming-birthdays", async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 7;
      const clients = await storage.getUpcomingBirthdays(days);
      res.json(clients);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar próximos aniversários" });
    }
  });

  // Create automatic reminders route
  app.post("/api/birthday-reminders/create-automatic", async (req, res) => {
    try {
      const remindersCreated = await storage.createAutomaticReminders();
      res.json({ 
        message: `${remindersCreated} lembretes criados automaticamente`,
        remindersCreated 
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar lembretes automáticos" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
