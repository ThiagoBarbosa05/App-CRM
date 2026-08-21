import { describe, expect, it } from "vitest";
import {
  canSendFromChannel,
  resolveSenderChannelId,
} from "@/lib/wa-conversation-sender";

describe("resolveSenderChannelId", () => {
  it("uses the peer channel for an attendant who only belongs to the peer side", () => {
    expect(
      resolveSenderChannelId({
        conversationChannelId: 1,
        peerChannelId: 2,
        perspectiveChannelId: null,
        accessibleChannelIds: [2],
      }),
    ).toBe(2);
  });

  it("uses the owner channel for an attendant who belongs to the owner side", () => {
    expect(
      resolveSenderChannelId({
        conversationChannelId: 1,
        peerChannelId: 2,
        perspectiveChannelId: null,
        accessibleChannelIds: [1],
      }),
    ).toBe(1);
  });

  it("uses the explicit supervisor perspective when provided", () => {
    expect(
      resolveSenderChannelId({
        conversationChannelId: 1,
        peerChannelId: 2,
        perspectiveChannelId: 2,
        accessibleChannelIds: [1, 2],
      }),
    ).toBe(2);
  });

  it("keeps the conversation channel for an external customer", () => {
    expect(
      resolveSenderChannelId({
        conversationChannelId: 1,
        peerChannelId: null,
        perspectiveChannelId: null,
        accessibleChannelIds: [1],
      }),
    ).toBe(1);
  });
});

describe("canSendFromChannel", () => {
  it("allows sending when the sender channel is connected even if the peer is disconnected", () => {
    expect(
      canSendFromChannel(
        1,
        [
          { id: 1, provider: "evolution", connectionStatus: "connected" },
          { id: 2, provider: "evolution", connectionStatus: "disconnected" },
        ],
      ),
    ).toBe(true);
  });

  it("blocks sending when the sender channel is disconnected", () => {
    expect(
      canSendFromChannel(1, [
        { id: 1, provider: "evolution", connectionStatus: "disconnected" },
        { id: 2, provider: "evolution", connectionStatus: "connected" },
      ]),
    ).toBe(false);
  });

  it("uses the conversation channel for an external conversation", () => {
    expect(
      canSendFromChannel(1, [
        { id: 1, provider: "evolution", connectionStatus: "connected" },
        { id: 2, provider: "evolution", connectionStatus: "disconnected" },
      ]),
    ).toBe(true);
  });

  it("treats Cloud API channels as available regardless of connection status", () => {
    expect(
      canSendFromChannel(1, [
        { id: 1, provider: "cloud_api", connectionStatus: "disconnected" },
      ]),
    ).toBe(true);
  });
});
