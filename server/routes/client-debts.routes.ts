import { Router } from "express";
import { nanoid } from "nanoid";

import { storage } from "../storage";

export const clientDebtsRouter = Router();

clientDebtsRouter.get("/", async (req, res) => {
  try {
    const { responsibleId } = req.query;
    const debts = await storage.getClientDebts(responsibleId as string);
    return res.json(debts);
  } catch (error) {
    console.error("Error fetching client debts:", error);
    return res.status(500).json({ error: "Failed to fetch client debts" });
  }
});

clientDebtsRouter.post("/", async (req, res) => {
  try {
    const createdById = req.user?.userId ?? null;

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
    return res.json(debt);
  } catch (error) {
    console.error("Error creating client debt:", error);
    return res.status(500).json({ error: "Failed to create client debt" });
  }
});

clientDebtsRouter.put("/:id", async (req, res) => {
  try {
    const debt = await storage.updateClientDebt(req.params.id, req.body);
    return res.json(debt);
  } catch (error) {
    console.error("Error updating client debt:", error);
    return res.status(500).json({ error: "Failed to update client debt" });
  }
});

clientDebtsRouter.delete("/:id", async (req, res) => {
  try {
    await storage.deleteClientDebt(req.params.id);
    return res.json({ success: true });
  } catch (error) {
    console.error("Error deleting client debt:", error);
    return res.status(500).json({ error: "Failed to delete client debt" });
  }
});

export default clientDebtsRouter;
