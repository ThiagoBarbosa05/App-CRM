/**
 * Vocabulário único de erros do fluxo de bots e disparos do WhatsApp.
 *
 * Backend e frontend importam daqui. O backend anexa `code` às respostas de
 * erro (mantendo o `message` de sempre, para não quebrar quem ainda lê só ele)
 * e grava o `code` no `error_message` das mensagens de campanha; o frontend
 * resolve o código nesta tabela para exibir uma frase em português com o que
 * aconteceu (`message`) e como resolver (`hint`).
 *
 * Difere de `whatsapp-campaign-reasons.ts` de propósito: lá a classificação é
 * por substring do texto em português, o que quebra a cada ajuste de redação.
 * Aqui a chave é um código estável e o texto é só apresentação.
 */

export type WhatsappErrorCode =
  // enfileiramento / disparo
  | "CAMPAIGN_NOT_FOUND"
  | "CAMPAIGN_WA_DISABLED"
  | "CAMPAIGN_NO_CONTENT"
  | "CAMPAIGN_AMBIGUOUS_CONTENT"
  | "CAMPAIGN_NO_CHANNEL"
  | "CHANNEL_DISCONNECTED"
  | "CHANNEL_NOT_CLOUD_API"
  | "CHANNEL_ACCESS_DENIED"
  | "BOT_INCOMPATIBLE_CHANNEL"
  | "BOT_NO_ENTRY_NODE"
  | "AUDIENCE_EMPTY_ALL_OPTED_OUT"
  | "AUDIENCE_EMPTY_NO_VALID_PHONE"
  | "CAMPAIGN_ALREADY_RUNNING"
  | "CAMPAIGN_ALREADY_FINISHED"
  | "CAMPAIGN_ALL_DUPLICATE"
  | "CAMPAIGN_REQUEUE_BLOCKED"
  // envio por destinatário
  | "SEND_MISSING_PHONE"
  | "SEND_INVALID_PHONE"
  | "SEND_OPTED_OUT"
  | "SEND_BOT_SESSION_ACTIVE"
  | "SEND_BOT_SESSION_GAVE_UP"
  | "SEND_AUDIENCE_DRIFT"
  | "SEND_RATE_LIMITED"
  | "SEND_CHANNEL_OFFLINE"
  | "SEND_CHANNEL_NOT_REGISTERED"
  | "SEND_PROVIDER_REJECTED"
  | "SEND_PROVIDER_UNAVAILABLE"
  | "SEND_CREDENTIALS_MISSING"
  | "SEND_RETRY_SCHEDULED"
  // CRUD de bot
  | "BOT_NOT_FOUND"
  | "BOT_FLOW_INVALID"
  | "BOT_AUTOMATIC_CONFLICT"
  | "TEMPLATE_NOT_FOUND"
  | "UNEXPECTED";

export interface WhatsappErrorInfo {
  /** Frase curta: o que aconteceu. Vai no título do toast / linha da tabela. */
  message: string;
  /** O que o usuário deve fazer. Vai na descrição do toast. */
  hint?: string;
  /** Status HTTP padrão quando este código vira resposta de rota. */
  httpStatus: number;
  /** Onde o usuário corrige — permite escolher o CTA na UI. */
  scope: "campaign" | "bot" | "channel" | "audience" | "contact" | "system";
  /**
   * Falha passageira: vale reenviar sozinho. É a fonte da política de retry
   * (`classifySendError`), para o texto exibido e a decisão de retentar não
   * divergirem — antes eram duas listas separadas mantidas na mão.
   */
  retryable?: boolean;
}

export const WHATSAPP_ERRORS: Record<WhatsappErrorCode, WhatsappErrorInfo> = {
  CAMPAIGN_NOT_FOUND: {
    message: "Campanha não encontrada.",
    hint: "Ela pode ter sido excluída. Atualize a lista de campanhas.",
    httpStatus: 404,
    scope: "campaign",
  },
  CAMPAIGN_WA_DISABLED: {
    message: "Esta campanha não está habilitada para WhatsApp.",
    hint: "Edite a campanha e ative o envio por WhatsApp antes de disparar.",
    httpStatus: 400,
    scope: "campaign",
  },
  CAMPAIGN_NO_CONTENT: {
    message: "A campanha não tem conteúdo para enviar.",
    hint: "Edite a campanha e escolha um template aprovado ou um bot.",
    httpStatus: 400,
    scope: "campaign",
  },
  CAMPAIGN_AMBIGUOUS_CONTENT: {
    message: "A campanha tem template e bot ao mesmo tempo.",
    hint: "Escolha apenas um dos dois na edição da campanha.",
    httpStatus: 400,
    scope: "campaign",
  },
  CAMPAIGN_NO_CHANNEL: {
    message: "A campanha não tem um canal de envio selecionado.",
    hint: "Edite a campanha e escolha por qual número o disparo deve sair.",
    httpStatus: 400,
    scope: "campaign",
  },
  CHANNEL_DISCONNECTED: {
    message: "O canal de WhatsApp desta campanha está desconectado.",
    hint: "Abra WhatsApp › Canais, reconecte o número e dispare novamente.",
    httpStatus: 400,
    scope: "channel",
  },
  CHANNEL_NOT_CLOUD_API: {
    message: "Campanhas com template só funcionam em canais Cloud API.",
    hint: "Troque o canal por um Cloud API conectado, ou use um bot no lugar do template.",
    httpStatus: 400,
    scope: "campaign",
  },
  CHANNEL_ACCESS_DENIED: {
    message: "Você não tem acesso ao canal selecionado.",
    hint: "Peça a um administrador para liberar o canal ou escolha outro.",
    httpStatus: 403,
    scope: "channel",
  },
  BOT_INCOMPATIBLE_CHANNEL: {
    message: "O bot não é compatível com o canal selecionado.",
    hint: "Veja os pontos apontados abaixo, ajuste o fluxo do bot ou troque o canal.",
    httpStatus: 400,
    scope: "bot",
  },
  BOT_NO_ENTRY_NODE: {
    message: "O bot não tem um nó inicial configurado.",
    hint: "Abra o editor do bot e marque por qual nó o fluxo começa.",
    httpStatus: 400,
    scope: "bot",
  },
  AUDIENCE_EMPTY_ALL_OPTED_OUT: {
    message: "Todos os contatos selecionados optaram por não receber campanhas.",
    hint: "Escolha outro público ou remova o filtro de etiquetas.",
    httpStatus: 400,
    scope: "audience",
  },
  AUDIENCE_EMPTY_NO_VALID_PHONE: {
    message: "Nenhum dos contatos selecionados tem telefone válido.",
    hint: "Confira o cadastro dos clientes: o número precisa ter DDD e estar completo.",
    httpStatus: 400,
    scope: "audience",
  },
  CAMPAIGN_ALREADY_RUNNING: {
    message: "Esta campanha já está em andamento.",
    hint: "Use pausar, retomar ou cancelar na tela da campanha em vez de disparar de novo.",
    httpStatus: 409,
    scope: "campaign",
  },
  CAMPAIGN_ALREADY_FINISHED: {
    message: "Esta campanha já foi finalizada.",
    hint: 'Para reenviar apenas quem falhou, use "Reenviar falhas" na tela da campanha.',
    httpStatus: 409,
    scope: "campaign",
  },
  CAMPAIGN_ALL_DUPLICATE: {
    message:
      "Todos os contatos selecionados já receberam esta mensagem recentemente. Nenhuma mensagem foi enviada.",
    hint: "A proteção contra duplicidade bloqueou o envio. Aguarde a janela terminar ou escolha outro público.",
    httpStatus: 409,
    scope: "audience",
  },
  CAMPAIGN_REQUEUE_BLOCKED: {
    message: "Esta campanha não pode ser reprocessada no estado atual.",
    hint: "Só campanhas concluídas, com falha ou em andamento aceitam reenvio de falhas.",
    httpStatus: 409,
    scope: "campaign",
  },

  SEND_MISSING_PHONE: {
    message: "Contato sem telefone cadastrado.",
    hint: "Adicione um número no cadastro do cliente e reenvie.",
    httpStatus: 400,
    scope: "contact",
  },
  SEND_INVALID_PHONE: {
    message: "O telefone do contato é inválido.",
    hint: "Confira DDD e quantidade de dígitos no cadastro do cliente.",
    httpStatus: 400,
    scope: "contact",
  },
  SEND_OPTED_OUT: {
    message: "O contato optou por não receber mensagens de marketing.",
    hint: "Nada a fazer: o envio foi bloqueado por opt-out.",
    httpStatus: 409,
    scope: "contact",
  },
  SEND_BOT_SESSION_ACTIVE: {
    message: "O contato já está em uma conversa com um bot.",
    hint: "O envio será tentado de novo automaticamente quando a conversa terminar.",
    httpStatus: 409,
    scope: "contact",
  },
  SEND_BOT_SESSION_GAVE_UP: {
    message: "O contato ficou em conversa com um bot durante todas as tentativas.",
    hint: "Encerre a conversa em aberto do contato e use “Reenviar falhas”.",
    httpStatus: 409,
    scope: "contact",
  },
  SEND_AUDIENCE_DRIFT: {
    message: "O contato deixou de corresponder ao público da campanha.",
    hint: "As etiquetas ou os dados do cliente mudaram depois do agendamento.",
    httpStatus: 409,
    scope: "audience",
  },
  SEND_RATE_LIMITED: {
    message: "O WhatsApp limitou a velocidade de envio.",
    hint: "As mensagens serão reenviadas automaticamente. Nada precisa ser feito.",
    httpStatus: 429,
    scope: "system",
    retryable: true,
  },
  SEND_CHANNEL_OFFLINE: {
    message: "O canal de envio ficou offline.",
    hint: "Verifique a conexão do número em WhatsApp › Canais. O envio é retomado sozinho quando ele voltar.",
    httpStatus: 503,
    scope: "channel",
    retryable: true,
  },
  SEND_CHANNEL_NOT_REGISTERED: {
    message: "O canal de envio não está registrado no gateway.",
    hint: "Abra WhatsApp › Canais e reconecte o número — reenviar sem isso não resolve.",
    httpStatus: 404,
    scope: "channel",
  },
  SEND_PROVIDER_REJECTED: {
    message: "O WhatsApp recusou esta mensagem.",
    hint: "Verifique se o número existe no WhatsApp e se o template continua aprovado.",
    httpStatus: 502,
    scope: "contact",
  },
  SEND_PROVIDER_UNAVAILABLE: {
    message: "O WhatsApp está indisponível no momento.",
    hint: "É uma falha temporária do provedor. O reenvio é automático.",
    httpStatus: 503,
    scope: "system",
    retryable: true,
  },
  SEND_CREDENTIALS_MISSING: {
    message: "O canal de envio está sem credenciais configuradas.",
    hint: "Abra WhatsApp › Canais e complete a configuração do número antes de disparar.",
    httpStatus: 400,
    scope: "channel",
  },
  SEND_RETRY_SCHEDULED: {
    message: "Falha temporária no envio — nova tentativa agendada.",
    hint: "Nada precisa ser feito: o sistema tenta novamente sozinho.",
    httpStatus: 503,
    scope: "system",
  },

  BOT_NOT_FOUND: {
    message: "Bot não encontrado.",
    hint: "Ele pode ter sido excluído. Atualize a lista de bots.",
    httpStatus: 404,
    scope: "bot",
  },
  BOT_FLOW_INVALID: {
    message: "O fluxo do bot tem problemas que impedem o uso.",
    hint: "Abra o editor do bot e corrija os pontos indicados.",
    httpStatus: 400,
    scope: "bot",
  },
  BOT_AUTOMATIC_CONFLICT: {
    message: "Já existe outro bot automático ativo para este canal.",
    hint: "Desative o bot automático atual antes de ativar este.",
    httpStatus: 409,
    scope: "bot",
  },
  TEMPLATE_NOT_FOUND: {
    message: "O template da campanha não existe mais.",
    hint: "Edite a campanha e escolha um template aprovado.",
    httpStatus: 404,
    scope: "campaign",
  },
  UNEXPECTED: {
    message: "Não foi possível concluir a operação.",
    hint: "Tente novamente em instantes. Se persistir, acione o suporte.",
    httpStatus: 500,
    scope: "system",
  },
};

export function isWhatsappErrorCode(value: unknown): value is WhatsappErrorCode {
  return typeof value === "string" && value in WHATSAPP_ERRORS;
}

/** Informação de apresentação do código, ou `null` se não for um código conhecido. */
export function whatsappErrorInfo(value: unknown): WhatsappErrorInfo | null {
  return isWhatsappErrorCode(value) ? WHATSAPP_ERRORS[value] : null;
}

/** Vale reagendar? Códigos desconhecidos são tratados como permanentes. */
export function isRetryableCode(value: unknown): boolean {
  return whatsappErrorInfo(value)?.retryable === true;
}

/**
 * Envelope gravado em `whatsapp_campaign_messages.error_message`.
 *
 * Antes essa coluna guardava o texto cru do provedor (JSON da Meta, erro do
 * gateway) e ele ia direto para a tela. Agora o motivo vira código e o texto
 * cru fica em `detail`, exibido só dentro de "Ver detalhe técnico".
 */
export interface CampaignMessageError {
  code: WhatsappErrorCode;
  attempt?: number;
  maxAttempts?: number;
  /** Texto cru do provedor — nunca no resumo, só no detalhe técnico. */
  detail?: string;
}

const ENVELOPE_MARKER = "__waerr";

export function encodeCampaignMessageError(error: CampaignMessageError): string {
  return JSON.stringify({ [ENVELOPE_MARKER]: 1, ...error });
}

export interface DecodedCampaignMessageError {
  /** Apresentação do código, ou `null` para linhas legadas em texto puro. */
  info: WhatsappErrorInfo | null;
  /** Texto técnico: o `detail` do envelope, ou a linha legada inteira. */
  detail: string | null;
  attempt?: number;
  maxAttempts?: number;
}

const EMPTY_DECODED: DecodedCampaignMessageError = { info: null, detail: null };

/**
 * Lê o `error_message`. Aceita o envelope novo e o texto legado, e nunca lança
 * — a coluna tem anos de linhas gravadas em formato livre.
 */
export function decodeCampaignMessageError(
  raw: string | null | undefined,
): DecodedCampaignMessageError {
  if (!raw || !raw.trim()) return EMPTY_DECODED;

  if (!raw.trimStart().startsWith("{")) {
    return { info: null, detail: raw };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !(ENVELOPE_MARKER in parsed)
    ) {
      // JSON, mas não é nosso envelope: é o corpo cru do provedor (legado).
      return { info: null, detail: raw };
    }

    const envelope = parsed as Record<string, unknown>;
    const info = whatsappErrorInfo(envelope.code);
    if (!info) return { info: null, detail: raw };

    return {
      info,
      detail: typeof envelope.detail === "string" ? envelope.detail : null,
      attempt:
        typeof envelope.attempt === "number" ? envelope.attempt : undefined,
      maxAttempts:
        typeof envelope.maxAttempts === "number"
          ? envelope.maxAttempts
          : undefined,
    };
  } catch {
    return { info: null, detail: raw };
  }
}
