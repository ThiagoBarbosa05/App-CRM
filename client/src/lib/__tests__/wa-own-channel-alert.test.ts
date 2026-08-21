import { describe, expect, it } from "vitest";
import { findDisconnectedOwnEvolutionChannel } from "@/lib/wa-own-channel-alert";

const channels = [
  {
    id: 1,
    userId: "seller-1",
    provider: "evolution",
    connectionStatus: "connected",
  },
  {
    id: 2,
    userId: "seller-2",
    provider: "evolution",
    connectionStatus: "disconnected",
  },
];

describe("findDisconnectedOwnEvolutionChannel", () => {
  it("returns the seller's own disconnected Evolution channel", () => {
    expect(
      findDisconnectedOwnEvolutionChannel(
        [
          ...channels,
          {
            id: 3,
            userId: "seller-1",
            provider: "evolution",
            connectionStatus: "disconnected",
          },
        ],
        "seller-1",
      )?.id,
    ).toBe(3);
  });

  it("ignores a disconnected channel that only belongs to another seller", () => {
    expect(findDisconnectedOwnEvolutionChannel(channels, "seller-1")).toBeNull();
  });

  it("ignores the seller's Cloud API channel", () => {
    expect(
      findDisconnectedOwnEvolutionChannel(
        [
          {
            id: 4,
            userId: "seller-1",
            provider: "cloud_api",
            connectionStatus: "disconnected",
          },
        ],
        "seller-1",
      ),
    ).toBeNull();
  });

  it("returns null when there is no authenticated seller", () => {
    expect(findDisconnectedOwnEvolutionChannel(channels, null)).toBeNull();
  });
});
