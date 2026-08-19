import { beforeEach, describe, expect, it, vi } from "vitest";

type FakeClient = {
  query: (query: string, params?: string[]) => Promise<void>;
  release: () => void;
};

const { poolMock } = vi.hoisted(() => ({
  poolMock: { connect: vi.fn() },
}));

vi.mock("server/db", () => ({ pool: poolMock }));

import { withWhatsappBotSessionLock } from "../whatsapp-bot-session-lock.service";

describe("withWhatsappBotSessionLock", () => {
  const locks = new Set<string>();
  const waiters = new Map<string, Array<() => void>>();

  beforeEach(() => {
    locks.clear();
    waiters.clear();
    poolMock.connect.mockReset();
    poolMock.connect.mockImplementation(async (): Promise<FakeClient> => {
      let heldKey: string | null = null;
      return {
        query: async (query: string, params?: string[]) => {
          const key = params?.[1] ?? "";
          if (query.includes("pg_advisory_lock")) {
            if (locks.has(key)) {
              await new Promise<void>((resolve) => {
                const pending = waiters.get(key) ?? [];
                pending.push(resolve);
                waiters.set(key, pending);
              });
            }
            locks.add(key);
            heldKey = key;
            return;
          }
          if (query.includes("pg_advisory_unlock") && heldKey) {
            locks.delete(heldKey);
            waiters.get(heldKey)?.shift()?.();
          }
        },
        release: vi.fn(),
      };
    });
  });

  it("não sobrepõe transições concorrentes da mesma conversa", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstEntered = new Promise<void>((resolve) => {
      void withWhatsappBotSessionLock("5511988888888", async () => {
        events.push("first:start");
        resolve();
        await new Promise<void>((continueFirst) => {
          releaseFirst = continueFirst;
        });
        events.push("first:end");
      });
    });

    await firstEntered;
    const second = withWhatsappBotSessionLock("5511988888888", async () => {
      events.push("second:start");
      events.push("second:end");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst?.();
    await second;
    expect(events).toEqual(["first:start", "first:end", "second:start", "second:end"]);
  });
});
