import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertClientSchema, insertDealSchema, insertUserSchema, 
  insertSalesFunnelSchema, insertFunnelStageSchema,
  insertBirthdayReminderSchema, insertBirthdayReminderSettingsSchema,
  insertTagSchema,
  insertOriginSchema, insertClientInteractionSchema
} from "@shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import bcrypt from "bcrypt";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      console.log("Tentativa de login:", { email, password: password ? "***" : "não fornecida" });

      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }

      const user = await storage.getUserByEmail(email);
      console.log("Usuário encontrado:", user ? { id: user.id, email: user.email, isActive: user.isActive } : "não encontrado");

      if (!user) {
        return res.status(401).json({ message: "Email não encontrado" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Senha incorreta" });
      }

      if (user.isActive !== 'true') {
        return res.status(401).json({ message: "Usuário inativo" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      console.log("Login bem-sucedido para:", userWithoutPassword.email);
      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Erro no login:", error);
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

  app.put("/api/users/:id/profile", async (req, res) => {
    try {
      const { id } = req.params;
      const { name, email, currentPassword, password } = req.body;

      // Buscar usuário atual
      const currentUser = await storage.getUser(id);
      if (!currentUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // Se está tentando alterar a senha, verificar a senha atual
      if (password && currentPassword) {
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, currentUser.password);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: "Senha atual incorreta" });
        }
      }

      // Verificar se o email já está em uso por outro usuário
      if (email && email !== currentUser.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser && existingUser.id !== id) {
          return res.status(400).json({ message: "Este email já está em uso" });
        }
      }

      const updateData: any = { name, email };
      if (password) {
        updateData.password = password;
      }

      const updatedUser = await storage.updateUser(id, updateData);
      if (!updatedUser) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
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
      console.error("Error updating marker:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ 
        message: "Erro ao atualizar marcador",
        error: error instanceof Error ? error.message : String(error)
      });
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

  // Origin routes
  app.get("/api/origins", async (req, res) => {
    try {
      const origins = await storage.getTags();
      // Filter for origins only
      const originsOnly = origins.filter(tag => tag.type === 'origem');
      res.json(originsOnly);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar origens" });
    }
  });

  app.post("/api/origins", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse({
        ...req.body,
        type: 'origem'
      });
      const origin = await storage.createTag(validatedData);
      res.status(201).json(origin);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ message: "Erro ao criar origem" });
    }
  });

  app.put("/api/origins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = insertTagSchema.partial().parse({
        ...req.body,
        type: 'origem'
      });
      const origin = await storage.updateTag(id, validatedData);
      if (!origin) {
        return res.status(404).json({ message: "Origem não encontrada" });
      }
      res.json(origin);
    } catch (error) {
      console.error("Error updating origin:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: fromZodError(error).toString() });
      }
      res.status(500).json({ 
        message: "Erro ao atualizar origem",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/origins/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteTag(id);
      if (!deleted) {
        return res.status(404).json({ message: "Origem não encontrada" });
      }
      res.json({ message: "Origem excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir origem" });
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
      const { userId, userRole } = req.query;
      const clients = await storage.getClients(userId as string, userRole as string);
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
      // Process responsavelId: convert "none" to null
      const processedData = {
        ...req.body,
        responsavelId: req.body.responsavelId === "none" ? null : req.body.responsavelId
      };

      const validatedData = insertClientSchema.parse(processedData);



      // Check if phone already exists
      const existingClientByPhone = await storage.getClientByPhone(validatedData.phone);
      if (existingClientByPhone) {
        return res.status(400).json({ message: "Telefone já cadastrado" });
      }

      const client = await storage.createClient(validatedData);
      res.status(201).json(client);
    } catch (error) {
      console.error("Error creating client:", error);
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar cliente", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.put("/api/clients/:id", async (req, res) => {
    try {
      const validatedData = insertClientSchema.partial().parse(req.body);



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
      const { userId, userRole } = req.query;
      const deals = await storage.getDealsWithClients(userId as string, userRole as string);
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

  // Funnel Stages routes
  app.get("/api/funnel-stages", async (req, res) => {
    try {
      const { funnelId } = req.query;
      if (!funnelId) {
        return res.status(400).json({ message: "funnelId é obrigatório" });
      }
      const stages = await storage.getFunnelStages(funnelId as string);
      res.json(stages);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar etapas do funil" });
    }
  });

  app.post("/api/funnel-stages", async (req, res) => {
    try {
      const validatedData = insertFunnelStageSchema.parse(req.body);
      const stage = await storage.createFunnelStage(validatedData);
      res.status(201).json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao criar etapa do funil" });
    }
  });

  app.put("/api/funnel-stages/:id", async (req, res) => {
    try {
      const validatedData = insertFunnelStageSchema.partial().parse(req.body);
      const stage = await storage.updateFunnelStage(req.params.id, validatedData);
      if (!stage) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      res.json(stage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.toString() });
      }
      res.status(500).json({ message: "Erro ao atualizar etapa do funil" });
    }
  });

  app.delete("/api/funnel-stages/:id", async (req, res) => {
    try {
      const success = await storage.deleteFunnelStage(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Etapa não encontrada" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar etapa do funil" });
    }
  });

  // Email Campaign routes
  app.get("/api/email-campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getEmailCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar campanhas de email" });
    }
  });

  app.get("/api/email-campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getEmailCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar campanha" });
    }
  });

  app.post("/api/email-campaigns", async (req, res) => {
    try {
      // Adicionar createdBy baseado no usuário logado (assumindo que existe uma sessão)
      const campaignData = {
        ...req.body,
        createdBy: "a141d784-f53a-4dfd-a35c-7bb016852677" // ID do admin padrão - idealmente viria da sessão
      };
      
      const campaign = await storage.createEmailCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error("Error creating email campaign:", error);
      res.status(500).json({ message: "Erro ao criar campanha de email" });
    }
  });

  app.put("/api/email-campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.updateEmailCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar campanha" });
    }
  });

  app.delete("/api/email-campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteEmailCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campanha não encontrada" });
      }
      res.json({ message: "Campanha excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir campanha" });
    }
  });

  app.post("/api/email-campaigns/:id/send", async (req, res) => {
    try {
      const result = await storage.sendEmailCampaign(req.params.id);
      if (!result.success) {
        return res.status(400).json({ message: "Erro ao enviar campanha", errors: result.errors });
      }
      res.json({ 
        message: `Campanha enviada com sucesso para ${result.sentCount} destinatários`,
        sentCount: result.sentCount 
      });
    } catch (error) {
      res.status(500).json({ message: "Erro ao enviar campanha" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}