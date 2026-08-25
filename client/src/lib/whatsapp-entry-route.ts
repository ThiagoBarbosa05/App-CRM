type WhatsappChannelConnection = {
  connectionStatus?: string | null;
};

/**
 * Vendedores só precisam abrir a gestão do canal quando não há conexão ativa.
 * Nos demais acessos, o módulo começa diretamente na caixa de conversas.
 */
export function getSellerWhatsappEntryRoute(
  channels: readonly WhatsappChannelConnection[],
): "/whatsapp/conversas" | "/whatsapp/canais" {
  return channels.some((channel) => channel.connectionStatus === "connected")
    ? "/whatsapp/conversas"
    : "/whatsapp/canais";
}
