import { Request, Response, Router } from "express";
import { createCashbackSetting, insertCashbackSettingSchema } from "server/db/functions/create-cashback-settings";

import { ZodError } from "zod";

const router = Router();

router.post("/cashback-settings", async (req: Request, res: Response) => {
  try {
    // Validar o corpo da requisição com o schema Zod
    const validationResult = insertCashbackSettingSchema.safeParse(req.body);

    if (!validationResult.success) {
      // Se a validação falhar, retorne os erros
      return res.status(400).json({ errors: validationResult.error.flatten() });
    }

    // Dados validados
    const validatedData = validationResult.data;

    // Criar a configuração de cashback
    const newSetting = await createCashbackSetting(validatedData);

    // Retornar a nova configuração com status 201
    return res.status(201).json(newSetting);
  } catch (error) {
    // Tratamento de erros
    if (error instanceof ZodError) {
      // Este bloco pode não ser estritamente necessário se a validação acima for suficiente,
      // mas é uma boa prática para capturar qualquer erro Zod inesperado.
      return res.status(400).json({ errors: error.flatten() });
    }

    console.error("Erro ao criar configuração de cashback:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

export default router;
