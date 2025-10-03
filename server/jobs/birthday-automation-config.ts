/**
 * Configurações para o sistema de automação de aniversários
 */

export type DuplicationStrategy =
  | "per_automation" // Permite múltiplas automações para o mesmo cliente
  | "per_day" // Previne múltiplas mensagens no mesmo dia (recomendado)
  | "per_template"; // Previne múltiplos envios do mesmo template

export interface BirthdayAutomationConfig {
  /**
   * Estratégia para prevenção de duplicatas
   *
   * - per_automation: Cada automação pode rodar independentemente (comportamento original)
   *   Permite: Cliente recebe "3 dias antes" + "no dia" com templates diferentes
   *
   * - per_day: Previne múltiplas mensagens no mesmo dia (RECOMENDADO)
   *   Impede: Duas automações diferentes rodarem no mesmo dia
   *   Permite: "3 dias antes" em um dia + "no dia" em outro dia
   *
   * - per_template: Previne múltiplos envios do mesmo template no ano
   *   Impede: Mesmo template ser enviado mais de uma vez por cliente/ano
   */
  duplicationStrategy: DuplicationStrategy;

  /**
   * Configurações de retry para falhas na integração
   */
  retryConfig: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
  };

  /**
   * Configurações de logging
   */
  logging: {
    verboseMode: boolean;
    logSuccessfulSends: boolean;
    logDuplicateAttempts: boolean;
  };
}

/**
 * Configuração padrão do sistema
 */
export const DEFAULT_BIRTHDAY_CONFIG: BirthdayAutomationConfig = {
  duplicationStrategy: "per_day", // MUDANÇA: agora previne duplicatas por dia

  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1000, // 1 segundo
    maxDelayMs: 10000, // 10 segundos
  },

  logging: {
    verboseMode: true,
    logSuccessfulSends: true,
    logDuplicateAttempts: true,
  },
};

/**
 * Configuração para desenvolvimento/teste
 */
export const DEVELOPMENT_BIRTHDAY_CONFIG: BirthdayAutomationConfig = {
  ...DEFAULT_BIRTHDAY_CONFIG,

  duplicationStrategy: "per_automation", // Permite múltiplas para teste

  retryConfig: {
    maxRetries: 1, // Menos tentativas em dev
    baseDelayMs: 500,
    maxDelayMs: 2000,
  },

  logging: {
    verboseMode: true,
    logSuccessfulSends: true,
    logDuplicateAttempts: true,
  },
};

/**
 * Configuração para produção
 */
export const PRODUCTION_BIRTHDAY_CONFIG: BirthdayAutomationConfig = {
  ...DEFAULT_BIRTHDAY_CONFIG,

  duplicationStrategy: "per_day", // Prevenção rigorosa em produção

  logging: {
    verboseMode: false, // Menos logs em produção
    logSuccessfulSends: true,
    logDuplicateAttempts: true,
  },
};

/**
 * Função para obter a configuração baseada no ambiente
 */
export function getBirthdayAutomationConfig(): BirthdayAutomationConfig {
  const env = process.env.NODE_ENV;

  switch (env) {
    case "development":
      return DEVELOPMENT_BIRTHDAY_CONFIG;
    case "production":
      return PRODUCTION_BIRTHDAY_CONFIG;
    default:
      return DEFAULT_BIRTHDAY_CONFIG;
  }
}
