import { ensureFreshToken } from "../services/assertiva.service";

/**
 * Renova o token OAuth da Assertiva antes que expire.
 *
 * Antes rodava por cron dentro do processo web e também no import, o que
 * significava uma chamada HTTP à Assertiva a cada subida de container. Agora é
 * o worker de background que agenda (ver server/jobs/registry.ts).
 */
export async function refreshAssertivaToken(): Promise<void> {
  try {
    await ensureFreshToken();
  } catch {
    // Erros já são registrados via getAssertivaStatus(); um tick que falha não
    // deve derrubar o worker inteiro.
  }
}
