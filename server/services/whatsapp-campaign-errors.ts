/**
 * Erro de configuração de campanha (ex: campanha sem template nem bot
 * associado). Distingue esse tipo de falha "estrutural" — que não vai se
 * resolver sozinha em um próximo tick e não deveria logar stack trace como
 * ruído no dispatcher — de outros erros transitórios (rede, banco, etc).
 */
export class CampaignConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignConfigError";
  }
}

/**
 * Sinaliza que `requeueFailedMessages` foi chamada para uma campanha cujo
 * status atual não permite reprocessamento (ex: `cancelled`, ou qualquer
 * outro status fora de completed/failed/in_progress). A transação inteira é
 * revertida antes de lançar este erro — nenhum UPDATE de mensagens/impacts
 * sobrevive. O endpoint HTTP mapeia isso para 409.
 */
export class CampaignRequeueBlockedError extends Error {
  constructor(
    message: string,
    public readonly campaignStatus: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CampaignRequeueBlockedError";
  }
}
