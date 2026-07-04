import { Router } from "express";
import { getOpenAIStatus, testOpenAIConnection } from "../services/openai-status.service";

const router = Router();

router.get("/status", (req, res) => {
  return res.json(getOpenAIStatus());
});

router.post("/test", async (req, res) => {
  const status = await testOpenAIConnection();
  return res.json(status);
});

router.get("/config", (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  const keyHint = apiKey.length > 8
    ? `sk-...${apiKey.slice(-4)}`
    : apiKey.length > 0 ? "sk-****" : null;

  return res.json({
    models: {
      chat: "gpt-3.5-turbo",
      test: "gpt-4o-mini",
      profile: "gpt-4o-mini",
    },
    defaults: {
      temperature: 0.7,
      maxTokens: 500,
    },
    uses: [
      "Perfil de gosto dos clientes",
      "Perfil de IA dos produtos (vinhos)",
      "Classificação de intenção no chatbot WhatsApp",
      "Geração de mensagens personalizadas",
    ],
    keyHint,
    configured: !!apiKey,
  });
});

export default router;
