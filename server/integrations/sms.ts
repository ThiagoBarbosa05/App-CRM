import twilio from "twilio";
import { getTwilioConfig, toE164Brazil } from "../lib/twilio-config";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export class SmsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SmsApiError";
  }
}

async function getSmsFromNumber(fallback: string): Promise<string> {
  try {
    const [row] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "marketing_sms_from_number"));
    return row?.value?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function sendSms({
  to,
  body,
  statusCallback,
}: {
  to: string;
  body: string;
  statusCallback?: string;
}): Promise<{ sid: string }> {
  const { accountSid, authToken, fromNumber: voiceFromNumber } = await getTwilioConfig();
  if (!accountSid || !authToken) {
    throw new SmsApiError(
      "Twilio não configurado: defina twilio_account_sid e twilio_auth_token",
    );
  }

  const fromNumber = await getSmsFromNumber(voiceFromNumber);
  if (!fromNumber) {
    throw new SmsApiError(
      "Número de SMS não configurado. Acesse Marketing > Configurações e defina o número Twilio com SMS habilitado.",
    );
  }

  const client = twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      to: toE164Brazil(to),
      from: fromNumber,
      body,
      ...(statusCallback ? { statusCallback, statusCallbackMethod: "POST" } : {}),
    });
    return { sid: message.sid };
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    throw new SmsApiError(message, status);
  }
}
