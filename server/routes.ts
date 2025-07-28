import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertClientSchema, insertDealSchema, insertUserSchema, 
  insertSalesFunnelSchema, insertFunnelStageSchema,
  insertBirthdayReminderSchema, insertBirthdayReminderSettingsSchema,
  insertTagSchema, insertClientInteractionSchema
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
      const newUser = await storage.createUser(validatedData);
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
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
        return res.status(400).json({ message: fromZodError(error).toString() });
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

  // Categories routes (using tags table with type="categoria")
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getTags();
      // Filter for categories only
      const categoriesOnly = categories.filter(tag => tag.type === 'categoria');
      res.json(categoriesOnly);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse({
        ...req.body,
        type: 'categoria'
      });
      const category = await storage.createTag(validatedData);
      res.status(201).json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar categoria" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTagSchema.partial().parse({
        ...req.body,
        type: 'categoria'
      });
      const category = await storage.updateTag(id, validatedData);
      if (!category) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }
      res.json(category);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar categoria" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTag(id);
      if (!deleted) {
        return res.status(404).json({ message: "Categoria não encontrada" });
      }
      res.json({ message: "Categoria excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir categoria" });
    }
  });

  // Markers routes (using tags table with type="marcador")
  app.get("/api/markers", async (req, res) => {
    try {
      const markers = await storage.getTags();
      // Filter for markers only
      const markersOnly = markers.filter(tag => tag.type === 'marcador');
      res.json(markersOnly);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar marcadores" });
    }
  });

  app.post("/api/markers", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse({
        ...req.body,
        type: 'marcador'
      });
      const marker = await storage.createTag(validatedData);
      res.status(201).json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar marcador" });
    }
  });

  app.put("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTagSchema.partial().parse({
        ...req.body,
        type: 'marcador'
      });
      const marker = await storage.updateTag(id, validatedData);
      if (!marker) {
        return res.status(404).json({ message: "Marcador não encontrado" });
      }
      res.json(marker);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar marcador" });
    }
  });

  app.delete("/api/markers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTag(id);
      if (!deleted) {
        return res.status(404).json({ message: "Marcador não encontrado" });
      }
      res.json({ message: "Marcador excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir marcador" });
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

  // Get unique markers - needs to be before /:id route
  app.get("/api/clients/markers", async (req, res) => {
    try {
      const markers = await storage.getUniqueMarkers();
      res.json(markers);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar marcadores" });
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
      if (validatedData.cpf) {
        const existingClientByCpf = await storage.getClientByCpf(validatedData.cpf);
        if (existingClientByCpf) {
          return res.status(400).json({ message: "CPF já cadastrado" });
        }
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
      res.json({ message: "Cliente excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar cliente" });
    }
  });

  app.delete("/api/clients", async (req, res) => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs dos clientes são obrigatórios" });
      }
      
      console.log("Tentando excluir clientes com IDs:", ids);
      const deletedCount = await storage.deleteClients(ids);
      console.log("Clientes excluídos:", deletedCount);
      
      res.json({ 
        message: `${deletedCount} cliente(s) excluído(s) com sucesso`,
        deletedCount 
      });
    } catch (error) {
      console.error("Erro ao excluir clientes:", error);
      res.status(500).json({ message: "Erro ao excluir clientes" });
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
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar tag" });
    }
  });

  app.put("/api/tags/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTagSchema.partial().parse(req.body);
      const tag = await storage.updateTag(id, validatedData);
      
      if (!tag) {
        return res.status(404).json({ message: "Tag não encontrada" });
      }
      
      res.json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteTag(id);
      
      if (!success) {
        return res.status(404).json({ message: "Tag não encontrada" });
      }
      
      res.json({ message: "Tag excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir tag" });
    }
  });

  // Client Interactions routes
  app.get("/api/clients/:clientId/interactions", async (req, res) => {
    try {
      const { clientId } = req.params;
      const interactions = await storage.getClientInteractions(clientId);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar interações" });
    }
  });

  app.get("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const interaction = await storage.getClientInteraction(id);
      
      if (!interaction) {
        return res.status(404).json({ message: "Interação não encontrada" });
      }
      
      res.json(interaction);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar interação" });
    }
  });

  app.post("/api/interactions", async (req, res) => {
    try {
      const validatedData = insertClientInteractionSchema.parse(req.body);
      const interaction = await storage.createClientInteraction(validatedData);
      res.status(201).json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar interação" });
    }
  });

  app.put("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertClientInteractionSchema.partial().parse(req.body);
      const interaction = await storage.updateClientInteraction(id, validatedData);
      
      if (!interaction) {
        return res.status(404).json({ message: "Interação não encontrada" });
      }
      
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar interação" });
    }
  });

  app.delete("/api/interactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteClientInteraction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Interação não encontrada" });
      }
      
      res.json({ message: "Interação excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir interação" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
