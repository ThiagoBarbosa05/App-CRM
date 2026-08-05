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
