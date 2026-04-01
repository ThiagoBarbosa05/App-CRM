import { Request, Response } from "express";
import { storage } from "../../storage";

export const getClientByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "ID do cliente é obrigatório" });
    }

    const client = await storage.getClient(id);
    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    return res.json(client);
  } catch (error) {
    console.error("Erro no getClientByIdController:", error);
    return res.status(500).json({ message: "Erro ao buscar cliente" });
  }
};
