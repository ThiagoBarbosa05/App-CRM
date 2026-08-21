export interface ConversationChannelStatus {
  id: number;
  provider: string;
  connectionStatus: string | null;
}

export interface ResolveSenderChannelInput {
  conversationChannelId: number | null | undefined;
  peerChannelId: number | null | undefined;
  perspectiveChannelId: number | null | undefined;
  accessibleChannelIds: number[];
}

/** Mirrors the backend rule that decides which side signs an internal message. */
export function resolveSenderChannelId({
  conversationChannelId,
  peerChannelId,
  perspectiveChannelId,
  accessibleChannelIds,
}: ResolveSenderChannelInput): number | undefined {
  if (perspectiveChannelId != null) return perspectiveChannelId;
  if (conversationChannelId == null) return undefined;

  if (peerChannelId != null) {
    const isPeer = accessibleChannelIds.includes(peerChannelId);
    const isOwner = accessibleChannelIds.includes(conversationChannelId);
    if (isPeer && !isOwner) return peerChannelId;
  }

  return conversationChannelId;
}

/** Returns whether the channel selected for the current conversation can send. */
export function canSendFromChannel(
  senderChannelId: number | null | undefined,
  channels: ConversationChannelStatus[],
): boolean {
  if (senderChannelId == null) return false;

  const senderChannel = channels.find((channel) => channel.id === senderChannelId);
  return (
    senderChannel != null &&
    (senderChannel.provider === "cloud_api" ||
      senderChannel.connectionStatus === "connected")
  );
}
