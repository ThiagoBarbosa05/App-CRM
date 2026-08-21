export interface SellerWhatsappChannel {
  userId?: string | null;
  provider: string;
  connectionStatus: string | null;
}

export function findDisconnectedOwnEvolutionChannel<
  TChannel extends SellerWhatsappChannel,
>(channels: TChannel[], userId: string | null | undefined): TChannel | null {
  if (!userId) return null;

  return (
    channels.find(
      (channel) =>
        channel.userId === userId &&
        channel.provider === "evolution" &&
        channel.connectionStatus !== "connected",
    ) ?? null
  );
}
