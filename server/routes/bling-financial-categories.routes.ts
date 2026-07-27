import { Router, type Response } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/validation";
import {
  generateFinancialCategoryPreview,
  migrateFinancialCategories,
  type FinancialCategoryMigrationEvent,
  type FinancialCategoryPreview,
} from "../services/bling-financial-categories-migration.service";

const router = Router();
router.use(requireAdmin);

const accountsSchema = z
  .object({
    sourceConnectionId: z.string().uuid(),
    targetConnectionId: z.string().uuid(),
  })
  .refine(
    (body) => body.sourceConnectionId !== body.targetConnectionId,
    "Conta de origem e destino devem ser diferentes",
  );

const migrationSchema = accountsSchema.and(
  z.object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  }),
);

function sendSseEvent(
  res: Response,
  event: FinancialCategoryMigrationEvent,
): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * POST /api/bling-financial-categories/preview
 *
 * Gera o snapshot completo e não mutável da migração de despesas.
 */
router.post("/preview", async (req, res) => {
  const parsed = accountsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Contas de origem e destino inválidas",
      details: parsed.error.flatten(),
    });
  }

  try {
    const preview = await generateFinancialCategoryPreview(
      parsed.data.sourceConnectionId,
      parsed.data.targetConnectionId,
    );
    return res.json({ success: true, data: preview });
  } catch (error) {
    console.error(
      "[BlingFinancialCategoriesRouter] Erro ao gerar snapshot:",
      error,
    );
    return res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o snapshot",
    });
  }
});

/**
 * POST /api/bling-financial-categories/migrate
 *
 * Revalida o fingerprint e transmite o progresso da migração via SSE.
 */
router.post("/migrate", async (req, res) => {
  const parsed = migrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Dados da migração inválidos",
      details: parsed.error.flatten(),
    });
  }

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  let validatedPreview: FinancialCategoryPreview;
  try {
    validatedPreview = await generateFinancialCategoryPreview(
      parsed.data.sourceConnectionId,
      parsed.data.targetConnectionId,
      controller.signal,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao validar o snapshot da migração";
    console.error(
      "[BlingFinancialCategoriesRouter] Erro ao validar migração:",
      error,
    );
    return res.status(400).json({ success: false, error: message });
  }

  if (validatedPreview.fingerprint !== parsed.data.fingerprint) {
    return res.status(409).json({
      success: false,
      error:
        "As categorias mudaram desde o snapshot. Gere um novo snapshot antes de migrar.",
    });
  }

  if (!validatedPreview.canMigrate) {
    return res.status(409).json({
      success: false,
      error: "O snapshot possui conflitos e não pode ser migrado.",
      details: validatedPreview.validations,
    });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    await migrateFinancialCategories(
      parsed.data.sourceConnectionId,
      parsed.data.targetConnectionId,
      parsed.data.fingerprint,
      (event) => sendSseEvent(res, event),
      controller.signal,
      validatedPreview,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro ao migrar categorias financeiras";
    console.error(
      "[BlingFinancialCategoriesRouter] Erro durante migração:",
      error,
    );
    if (!res.writableEnded) {
      sendSseEvent(res, { type: "error", message });
    }
  } finally {
    if (!res.writableEnded) res.end();
  }
});

export default router;
