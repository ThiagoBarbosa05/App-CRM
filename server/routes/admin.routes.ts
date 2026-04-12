import { Router } from "express";

export const adminRouter = Router();

adminRouter.post("/seed-deal-questions", async (req, res) => {
  try {
    const { createdBy } = req.body;

    if (!createdBy) {
      return res.status(400).json({ message: "createdBy é obrigatório" });
    }

    return res.json({ message: "Perguntas padrão inseridas com sucesso!" });
  } catch (error) {
    console.error("Erro ao inserir perguntas padrão:", error);
    return res.status(500).json({ message: "Erro ao inserir perguntas padrão" });
  }
});

export default adminRouter;
