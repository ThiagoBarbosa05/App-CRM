import { Router, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { whatsappCampaignMessages, whatsappFlows, whatsappMessages } from "@shared/schema";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";
import { upsertWhatsappSetting } from "../services/whatsapp-settings.service";
import { handleIncomingMessage as runBotEngine, handleFlowResponse } from "../services/whatsapp-bot-engine.service";
import { saveInboundMessage } from "../services/whatsapp-conversations.service";
import { getChannelByPhoneNumberId } from "../services/whatsapp-channels.service";
import { logAccountEvent } from "../services/whatsapp-account-events.service";
import {
  updateTemplateMetaStatus,
  updateTemplateQualityScore,
} from "../services/whatsapp-templates.service";

const router = Router();

// Ordem das transições de status (não permite regredir: read não volta a delivered).
const STATUS_RANK: Record<string, number> = {
  scheduled: 0,
  sent: 1,
  delivered: 2,
  read: 3,
};

// GET — verificação inicial do webhook pelo Meta
router.get("/webhook", async (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const raw = await getWhatsappSettingsRaw();
  const verifyToken = raw["wa_webhook_verify_token"];

  if (mode === "subscribe" && token === verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// POST — receber notificações de status e mensagens
router.post("/webhook", (req: Request, res: Response) => {
  const body = req.body;

  if (body.object !== "whatsapp_business_account") {
    res.sendStatus(404);
    return;
  }

  for (const entry of body.entry ?? []) {
    const wabaId = entry.id as string | undefined;

    for (const change of entry.changes ?? []) {
      const field = change.field as string;
      const value = change.value;

      switch (field) {
        case "messages":
          for (const status of value.statuses ?? []) {
            handleMessageStatus(status).catch((err) =>
              console.error("[WA Webhook] Erro ao processar status:", err),
            );
          }
          for (const message of value.messages ?? []) {
            handleIncomingMessage(message, value.metadata).catch((err) =>
              console.error("[WA Webhook] Erro ao processar mensagem:", err),
            );
          }
          break;

        // ── Alta prioridade ─────────────────────────────────────────────────────
        case "message_template_status_update":
          handleTemplateStatusUpdate(value).catch((err) =>
            console.error("[WA Webhook] Erro em message_template_status_update:", err),
          );
          break;

        case "message_template_quality_update":
          handleTemplateQualityUpdate(value).catch((err) =>
            console.error("[WA Webhook] Erro em message_template_quality_update:", err),
          );
          break;

        case "account_alerts":
          handleAccountAlert(value, wabaId).catch((err) =>
            console.error("[WA Webhook] Erro em account_alerts:", err),
          );
          break;

        case "account_update":
          handleAccountUpdate(value, wabaId).catch((err) =>
            console.error("[WA Webhook] Erro em account_update:", err),
          );
          break;

        // ── Média prioridade ────────────────────────────────────────────────────
        case "phone_number_quality_update":
          handlePhoneNumberQualityUpdate(value).catch((err) =>
            console.error("[WA Webhook] Erro em phone_number_quality_update:", err),
          );
          break;

        case "message_template_components_update":
          handleTemplateComponentsUpdate(value).catch((err) =>
            console.error("[WA Webhook] Erro em message_template_components_update:", err),
          );
          break;

        case "account_review_update":
          handleAccountReviewUpdate(value, wabaId).catch((err) =>
            console.error("[WA Webhook] Erro em account_review_update:", err),
          );
          break;

        // ── Baixa prioridade ────────────────────────────────────────────────────
        case "phone_number_name_update":
          handlePhoneNumberNameUpdate(value, wabaId).catch((err) =>
            console.error("[WA Webhook] Erro em phone_number_name_update:", err),
          );
          break;

        case "account_settings_update":
          handleAccountSettingsUpdate(value, wabaId).catch((err) =>
            console.error("[WA Webhook] Erro em account_settings_update:", err),
          );
          break;

        case "flows":
          handleFlowStatusUpdate(value).catch((err) =>
            console.error("[WA Webhook] Erro em flows:", err),
          );
          break;

        default:
          console.info(`[WA Webhook] Campo não tratado recebido: ${field}`);
      }
    }
  }

  res.sendStatus(200);
});

// ── Handler: messages (status de entrega) ──────────────────────────────────────

async function handleMessageStatus(status: {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  recipient_id: string;
  timestamp: string;
  errors?: Array<{ title?: string; message?: string; code?: number }>;
}) {
  console.log(`[WA Webhook] Mensagem ${status.id} → ${status.status}`);

  const now = new Date();

  await updateCampaignMessageStatus(status, now).catch((err) =>
    console.error("[WA Webhook] Erro ao atualizar status de campanha:", err),
  );

  await db
    .update(whatsappMessages)
    .set({ status: status.status })
    .where(eq(whatsappMessages.waMessageId, status.id))
    .catch((err) =>
      console.error("[WA Webhook] Erro ao atualizar status de conversa:", err),
    );
}

async function updateCampaignMessageStatus(
  status: {
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    errors?: Array<{ title?: string; message?: string; code?: number }>;
  },
  now: Date,
): Promise<void> {
  const [msg] = await db
    .select()
    .from(whatsappCampaignMessages)
    .where(eq(whatsappCampaignMessages.messageId, status.id))
    .limit(1);

  if (!msg) return;

  if (msg.status === "failed" || msg.status === "cancelled") return;

  if (status.status === "failed") {
    const err = status.errors?.[0];
    const errorMessage =
      err?.message || err?.title || "Falha reportada pela Meta";
    await db
      .update(whatsappCampaignMessages)
      .set({ status: "failed", errorMessage, updatedAt: now })
      .where(eq(whatsappCampaignMessages.id, msg.id));
    return;
  }

  const currentRank = STATUS_RANK[msg.status] ?? 0;
  const nextRank = STATUS_RANK[status.status] ?? 0;
  if (nextRank <= currentRank) return;

  await db
    .update(whatsappCampaignMessages)
    .set({
      status: status.status,
      ...(status.status === "delivered" ? { deliveredAt: now } : {}),
      ...(status.status === "read" ? { readAt: now } : {}),
      updatedAt: now,
    })
    .where(eq(whatsappCampaignMessages.id, msg.id));
}

// ── Handler: messages (mensagens recebidas) ────────────────────────────────────

type IncomingMessage = {
  from: string;
  type: string;
  id: string;
  timestamp?: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256?: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string; sha256?: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
  sticker?: { id: string; mime_type: string };
  interactive?: { type: string; nfm_reply?: { response_json: string; name: string; body: string } };
};

async function handleIncomingMessage(
  message: IncomingMessage,
  metadata: {
    phone_number_id: string;
    display_phone_number: string;
  },
) {
  const text = message.text?.body ?? "";
  const mediaObj = message.image ?? message.audio ?? message.video ?? message.document ?? message.sticker;

  console.log(
    `[WA Webhook] Mensagem recebida de ${message.from} (${metadata.display_phone_number}): ${text || `[${message.type}]`}`,
  );

  const channel = await getChannelByPhoneNumberId(metadata.phone_number_id).catch(() => null);

  await saveInboundMessage({
    phone: message.from,
    content: text || null,
    type: message.type,
    waMessageId: message.id,
    timestamp: message.timestamp,
    caption: (message.image?.caption ?? message.video?.caption ?? message.document?.caption) || undefined,
    rawPayload: message,
    channelId: channel?.id ?? null,
    mediaData: mediaObj
      ? {
          whatsappMediaId: mediaObj.id,
          mimeType: mediaObj.mime_type,
          filename: message.document?.filename,
        }
      : undefined,
  }).catch((err) => console.error("[WA Webhook] Erro ao salvar mensagem:", err));

  if (message.type === "text" && text) {
    await runBotEngine(message.from, text);
  }

  if (message.type === "interactive" && message.interactive?.type === "nfm_reply") {
    const nfmReply = message.interactive.nfm_reply;
    if (nfmReply?.response_json) {
      try {
        const responseJson = JSON.parse(nfmReply.response_json) as Record<string, unknown>;
        await handleFlowResponse(message.from, responseJson);
      } catch (err) {
        console.error("[WA Webhook] Erro ao processar resposta de Flow:", err);
      }
    }
  }
}

// ── Alta prioridade ────────────────────────────────────────────────────────────

async function handleTemplateStatusUpdate(value: {
  message_template_id?: number;
  message_template_name?: string;
  message_template_language?: string;
  event?: string;
}) {
  const name = value.message_template_name;
  const event = value.event;
  if (!name || !event) return;

  console.log(`[WA Webhook] Template "${name}" → status: ${event}`);
  await updateTemplateMetaStatus(name, event, value.message_template_id);
}

async function handleTemplateQualityUpdate(value: {
  message_template_id?: number;
  message_template_name?: string;
  message_template_language?: string;
  previous_quality_score?: string;
  new_quality_score?: string;
}) {
  const name = value.message_template_name;
  const score = value.new_quality_score;
  if (!name || !score) return;

  console.log(
    `[WA Webhook] Template "${name}" quality: ${value.previous_quality_score} → ${score}`,
  );
  await updateTemplateQualityScore(name, score);
}

async function handleAccountAlert(value: unknown, wabaId: string | undefined) {
  const v = value as {
    entity_type?: string;
    entity_id?: string;
    alert_info?: {
      alert_severity?: string;
      alert_status?: string;
      alert_type?: string;
      alert_description?: string;
    };
  };

  const severity = v.alert_info?.alert_severity;
  const alertType = v.alert_info?.alert_type ?? "UNKNOWN";

  if (severity === "CRITICAL") {
    console.error(`[WA Webhook] CRITICAL account alert (${alertType}):`, value);
  } else if (severity === "HIGH") {
    console.warn(`[WA Webhook] HIGH account alert (${alertType}):`, value);
  } else {
    console.info(`[WA Webhook] Account alert (${alertType}):`, value);
  }

  await logAccountEvent("account_alerts", alertType, { wabaId, ...v }, severity);
}

async function handleAccountUpdate(value: unknown, wabaId: string | undefined) {
  const v = value as {
    phone_number?: string;
    event?: string;
    violation_info?: { violation_type?: string };
  };

  const event = v.event ?? "UNKNOWN";

  if (event === "ACCOUNT_VIOLATION") {
    console.error(
      `[WA Webhook] ACCOUNT_VIOLATION detectada — tipo: ${v.violation_info?.violation_type}`,
      value,
    );
  } else {
    console.info(`[WA Webhook] Account update (${event}):`, value);
  }

  await logAccountEvent("account_update", event, { wabaId, ...v });
}

// ── Média prioridade ───────────────────────────────────────────────────────────

async function handlePhoneNumberQualityUpdate(value: {
  display_phone_number?: string;
  event?: string;
  current_limit?: string;
  max_daily_conversations_per_business?: string;
}) {
  const tier = value.max_daily_conversations_per_business ?? value.current_limit;
  if (!tier) return;

  console.info(
    `[WA Webhook] Throughput tier atualizado: ${tier} (evento: ${value.event}, número: ${value.display_phone_number})`,
  );
  await upsertWhatsappSetting("wa_throughput_tier", tier);
}

async function handleTemplateComponentsUpdate(value: unknown) {
  const v = value as {
    message_template_id?: number;
    message_template_name?: string;
    message_template_language?: string;
  };

  console.warn(
    `[WA Webhook] Template "${v.message_template_name}" foi modificado pela Meta. Considere re-sincronizar.`,
  );
  await logAccountEvent("message_template_components_update", "TEMPLATE_MODIFIED", v);
}

async function handleAccountReviewUpdate(value: unknown, wabaId: string | undefined) {
  const v = value as { decision?: string };
  const decision = v.decision ?? "UNKNOWN";

  console.info(`[WA Webhook] Account review update: ${decision} (WABA: ${wabaId})`);
  await logAccountEvent("account_review_update", decision, { wabaId, ...v });
}

// ── Baixa prioridade ───────────────────────────────────────────────────────────

async function handlePhoneNumberNameUpdate(value: unknown, wabaId: string | undefined) {
  const v = value as {
    display_phone_number?: string;
    decision?: string;
    requested_verified_name?: string;
    rejection_reason?: string | null;
  };

  if (v.decision === "REJECTED") {
    console.warn(
      `[WA Webhook] Nome de exibição rejeitado — motivo: ${v.rejection_reason ?? "não informado"}`,
    );
  } else {
    console.info(`[WA Webhook] Nome de exibição: ${v.decision} ("${v.requested_verified_name}")`);
  }

  await logAccountEvent("phone_number_name_update", v.decision ?? "UNKNOWN", { wabaId, ...v });
}

async function handleAccountSettingsUpdate(value: unknown, wabaId: string | undefined) {
  console.info("[WA Webhook] Account settings update:", value);
  await logAccountEvent("account_settings_update", "SETTINGS_CHANGED", { wabaId, ...(value as object) });
}

async function handleFlowStatusUpdate(value: unknown) {
  const v = value as { flow_id?: string; event?: string };
  if (!v.flow_id || !v.event) return;

  console.info(`[WA Webhook] Flow ${v.flow_id} → ${v.event}`);

  const validStatuses = ["DRAFT", "PUBLISHED", "DEPRECATED", "BLOCKED"] as const;
  const newStatus = v.event as (typeof validStatuses)[number];

  if (!validStatuses.includes(newStatus)) {
    console.warn(`[WA Webhook] Status de flow desconhecido: ${v.event}`);
    return;
  }

  await db
    .update(whatsappFlows)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(whatsappFlows.metaFlowId, v.flow_id));
}

export default router;
