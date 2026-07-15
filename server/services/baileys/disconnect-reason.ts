import { DisconnectReason } from "@whiskeysockets/baileys";

// Traduz o código numérico do DisconnectReason do Baileys para um rótulo
// legível em pt-BR, exibido ao vendedor no histórico/badge de conexão.
const REASON_LABELS: Record<number, string> = {
  [DisconnectReason.loggedOut]: "Desconectado pelo celular (logout)",
  [DisconnectReason.connectionReplaced]: "Sessão substituída por outro dispositivo/conexão",
  [DisconnectReason.connectionLost]: "Conexão perdida (tentando reconectar)",
  [DisconnectReason.connectionClosed]: "Conexão encerrada (tentando reconectar)",
  [DisconnectReason.badSession]: "Sessão inválida (tentando reconectar)",
  [DisconnectReason.multideviceMismatch]: "Incompatibilidade de dispositivo (tentando reconectar)",
  [DisconnectReason.forbidden]: "Conexão recusada pelo WhatsApp (tentando reconectar)",
  [DisconnectReason.unavailableService]: "Serviço do WhatsApp indisponível (tentando reconectar)",
};

export function getDisconnectReasonLabel(reason: number | undefined): string {
  if (reason === undefined) return "Conexão perdida (tentando reconectar)";
  return REASON_LABELS[reason] ?? `Conexão perdida (código ${reason}, tentando reconectar)`;
}
