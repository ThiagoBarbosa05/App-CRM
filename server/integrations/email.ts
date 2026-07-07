import sgMail from "@sendgrid/mail";
import { getSendGridConfig } from "../lib/sendgrid-config";

export class EmailApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "EmailApiError";
  }
}

let configuredApiKey: string | null = null;

async function ensureConfigured(): Promise<{ fromEmail: string; fromName: string }> {
  const { apiKey, fromEmail, fromName } = await getSendGridConfig();
  if (!apiKey || !fromEmail) {
    throw new EmailApiError(
      "SendGrid não configurado: defina sendgrid_api_key e sendgrid_from_email",
    );
  }
  if (configuredApiKey !== apiKey) {
    sgMail.setApiKey(apiKey);
    configuredApiKey = apiKey;
  }
  return { fromEmail, fromName };
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId: string | null }> {
  const { fromEmail, fromName } = await ensureConfigured();

  try {
    const [response] = await sgMail.send({
      to,
      from: { email: fromEmail, name: fromName },
      subject,
      html,
    });
    return { messageId: (response.headers["x-message-id"] as string) ?? null };
  } catch (err: any) {
    const status = err?.code ?? err?.response?.statusCode;
    const message =
      err?.response?.body?.errors?.map((e: any) => e.message).join("; ") ??
      (err instanceof Error ? err.message : String(err));
    throw new EmailApiError(message, status);
  }
}
