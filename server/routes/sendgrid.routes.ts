import { Router } from "express";
import { db } from "server/db";
import { emailCampaignRecipients } from "@shared/schema";
import { eq } from "drizzle-orm";

const sendgridRouter = Router();

/**
 * @route POST /api/sendgrid/events
 * @description Webhook do SendGrid — recebe eventos de entrega, abertura e erro.
 *   Não exige autenticação JWT; o SendGrid assina com HMAC mas aqui apenas
 *   validamos que o corpo é um array válido.
 * @access Public (SendGrid servers)
 */
sendgridRouter.post("/events", async (req, res) => {
  try {
    const events: any[] = Array.isArray(req.body) ? req.body : [];

    for (const event of events) {
      const messageId: string | undefined = event.sg_message_id?.split(".")[0];
      if (!messageId) continue;

      const eventType: string = event.event ?? "";

      if (eventType === "delivered") {
        await db
          .update(emailCampaignRecipients)
          .set({ status: "delivered" })
          .where(eq(emailCampaignRecipients.messageId, messageId));
      } else if (eventType === "open") {
        await db
          .update(emailCampaignRecipients)
          .set({ status: "opened", openedAt: new Date(event.timestamp * 1000) })
          .where(eq(emailCampaignRecipients.messageId, messageId));
      } else if (eventType === "bounce" || eventType === "blocked") {
        const errMsg = event.reason ?? event.status ?? "Bounce";
        await db
          .update(emailCampaignRecipients)
          .set({ status: "bounced", errorMessage: errMsg })
          .where(eq(emailCampaignRecipients.messageId, messageId));
      } else if (eventType === "dropped" || eventType === "deferred") {
        const errMsg = event.reason ?? eventType;
        await db
          .update(emailCampaignRecipients)
          .set({ status: "failed", errorMessage: errMsg })
          .where(eq(emailCampaignRecipients.messageId, messageId));
      } else if (eventType === "spamreport") {
        await db
          .update(emailCampaignRecipients)
          .set({ status: "bounced", errorMessage: "Marcado como spam" })
          .where(eq(emailCampaignRecipients.messageId, messageId));
      }
    }

    return res.status(200).send("ok");
  } catch (err) {
    console.error("[sendgrid-webhook] erro:", err);
    return res.status(500).send("error");
  }
});

export default sendgridRouter;
