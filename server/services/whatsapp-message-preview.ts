export interface TemplateParameter {
  type: string;
  parameter_name?: string;
  text?: string;
  image?: { link?: string };
  video?: { link?: string };
  document?: { link?: string };
}

export interface SentTemplateComponent {
  type: string;
  parameters?: TemplateParameter[];
}

interface MetaTemplateButton {
  type?: string;
  text?: string;
}

interface MetaTemplateComponent {
  type?: string;
  text?: string;
  buttons?: MetaTemplateButton[];
}

export interface TemplateMessagePayload {
  kind: "campaign_template" | "bot_template" | "conversation_template";
  templateName: string;
  language: string;
  components: SentTemplateComponent[];
  buttons: Array<{ type: string; text: string }>;
  campaignId?: string;
  campaignName?: string;
}

interface BuildTemplateMessageSnapshotInput {
  templateName: string;
  language: string;
  kind?: TemplateMessagePayload["kind"];
  campaign?: { id: string; name: string };
  templateComponents: unknown[];
  sentComponents: object[];
}

function replaceTemplateVariables(
  body: string,
  parameters: TemplateParameter[],
): string {
  const namedValues = new Map<string, string>();
  const positionalValues: string[] = [];

  for (const parameter of parameters) {
    if (parameter.type !== "text" || parameter.text == null) continue;
    positionalValues.push(parameter.text);
    if (parameter.parameter_name) {
      namedValues.set(parameter.parameter_name, parameter.text);
    }
  }

  let placeholderIndex = 0;
  return body.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (placeholder, key: string) => {
    const normalizedKey = key.trim();
    const namedValue = namedValues.get(normalizedKey);
    if (namedValue != null) {
      placeholderIndex++;
      return namedValue;
    }

    const position = Number(normalizedKey);
    if (Number.isInteger(position) && position > 0) {
      placeholderIndex++;
      return positionalValues[position - 1] ?? placeholder;
    }
    return positionalValues[placeholderIndex++] ?? placeholder;
  });
}

export function buildTemplateMessageSnapshot(
  input: BuildTemplateMessageSnapshotInput,
): { content: string; rawPayload: TemplateMessagePayload } {
  const templateComponents = input.templateComponents as MetaTemplateComponent[];
  const sentComponents = input.sentComponents as SentTemplateComponent[];
  const bodyComponent = templateComponents.find(
    (component) => component.type?.toUpperCase() === "BODY",
  );
  const sentBody = sentComponents.find(
    (component) => component.type.toLowerCase() === "body",
  );
  const content = bodyComponent?.text
    ? replaceTemplateVariables(bodyComponent.text, sentBody?.parameters ?? [])
    : `Template: ${input.templateName}`;

  const buttonsComponent = templateComponents.find(
    (component) => component.type?.toUpperCase() === "BUTTONS",
  );
  const buttons = (buttonsComponent?.buttons ?? []).flatMap((button) =>
    button.type && button.text
      ? [{ type: button.type, text: button.text }]
      : [],
  );

  return {
    content,
    rawPayload: {
      kind: input.kind ?? "campaign_template",
      templateName: input.templateName,
      language: input.language,
      components: sentComponents,
      buttons,
      ...(input.campaign
        ? {
            campaignId: input.campaign.id,
            campaignName: input.campaign.name,
          }
        : {}),
    },
  };
}

export function truncateBotPreview(
  content: string | null | undefined,
  maxLength = 160,
): string | null {
  const normalized = content?.trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;

  const candidate = normalized.slice(0, Math.max(1, maxLength - 1)).trimEnd();
  const lastSpace = candidate.lastIndexOf(" ");
  const truncated = lastSpace > 0 ? candidate.slice(0, lastSpace) : candidate;
  return `${truncated}…`;
}

export function describeBotMessagePreview(message: {
  type: string;
  content?: string | null;
  caption?: string | null;
}): string | null {
  const visibleText = message.content?.trim() || message.caption?.trim();
  if (visibleText) return visibleText;

  switch (message.type) {
    case "image":
      return "Imagem enviada";
    case "video":
      return "Vídeo enviado";
    case "document":
      return "Documento enviado";
    case "sticker":
      return "Figurinha enviada";
    default:
      return null;
  }
}

const BOT_PREVIEW_MESSAGE_ID_KEY = "__crmBotPreviewMessageId";

export function setBotPreviewMessageId(
  sessionData: Record<string, string>,
  messageId: string,
): Record<string, string> {
  return { ...sessionData, [BOT_PREVIEW_MESSAGE_ID_KEY]: messageId };
}

export function getBotPreviewMessageId(
  sessionData: Record<string, string> | null | undefined,
): string | null {
  return sessionData?.[BOT_PREVIEW_MESSAGE_ID_KEY]?.trim() || null;
}
