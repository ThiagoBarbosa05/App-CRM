import { Router } from "express";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db.select().from(systemSettings);
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;
    res.json(map);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar configurações" });
  }
});

router.get("/:key", async (req, res) => {
  try {
    const [setting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, req.params.key));
    res.json({ value: setting?.value ?? null });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar configuração" });
  }
});

router.put("/:key", async (req, res) => {
  try {
    const { value, description } = req.body;
    if (value === undefined || value === null) {
      return res.status(400).json({ message: "Valor é obrigatório" });
    }
    await db
      .insert(systemSettings)
      .values({ key: req.params.key, value: String(value), description })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value: String(value), description },
      });
    res.json({ key: req.params.key, value: String(value) });
  } catch (e) {
    res.status(500).json({ message: "Erro ao salvar configuração" });
  }
});

export default router;
