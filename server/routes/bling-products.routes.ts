import { Request, Response, Router } from "express";
import { syncBlingProducts, type SyncProgressEvent } from "../services/bling-products-sync.service";

const router = Router();

function getAdminUser(req: Request): { userId: string } {
  const userId = req.headers["x-user-id"] as string | undefined;
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (!userId) {
    throw new Error("Usuario nao autenticado");
  }

  if (userRole !== "admin") {
    throw new Error("Apenas administradores podem sincronizar produtos do Bling");
  }

  return { userId };
}

function sendSseEvent(res: Response, event: SyncProgressEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * GET /api/bling-products/sync?connectionId=<id>
 *
 * SSE endpoint que transmite o progresso de sincronização de produtos do Bling
 * em tempo real. Requer headers x-user-id e x-user-role: admin.
 */
router.get("/sync", async (req: Request, res: Response) => {
  let userId: string;

  try {
    ({ userId } = getAdminUser(req));
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Nao autorizado" });
    return;
  }

  const connectionId = req.query.connectionId as string | undefined;

  if (!connectionId) {
    res.status(400).json({ message: "connectionId e obrigatorio" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering if present
  res.flushHeaders();

  const controller = new AbortController();

  req.on("close", () => {
    controller.abort();
  });

  try {
    await syncBlingProducts(
      connectionId,
      userId,
      (event) => sendSseEvent(res, event),
      controller.signal,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar produtos do Bling";
    sendSseEvent(res, { type: "error", message });
  } finally {
    res.end();
  }
});

export default router;
