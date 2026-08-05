/**
 * Lógica pura de decisão de finalização de uma campanha WhatsApp, extraída de
 * `finalizeIfDone` (server/jobs/whatsapp-campaign-dispatcher.ts) para poder
 * ser testada sem tocar no banco.
 *
 * Implementa a regra "honesta" do passo 8 do plano: campanha só é `completed`
 * se não há mais mensagens agendadas (remaining=0). Mensagens `suppressed` são
 * tratadas como terminais mesmo com sent=0/failed=0, de forma que uma campanha
 * onde TODOS os contatos foram suprimidos por dedupe/opt-out/número inválido/etc
 * é finalizada como `completed` (status honesto) — o frontend decide exibir um
 * badge contextualizado via condicional (ver campaign-details.tsx).
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
  // "failed"; qualquer outro caso (inclusive 0 envios e 0 falhas, p. ex.
  // todos os contatos suprimidos por dedupe/opt-out/número inválido) vira
  // "completed" — a regra honesta da Task 8 já está implementada aqui.
  const status = counts.sent === 0 && counts.failed > 0 ? "failed" : "completed";
  return { terminal: true, status };
}
