import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import {
  initSessionManager,
  startInstance,
  getQr,
  getConnectionState,
  logoutInstance,
  destroyInstance,
  sendText,
  sendMedia,
} from "./session-manager.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

// Valida ApiKey em todas as rotas
const apiKey = process.env.GATEWAY_API_KEY ?? "";
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!apiKey) return next(); // sem chave configurada → aberto (apenas em dev)
  const provided = req.headers["apikey"] as string | undefined;
  if (provided !== apiKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

// ── Gestão de instâncias ───────────────────────────────────────────────────────

// POST /instance/create
app.post("/instance/create", (req: Request, res: Response) => {
  const { instanceName } = req.body as { instanceName?: string };
  if (!instanceName) {
    res.status(400).json({ error: "instanceName obrigatório" });
    return;
  }
  const { instanceId, status } = startInstance(instanceName);
  res.json({ instance: { instanceName, instanceId, status } });
});

// GET /instance/connect/:name  — retorna QR atual (se disponível)
app.get("/instance/connect/:name", (req: Request, res: Response) => {
  const { name } = req.params;
  const qr = getQr(name);
  if (!qr) {
    // Ainda conectando ou já conectado
    res.json({ code: "", base64: null });
    return;
  }
  res.json({ code: qr.code, base64: qr.base64 });
});

// GET /instance/connectionState/:name
app.get("/instance/connectionState/:name", (req: Request, res: Response) => {
  const { name } = req.params;
  const state = getConnectionState(name);
  res.json({ instance: { state } });
});

// DELETE /instance/logout/:name
app.delete("/instance/logout/:name", async (req: Request, res: Response) => {
  const { name } = req.params;
  await logoutInstance(name);
  res.json({ ok: true });
});

// DELETE /instance/delete/:name
app.delete("/instance/delete/:name", async (req: Request, res: Response) => {
  const { name } = req.params;
  await destroyInstance(name);
  res.json({ ok: true });
});

// ── Envio de mensagens ─────────────────────────────────────────────────────────

// POST /message/sendText/:name
app.post("/message/sendText/:name", async (req: Request, res: Response) => {
  const { name } = req.params;
  const { number, text } = req.body as { number?: string; text?: string };
  if (!number || !text) {
    res.status(400).json({ error: "number e text obrigatórios" });
    return;
  }
  try {
    const result = await sendText(name, number, text);
    res.json(result);
  } catch (err) {
    console.error(`[Gateway] sendText falhou para ${name}:`, err);
    res.status(500).json({ error: String(err) });
  }
});

// POST /message/sendMedia/:name
app.post("/message/sendMedia/:name", async (req: Request, res: Response) => {
  const { name } = req.params;
  const { number, mediatype, media, caption, fileName, mimetype } = req.body as {
    number?: string;
    mediatype?: string;
    media?: string;
    caption?: string;
    fileName?: string;
    mimetype?: string;
  };
  if (!number || !mediatype || !media) {
    res.status(400).json({ error: "number, mediatype e media obrigatórios" });
    return;
  }
  const isBase64 = media.startsWith("data:") || !media.startsWith("http");
  try {
    const result = await sendMedia(name, number, mediatype, {
      base64: isBase64 ? media : undefined,
      url: !isBase64 ? media : undefined,
      caption,
      filename: fileName,
      mimetype,
    });
    res.json(result);
  } catch (err) {
    console.error(`[Gateway] sendMedia falhou para ${name}:`, err);
    res.status(500).json({ error: String(err) });
  }
});

// ── Healthcheck ────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Boot ───────────────────────────────────────────────────────────────────────

const PORT = Number(process.env.GATEWAY_PORT ?? 3001);

initSessionManager()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Gateway] Baileys gateway rodando na porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[Gateway] Falha na inicialização:", err);
    process.exit(1);
  });
