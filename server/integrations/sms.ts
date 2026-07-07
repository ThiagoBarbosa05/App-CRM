import twilio from "twilio";
import { getTwilioConfig, toE164Brazil } from "../lib/twilio-config";

export class SmsApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "SmsApiError";
  }
}

export async function sendSms({
  to,
  body,
}: {
  to: string;
  body: string;
}): Promise<{ sid: string }> {
  const { accountSid, authToken, fromNumber } = await getTwilioConfig();
  if (!accountSid || !authToken || !fromNumber) {
    throw new SmsApiError(
      "Twilio não configurado: defina twilio_account_sid, twilio_auth_token e twilio_from_number",
    );
  }

  const client = twilio(accountSid, authToken);

  try {
    const message = await client.messages.create({
      to: toE164Brazil(to),
      from: fromNumber,
      body,
    });
    return { sid: message.sid };
  } catch (err: any) {
    const status = typeof err?.status === "number" ? err.status : undefined;
    const message = err instanceof Error ? err.message : String(err);
    throw new SmsApiError(message, status);
  }
}
