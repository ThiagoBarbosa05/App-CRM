import { Request, Response, Router } from "express";
import { syncBlingProducts, type SyncProgressEvent, type ProductDefaults } from "../services/bling-products-sync.service";
import { replicateBlingProducts, type ReplicateProgressEvent } from "../services/bling-products-replicate.service";

const router = Router();

const VALID_COUNTRIES = ["CHILE", "ARGENTINA", "URUGUAI", "BRASIL", "EUA", "FRANÇA", "ITÁLIA", "PORTUGAL", "ESPANHA", "ALEMANHA", "OUTROS"] as const;
const VALID_VOLUMES = ["187ml", "375ml", "750ml", "1500ml"] as const;
const VALID_TYPES = ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as const;

function getAdminUser(req: Request): { userId: string } {
  const userId = req.user?.userId;
  const userRole = req.user?.role;

  if (!userId) throw new Error("Usuario nao autenticado");
  if (userRole !== "admin") throw new Error("Apenas administradores podem sincronizar produtos do Bling");

  return { userId };
}

function sendSseEvent(res: Response, event: SyncProgressEvent | ReplicateProgressEvent): void {
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
    await syncBlingProducts(connectionId, defaults, (event) => sendSseEvent(res, event), controller.signal);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao sincronizar produtos do Bling";
    sendSseEvent(res, { type: "error", message });
  } finally {
    res.end();
  }
});

/**
 * GET /api/bling-products/replicate
 *
 * Replica produtos de uma conta Bling (origem) para outra (destino),
 * criando o link local (blingProductMappings) automaticamente.
 * Resposta via SSE com eventos de progresso.
 *
 * Query params:
 *   sourceConnectionId - ID da conexao Bling de origem (obrigatorio)
 *   targetConnectionId - ID da conexao Bling de destino (obrigatorio)
 *   dryRun             - "false" para criar de verdade no destino; qualquer
 *                        outro valor (ou ausente) roda em modo simulacao
 *
 * Requer headers: x-user-id, x-user-role: admin
 */
router.get("/replicate", async (req: Request, res: Response) => {
  let userId: string;

  try {
    ({ userId } = getAdminUser(req));
  } catch (error) {
    res.status(401).json({ message: error instanceof Error ? error.message : "Nao autorizado" });
    return;
  }

  const { sourceConnectionId, targetConnectionId, dryRun } = req.query as Record<string, string | undefined>;

  if (!sourceConnectionId) {
    res.status(400).json({ message: "sourceConnectionId e obrigatorio" });
    return;
  }

  if (!targetConnectionId) {
    res.status(400).json({ message: "targetConnectionId e obrigatorio" });
    return;
  }

  if (sourceConnectionId === targetConnectionId) {
    res.status(400).json({ message: "Conta de origem e destino devem ser diferentes" });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const controller = new AbortController();

  req.on("close", () => controller.abort());

  try {
    await replicateBlingProducts(
      sourceConnectionId,
      targetConnectionId,
      // Simulacao por padrao — modo real somente com dryRun=false explicito
      { dryRun: dryRun !== "false" },
      (event) => sendSseEvent(res, event),
      controller.signal,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao replicar produtos do Bling";
    sendSseEvent(res, { type: "error", message });
  } finally {
    res.end();
  }
});

export default router;
