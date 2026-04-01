import { Request, Response, Router } from "express";
import { syncBlingProducts, type SyncProgressEvent, type ProductDefaults } from "../services/bling-products-sync.service";

const router = Router();

const VALID_COUNTRIES = ["CHILE", "ARGENTINA", "URUGUAI", "BRASIL", "EUA", "FRANÇA", "ITÁLIA", "PORTUGAL", "ESPANHA", "ALEMANHA", "OUTROS"] as const;
const VALID_VOLUMES = ["187ml", "375ml", "750ml", "1500ml"] as const;
const VALID_TYPES = ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as const;

function getAdminUser(req: Request): { userId: string } {
  const userId = req.headers["x-user-id"] as string | undefined;
  const userRole = req.headers["x-user-role"] as string | undefined;

  if (!userId) throw new Error("Usuario nao autenticado");
  if (userRole !== "admin") throw new Error("Apenas administradores podem sincronizar produtos do Bling");

  return { userId };
}

function sendSseEvent(res: Response, event: SyncProgressEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * GET /api/bling-products/sync
 *
 * Query params:
 *   connectionId    - ID da conexao Bling (obrigatorio)
 *   defaultCountry  - Pais padrao para produtos novos (obrigatorio)
 *   defaultVolume   - Volume padrao para produtos novos (obrigatorio)
 *   defaultType     - Tipo padrao para produtos novos (obrigatorio)
 *
 * Requer headers: x-user-id, x-user-role: admin
 */
router.get("/sync", async (req: Request, res: Response) => {
  let userId: string;

  try {
    ({ userId } = getAdminUser(req));
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Nao autorizado" });
    return;
  }

  const { connectionId, defaultCountry, defaultVolume, defaultType } = req.query as Record<string, string | undefined>;

  if (!connectionId) {
    res.status(400).json({ message: "connectionId e obrigatorio" });
    return;
  }

  if (!defaultCountry || !VALID_COUNTRIES.includes(defaultCountry as typeof VALID_COUNTRIES[number])) {
    res.status(400).json({ message: `defaultCountry invalido. Valores aceitos: ${VALID_COUNTRIES.join(", ")}` });
    return;
  }

  if (!defaultVolume || !VALID_VOLUMES.includes(defaultVolume as typeof VALID_VOLUMES[number])) {
    res.status(400).json({ message: `defaultVolume invalido. Valores aceitos: ${VALID_VOLUMES.join(", ")}` });
    return;
  }

  if (!defaultType || !VALID_TYPES.includes(defaultType as typeof VALID_TYPES[number])) {
    res.status(400).json({ message: `defaultType invalido. Valores aceitos: ${VALID_TYPES.join(", ")}` });
    return;
  }

  const defaults: ProductDefaults = {
    country: defaultCountry,
    volume: defaultVolume,
    type: defaultType,
    createdBy: userId,
  };

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const controller = new AbortController();

  req.on("close", () => controller.abort());

  try {
    await syncBlingProducts(connectionId, userId, defaults, (event) => sendSseEvent(res, event), controller.signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar produtos do Bling";
    sendSseEvent(res, { type: "error", message });
  } finally {
    res.end();
  }
});

export default router;
