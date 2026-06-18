import { Router, type Request, type Response } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { whatsappAccountEvents, whatsappFlows, whatsappTemplates } from "@shared/schema";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";

const router = Router();

router.get("/monitor/health", async (req: Request, res: Response) => {
  try {
    const [settings, templateIssuesResult, flowsBlockedResult, lastCriticalEvent, totalResult] =
      await Promise.all([
        getWhatsappSettingsRaw(),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(whatsappTemplates)
          .where(inArray(whatsappTemplates.metaStatus, ["REJECTED", "PAUSED", "DISABLED", "PENDING_DELETION"])),

        db
          .select({ count: sql<number>`count(*)::int` })
          .from(whatsappFlows)
          .where(inArray(whatsappFlows.status, ["BLOCKED", "DEPRECATED"])),

        db
          .select()
          .from(whatsappAccountEvents)
          .where(inArray(whatsappAccountEvents.severity, ["CRITICAL", "HIGH"]))
          .orderBy(desc(whatsappAccountEvents.createdAt))
          .limit(1),

        db.select({ count: sql<number>`count(*)::int` }).from(whatsappAccountEvents),
      ]);

    res.json({
      throughputTier: settings["wa_throughput_tier"] ?? null,
      templatesWithIssues: templateIssuesResult[0]?.count ?? 0,
      flowsBlocked: flowsBlockedResult[0]?.count ?? 0,
      lastCriticalEvent: lastCriticalEvent[0] ?? null,
      totalEvents: totalResult[0]?.count ?? 0,
    });
  } catch (err) {
    console.error("[WA Monitor] Erro ao buscar health:", err);
    res.status(500).json({ error: "Erro ao buscar dados de saúde" });
  }
});

router.get("/monitor/events", async (req: Request, res: Response) => {
  try {
    const severity = req.query.severity as string | undefined;
    const field = req.query.field as string | undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const conditions = [];
    if (severity) conditions.push(eq(whatsappAccountEvents.severity, severity));
    if (field) conditions.push(eq(whatsappAccountEvents.field, field));

    const whereClause =
      conditions.length === 1
        ? conditions[0]
        : conditions.length > 1
          ? sql`${conditions[0]} AND ${conditions[1]}`
          : undefined;

    const [events, totalResult] = await Promise.all([
      db
        .select()
        .from(whatsappAccountEvents)
        .where(whereClause)
        .orderBy(desc(whatsappAccountEvents.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(whatsappAccountEvents)
        .where(whereClause),
    ]);

    res.json({ events, total: totalResult[0]?.count ?? 0 });
  } catch (err) {
    console.error("[WA Monitor] Erro ao buscar eventos:", err);
    res.status(500).json({ error: "Erro ao buscar eventos" });
  }
});

export default router;
