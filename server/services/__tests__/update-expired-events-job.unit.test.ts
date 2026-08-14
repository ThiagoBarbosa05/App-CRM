import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock, releaseMock, connectMock, scheduleMock, stopMock } = vi.hoisted(
  () => {
    const query = vi.fn();
    const release = vi.fn();
    const stop = vi.fn();
    return {
      queryMock: query,
      releaseMock: release,
      connectMock: vi.fn(async () => ({ query, release })),
      scheduleMock: vi.fn(() => ({ stop })),
      stopMock: stop,
    };
  },
);

vi.mock("../../db", () => ({
  pool: { connect: connectMock },
}));

vi.mock("node-cron", () => ({
  default: { schedule: scheduleMock },
}));

import {
  startUpdateExpiredEventsJob,
  updateExpiredEvents,
} from "../../jobs/update-expired-events-scheduler";

describe("updateExpiredEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa o início do dia em São Paulo e atualiza somente estados abertos", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(
      updateExpiredEvents(new Date("2026-08-15T01:30:00.000Z")),
    ).resolves.toBe(2);

    expect(queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("status IN ('planejado', 'ativo')"),
      [new Date("2026-08-14T03:00:00.000Z")],
    );
    expect(queryMock.mock.calls[2][0]).not.toContain("RETURNING");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("não atualiza quando outra réplica possui a trava", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: false }] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(updateExpiredEvents()).resolves.toBe(0);

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(queryMock).toHaveBeenLastCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });

  it("é idempotente quando a segunda execução não encontra linhas", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await expect(updateExpiredEvents()).resolves.toBe(1);
    await expect(updateExpiredEvents()).resolves.toBe(0);
  });

  it("reverte, libera a conexão e propaga falhas", async () => {
    const failure = new Error("database unavailable");
    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ rows: [] });

    await expect(updateExpiredEvents()).rejects.toBe(failure);

    expect(queryMock).toHaveBeenLastCalledWith("ROLLBACK");
    expect(releaseMock).toHaveBeenCalledOnce();
  });
});

describe("startUpdateExpiredEventsJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("agenda sem sobreposição, expõe parada e não registra sucesso falso", async () => {
    const failure = new Error("boom");
    const update = vi.fn().mockRejectedValue(failure);
    const logger = { log: vi.fn(), error: vi.fn() };

    const controller = startUpdateExpiredEventsJob({ update, logger });

    await expect(controller.catchUp).rejects.toBe(failure);
    expect(scheduleMock).toHaveBeenCalledWith(
      "0 0 * * *",
      expect.any(Function),
      expect.objectContaining({
        timezone: "America/Sao_Paulo",
        noOverlap: true,
      }),
    );
    expect(logger.log).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledOnce();

    await controller.stop();
    expect(stopMock).toHaveBeenCalledOnce();
  });
});
