import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshSoonMock, markExpiredMock } = vi.hoisted(() => ({
  refreshSoonMock: vi.fn(async () => 4),
  markExpiredMock: vi.fn(async () => 1),
}));

vi.mock("../bling-connections.service", () => ({
  blingConnectionsService: {
    refreshConnectionsExpiringSoon: refreshSoonMock,
    markExpiredConnections: markExpiredMock,
  },
}));

import { runBlingTokenMaintenance } from "../../jobs/bling-token-maintenance.worker";

describe("runBlingTokenMaintenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renova candidatas antes de marcar as conexoes restantes como expiradas", async () => {
    const result = await runBlingTokenMaintenance();

    expect(result).toEqual({ refreshedCount: 4, expiredCount: 1 });
    expect(refreshSoonMock).toHaveBeenCalledOnce();
    expect(markExpiredMock).toHaveBeenCalledOnce();
    expect(refreshSoonMock.mock.invocationCallOrder[0]).toBeLessThan(
      markExpiredMock.mock.invocationCallOrder[0],
    );
  });
});
