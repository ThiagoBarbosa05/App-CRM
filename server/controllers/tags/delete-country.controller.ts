import { Request, Response } from "express";
import { storage } from "../../storage";

export const deleteCountryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTag(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir país" });
  }
};
