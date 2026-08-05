/**
 * Lógica pura de decisão de finalização de uma campanha WhatsApp, extraída de
 * `finalizeIfDone` (server/jobs/whatsapp-campaign-dispatcher.ts) para poder
 * ser testada sem tocar no banco.
 *
 * Replica EXATAMENTE a regra atual do dispatcher — não é a regra "honesta"
 * do passo 8 do plano (que também vai considerar mensagens `suppressed`
 * como terminais mesmo com sent=0/failed=0); essa revisão é uma task futura
 * separada.
 */

export type FinalizationCounts = {
  remaining: number;
  sent: number;
  failed: number;
};

export type FinalizationDecision =
  | { terminal: true; status: "completed" | "failed" }
  | { terminal: false };

export function decideFinalization(
  counts: FinalizationCounts,
): FinalizationDecision {
  if (counts.remaining !== 0) {
    // Ainda há mensagens agendadas — campanha continua em andamento.
    return { terminal: false };
  }

  // Nada mais agendado: falha total (nenhum envio, mas houve falha) vira
  // "failed"; qualquer outro caso (inclusive 0 envios e 0 falhas) vira
  // "completed".
  const status = counts.sent === 0 && counts.failed > 0 ? "failed" : "completed";
  return { terminal: true, status };
}
