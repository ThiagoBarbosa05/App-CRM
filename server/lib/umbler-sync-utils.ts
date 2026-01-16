import crypto from "crypto";

/**
 * Interface para tags do Umbler
 */
export interface UmblerTag {
  _t: string;
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  description?: string;
  order?: number;
  createdAtUTC?: string;
  groupIds?: string[];
}

/**
 * Calcula hash SHA-256 das tags para detectar mudanças
 * Usa apenas id e name para o hash, ignorando campos voláteis
 */
export function calculateTagsHash(tags: UmblerTag[]): string {
  if (!tags || tags.length === 0) {
    return "empty";
  }

  // Ordenar por ID para garantir consistência
  const sortedTags = [...tags].sort((a, b) => a.id.localeCompare(b.id));

  // Usar apenas id e name para o hash
  const tagIdentifiers = sortedTags.map((tag) => `${tag.id}:${tag.name}`);

  const hashInput = tagIdentifiers.join("|");

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Rate Limiter com janela deslizante
 * Limite: 100 requests em 5 segundos
 */
export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowSeconds = 5) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  /**
   * Aguarda até que seja seguro fazer uma requisição
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Remove requisições fora da janela
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    // Se atingiu o limite, aguarda
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest) + 100; // +100ms de margem

      if (waitTime > 0) {
        await this.sleep(waitTime);
        return this.waitForSlot(); // Recheca após esperar
      }
    }

    // Registra a requisição
    this.requests.push(Date.now());
  }

  /**
   * Adiciona delay entre requisições para distribuir carga
   * Para 100 req/5s = 20 req/s, usamos ~50ms entre requests
   */
  async throttle(): Promise<void> {
    await this.sleep(60); // 60ms = ~16.6 req/s (safe rate)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reseta o contador (útil para testes)
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Retorna quantas requisições restam na janela atual
   */
  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter(
      (timestamp) => now - timestamp < this.windowMs
    );
    return Math.max(0, this.maxRequests - this.requests.length);
  }
}

/**
 * Retry com backoff exponencial
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Se for o último attempt, lança o erro
      if (attempt === maxRetries) {
        throw lastError;
      }

      // Calcula delay exponencial: 1s, 2s, 4s, 8s...
      const delay = initialDelayMs * Math.pow(2, attempt);
      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Normaliza telefone para formato E.164
 * Entrada: (11) 99999-9999, 11999999999, +5511999999999
 * Saída: +5511999999999
 */
export function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;

  // Remove todos os caracteres não numéricos, exceto o +
  let cleaned = phone.replace(/[^\d+]/g, "");

  // Se já tem +55, retorna
  if (cleaned.startsWith("+55")) {
    return cleaned;
  }

  // Se começa com 55, adiciona +
  if (cleaned.startsWith("55")) {
    return `+${cleaned}`;
  }

  // Se tem 10 ou 11 dígitos, adiciona +55
  if (cleaned.length === 10 || cleaned.length === 11) {
    return `+55${cleaned}`;
  }

  // Formato inválido
  return null;
}

/**
 * Valida se o telefone está no formato E.164 válido
 */
export function isValidE164Phone(phone: string): boolean {
  // Padrão E.164: +[código do país][DDD][número]
  // Brasil: +55 (2 dígitos) + DDD (2 dígitos) + número (8 ou 9 dígitos)
  const e164Pattern = /^\+55\d{10,11}$/;
  return e164Pattern.test(phone);
}
