import { db } from "server/db";
import {
  automationDeliveries,
  automationExecutionLog,
  type AutomationRule,
} from "@shared/schema";
import { eq } from "drizzle-orm";
import { sendSms, SmsApiError } from "../integrations/sms";
import { sendEmail, EmailApiError } from "../integrations/email";
import {
  getMessageTemplateById,
  renderTemplate,
} from "./message-templates.service";
import {
  claimAutomationDelivery,
  type AutomationDeliveryChannel,
} from "./automation-delivery.service";

interface DispatchParams {
  rule: AutomationRule;
  clientId: string | null;
  to: { phone?: string | null; email?: string | null };
  variables: Record<string, string | number>;
  eventKey: string;
}

export interface AutomationChannelDispatchResult {
  channel: AutomationDeliveryChannel;
  status: "success" | "failed" | "unknown" | "suppressed";
  deliveryId: string | null;
  providerMessageId: string | null;
  errorMessage: string | null;
}

/**
 * Dispara os canais habilitados de uma regra de automação (SMS e/ou e-mail)
 * para um destinatário, renderizando o template configurado e registrando o
 * resultado (sucesso/falha) no log de execução para auditoria e monitoramento.
 */
export async function dispatchAutomationRule({
  rule,
  clientId,
  to,
  variables,
  eventKey,
}: DispatchParams): Promise<AutomationChannelDispatchResult[]> {
  const results: AutomationChannelDispatchResult[] = [];
  if (rule.smsEnabled && rule.smsTemplateId) {
    results.push(await dispatchChannel({
      rule,
      channel: "sms",
      templateId: rule.smsTemplateId,
      clientId,
      variables,
      eventKey,
      recipient: to.phone,
    }));
  }

  if (rule.emailEnabled && rule.emailTemplateId) {
    results.push(await dispatchChannel({
      rule,
      channel: "email",
      templateId: rule.emailTemplateId,
      clientId,
      variables,
      eventKey,
      recipient: to.email,
    }));
  }
  return results;
}

async function dispatchChannel({
  rule,
  channel,
  templateId,
  clientId,
  variables,
  eventKey,
  recipient,
}: {
  rule: AutomationRule;
  channel: AutomationDeliveryChannel;
  templateId: string;
  clientId: string | null;
  variables: Record<string, string | number>;
  eventKey: string;
  recipient?: string | null;
}): Promise<AutomationChannelDispatchResult> {
  let deliveryId: string | null = null;
  try {
    if (!recipient) {
      throw new Error(
        channel === "sms"
          ? "Cliente sem telefone cadastrado"
          : "Cliente sem e-mail cadastrado",
      );
    }

    const template = await getMessageTemplateById(templateId);
    if (!template || !template.isActive) {
      throw new Error("Template de mensagem não encontrado ou inativo");
    }

    const body = renderTemplate(template.body, variables);

    const claim = await claimAutomationDelivery(db, {
      ruleId: rule.id,
      clientId,
      channel,
      templateId,
      eventKey,
      recipient,
    });
    if (!claim) {
      return {
        channel,
        status: "suppressed",
        deliveryId: null,
        providerMessageId: null,
        errorMessage: null,
      };
    }
    deliveryId = claim.id;

    let externalId: string | null = null;
    if (channel === "sms") {
      const result = await sendSms({ to: recipient, body });
      externalId = result.sid;
    } else {
      const subject = template.subject
        ? renderTemplate(template.subject, variables)
        : "Aviso";
      const result = await sendEmail({ to: recipient, subject, html: body });
      externalId = result.messageId;
    }

    await db.insert(automationExecutionLog).values({
      ruleId: rule.id,
      clientId,
      channel,
      templateId,
      status: "success",
      externalId,
      dedupeKey: `${eventKey}:${channel}`,
    });
    await db
      .update(automationDeliveries)
      .set({
        status: "success",
        providerMessageId: externalId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(automationDeliveries.id, claim.id));
    return {
      channel,
      status: "success",
      deliveryId: claim.id,
      providerMessageId: externalId,
      errorMessage: null,
    };
  } catch (error) {
    const message =
      error instanceof SmsApiError || error instanceof EmailApiError || error instanceof Error
        ? error.message
        : String(error);

    const status =
      error instanceof SmsApiError || error instanceof EmailApiError
        ? error.status === undefined
          ? "unknown"
          : "failed"
        : "failed";

    if (deliveryId) {
      await db
        .update(automationDeliveries)
        .set({
          status,
          errorMessage: message,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(automationDeliveries.id, deliveryId));
    }

    await db.insert(automationExecutionLog).values({
      ruleId: rule.id,
      clientId,
      channel,
      templateId,
      status: "failed",
      errorMessage: message,
      dedupeKey: `${eventKey}:${channel}`,
    });
    return {
      channel,
      status,
      deliveryId,
      providerMessageId: null,
      errorMessage: message,
    };
  }
}

/** Verifica se já existe um envio bem-sucedido registrado para a mesma dedupeKey (evita reenvio duplicado). */
export async function hasSuccessfulDispatch(dedupeKey: string): Promise<boolean> {
  const { eq, and } = await import("drizzle-orm");
  const rows = await db
    .select()
    .from(automationExecutionLog)
    .where(
      and(
        eq(automationExecutionLog.dedupeKey, dedupeKey),
        eq(automationExecutionLog.status, "success"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
