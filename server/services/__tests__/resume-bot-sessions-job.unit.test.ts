import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  queryMock,
  releaseMock,
  connectMock,
  resumeWaitingSessionsMock,
} = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  return {
    queryMock: query,
    releaseMock: release,
    connectMock: vi.fn(async () => ({ query, release })),
    resumeWaitingSessionsMock: vi.fn(async () => 2),
  };
});

vi.mock("../../db", () => ({
  pool: { connect: connectMock },
}));

vi.mock("../whatsapp-bot-engine.service", () => ({
  resumeWaitingSessions: resumeWaitingSessionsMock,
}));

import { runResumeBotSessionsTick } from "../../jobs/resume-bot-sessions.job";

describe("runResumeBotSessionsTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("não retoma sessões quando outra instância possui a trava", async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ locked: false }] });

    await expect(runResumeBotSessionsTick()).resolves.toBe(0);

    expect(resumeWaitingSessionsMock).not.toHaveBeenCalled();
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("retoma uma vez e libera a trava compartilhada", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(runResumeBotSessionsTick()).resolves.toBe(2);

    expect(resumeWaitingSessionsMock).toHaveBeenCalledOnce();
    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      "SELECT pg_advisory_unlock($1)",
      [727_100_002],
    );
    expect(releaseMock).toHaveBeenCalledOnce();
  });
});
