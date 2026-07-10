import { db } from "server/db";
import { automationExecutionLog, type AutomationRule } from "@shared/schema";
import { sendSms, SmsApiError } from "../integrations/sms";
import { sendEmail, EmailApiError } from "../integrations/email";
import {
  getMessageTemplateById,
  renderTemplate,
} from "./message-templates.service";

interface DispatchParams {
  rule: AutomationRule;
  clientId: string | null;
  to: { phone?: string | null; email?: string | null };
  variables: Record<string, string | number>;
  dedupeKey?: string;
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
  dedupeKey,
}: DispatchParams): Promise<void> {
  if (rule.smsEnabled && rule.smsTemplateId) {
    await dispatchChannel({
      rule,
      channel: "sms",
      templateId: rule.smsTemplateId,
      clientId,
      variables,
      dedupeKey,
      recipient: to.phone,
    });
  }

  if (rule.emailEnabled && rule.emailTemplateId) {
    await dispatchChannel({
      rule,
      channel: "email",
      templateId: rule.emailTemplateId,
      clientId,
      variables,
      dedupeKey,
      recipient: to.email,
    });
  }
}

async function dispatchChannel({
  rule,
  channel,
  templateId,
  clientId,
  variables,
  dedupeKey,
  recipient,
}: {
  rule: AutomationRule;
  channel: "sms" | "email";
  templateId: string;
  clientId: string | null;
  variables: Record<string, string | number>;
  dedupeKey?: string;
  recipient?: string | null;
}): Promise<void> {
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
      dedupeKey,
    });
  } catch (error) {
    const message =
      error instanceof SmsApiError || error instanceof EmailApiError || error instanceof Error
        ? error.message
        : String(error);

    await db.insert(automationExecutionLog).values({
      ruleId: rule.id,
      clientId,
      channel,
      templateId,
      status: "failed",
      errorMessage: message,
      dedupeKey,
    });
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
