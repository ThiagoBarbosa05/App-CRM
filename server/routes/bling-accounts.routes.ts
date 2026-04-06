import { Request, Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { blingConnections } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { blingConnectionsService } from "../services/bling-connections.service";
import { getBlingVendorsController } from "../controllers/bling-accounts/get-bling-vendors.controller";
import {
  startImport,
  cancelImport,
  getImportStatus,
  loadValidatedConnection,
} from "../services/bling-historical-import.service";

const router = Router();

const createConnectionSchema = z.object({
  name: z.string().trim().min(1, "Nome da conexao e obrigatorio").max(120),
  oauthClientId: z.string().trim().min(1, "Client ID e obrigatorio").max(255),
  oauthClientSecret: z
    .string()
    .trim()
    .min(1, "Client Secret e obrigatorio")
    .max(500),
});

const updateConnectionSchema = z.object({
  name: z.string().trim().min(1, "Nome da conexao e obrigatorio").max(120),
  oauthClientId: z.string().trim().min(1, "Client ID e obrigatorio").max(255),
  oauthClientSecret: z.string().trim().max(500).optional(),
});

function getAdminUser(req: Request): {
  userId: string;
  userRole: string;
} {
  const userId = req.headers["x-user-id"] as string | undefined;
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (!userId) {
    throw new Error("Usuario nao autenticado");
  }

  if (userRole !== "admin") {
    throw new Error("Apenas administradores podem gerenciar contas Bling");
  }

  return { userId, userRole };
}

function getCallbackRedirectUrl(
  status: "success" | "error",
  message: string,
): string {
  const frontendUrl = process.env.APP_URL || "http://localhost:5000";
  const url = new URL("/configuracoes", frontendUrl);
  url.searchParams.set("tab", "bling-accounts");
  url.searchParams.set("bling", status);
  url.searchParams.set("message", message);
  return url.toString();
}

function renderCallbackHtml(redirectUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0;url=${redirectUrl}" />
    <title>Conectando Bling</title>
  </head>
  <body>
    <p>Redirecionando...</p>
    <script>window.location.replace(${JSON.stringify(redirectUrl)});</script>
  </body>
</html>`;
}

router.get("/", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const connections = await blingConnectionsService.listByUser(userId);

    res.json({ success: true, data: connections });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao listar contas Bling";
    const status = message.includes("administradores") ? 403 : 401;
    res.status(status).json({ success: false, error: message });
  }
});

router.post("/connect", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const body = createConnectionSchema.parse(req.body);
    const connection = await blingConnectionsService.createConnection({
      userId,
      name: body.name,
      oauthClientId: body.oauthClientId,
      oauthClientSecret: body.oauthClientSecret,
    });
    const payload = await blingConnectionsService.createAuthorizationUrl(
      connection.id,
      userId,
    );

    res.json({ success: true, data: payload });
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro ao iniciar conexao:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Dados invalidos",
        details: error.errors,
      });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Erro ao iniciar conexao com Bling";
    const status = message.includes("administradores")
      ? 403
      : message.includes("autenticado")
        ? 401
        : 500;
    return res.status(status).json({ success: false, error: message });
  }
});

router.get("/vendors", async (req, res) => {
  try {
    getAdminUser(req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro de autenticação";
    const status = message.includes("administradores") ? 403 : 401;
    return res.status(status).json({ success: false, error: message });
  }

  return getBlingVendorsController(req, res);
});

router.put("/:id", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const body = updateConnectionSchema.parse(req.body);
    const connection = await blingConnectionsService.updateConnectionSettings({
      connectionId: req.params.id,
      userId,
      name: body.name,
      oauthClientId: body.oauthClientId,
      oauthClientSecret:
        body.oauthClientSecret && body.oauthClientSecret.length > 0
          ? body.oauthClientSecret
          : undefined,
    });

    return res.json({ success: true, data: connection });
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro ao atualizar conta:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Dados invalidos",
        details: error.errors,
      });
    }

    const message =
      error instanceof Error ? error.message : "Erro ao atualizar conta Bling";
    return res.status(400).json({ success: false, error: message });
  }
});

router.get("/callback", async (req, res) => {
  const querySchema = z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  });

  try {
    const query = querySchema.parse(req.query);
    await blingConnectionsService.handleOAuthCallback({
      code: query.code,
      state: query.state,
    });

    return res
      .status(200)
      .type("html")
      .send(
        renderCallbackHtml(
          getCallbackRedirectUrl(
            "success",
            "Conta Bling conectada com sucesso",
          ),
        ),
      );
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro no callback OAuth:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao concluir autenticacao com Bling";
    return res
      .status(200)
      .type("html")
      .send(renderCallbackHtml(getCallbackRedirectUrl("error", message)));
  }
});

router.post("/:id/refresh", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const connection = await blingConnectionsService.refreshConnection(
      req.params.id,
      userId,
    );
    res.json({ success: true, data: connection });
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro ao renovar conexao:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao renovar conexao Bling";
    res.status(400).json({ success: false, error: message });
  }
});

router.post("/:id/reconnect", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const connection = await blingConnectionsService.getById(
      req.params.id,
      userId,
    );

    if (!connection) {
      return res
        .status(404)
        .json({ success: false, error: "Conexao Bling nao encontrada" });
    }

    const payload = await blingConnectionsService.createAuthorizationUrl(
      connection.id,
      userId,
    );

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro ao reconectar conta:", error);
    const message =
      error instanceof Error ? error.message : "Erro ao reconectar conta Bling";
    return res.status(400).json({ success: false, error: message });
  }
});

router.post("/:id/disconnect", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    await blingConnectionsService.disconnectConnection(req.params.id, userId);
    res.json({
      success: true,
      message: "Conta Bling desconectada com sucesso",
    });
  } catch (error) {
    console.error("[BlingAccountsRouter] Erro ao desconectar conta:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao desconectar conta Bling";
    res.status(400).json({ success: false, error: message });
  }
});

router.get("/:id/status", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);
    const connection = await blingConnectionsService.getConnectionStatus(
      req.params.id,
      userId,
    );
    res.json({ success: true, data: connection });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao buscar status da conta Bling";
    res.status(400).json({ success: false, error: message });
  }
});

// ---------------------------------------------------------------------------
// Importação histórica de pedidos
// ---------------------------------------------------------------------------

const importOrdersSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "startDate deve estar no formato yyyy-MM-dd"),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "endDate deve estar no formato yyyy-MM-dd"),
  forceUpdate: z.boolean().optional(),
  idSituacao: z.number().int().positive().optional(),
  idLoja: z.number().int().positive().optional(),
});

/**
 * POST /api/bling-accounts/:id/import-orders
 *
 * Inicia importação histórica de pedidos do Bling para o período informado.
 * Responde 202 imediatamente; o processo roda em background com rate limit.
 * Consulte o status via GET /:id/import-status.
 */
router.post("/:id/import-orders", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);

    const parsed = importOrdersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: "Parâmetros inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const connection = await loadValidatedConnection(req.params.id, userId);
    if (!connection) {
      res.status(404).json({
        success: false,
        error: "Conexão Bling não encontrada ou não autenticada",
      });
      return;
    }

    const started = await startImport(connection, parsed.data);
    if (!started) {
      res.status(409).json({
        success: false,
        error:
          "Já existe uma importação em andamento para esta conexão. Aguarde ou cancele via POST /:id/import-cancel.",
      });
      return;
    }

    res.status(202).json({
      success: true,
      message: `Importação iniciada para o período ${parsed.data.startDate} → ${parsed.data.endDate}. Acompanhe via GET /api/bling-accounts/${req.params.id}/import-status.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao iniciar importação";
    res
      .status(
        error instanceof Error &&
          error.message.includes("Apenas administradores")
          ? 403
          : 500,
      )
      .json({ success: false, error: message });
  }
});

/**
 * GET /api/bling-accounts/:id/import-status
 *
 * Retorna o estado atual da importação histórica (progresso, contadores, erros).
 */
router.get("/:id/import-status", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);

    const connection = await loadValidatedConnection(req.params.id, userId);
    if (!connection) {
      res.status(404).json({
        success: false,
        error: "Conexão Bling não encontrada",
      });
      return;
    }

    const status = getImportStatus(connection.id);
    res.json({ success: true, data: status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao buscar status";
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/bling-accounts/:id/import-cancel
 *
 * Sinaliza o cancelamento cooperativo de uma importação em andamento.
 */
router.post("/:id/import-cancel", async (req, res) => {
  try {
    const { userId } = getAdminUser(req);

    const connection = await loadValidatedConnection(req.params.id, userId);
    if (!connection) {
      res.status(404).json({
        success: false,
        error: "Conexão Bling não encontrada",
      });
      return;
    }

    const cancelled = cancelImport(connection.id);
    if (!cancelled) {
      res.status(400).json({
        success: false,
        error: "Nenhuma importação em andamento para cancelar.",
      });
      return;
    }

    res.json({ success: true, message: "Cancelamento solicitado." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao cancelar importação";
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
