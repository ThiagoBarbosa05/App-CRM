import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ACTIVE_RUNTIME_FILES = [
  "server/index.ts",
  "server/integrations/evolution.ts",
  "server/routes/whatsapp-channels.routes.ts",
];

describe("runtime QR exclusivo do Baileys Gateway", () => {
  it.each(ACTIVE_RUNTIME_FILES)(
    "%s não referencia o runtime Baileys legado",
    (relativePath) => {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");
      expect(source).not.toMatch(
        /services\/baileys\/session-manager|makeWASocket|initSessionManager|shutdownAllSessions|startReconcileBaileysStatusJob|suspendEmbeddedInstance/,
      );
    },
  );

  it("mantém o banco restrito ao backend gateway", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "migrations/0007_gateway_only_qr_channels.sql"),
      "utf8",
    );
    expect(migration).toContain("ALTER COLUMN qr_backend SET DEFAULT 'gateway'");
    expect(migration).toContain("CHECK (qr_backend = 'gateway')");
  });
});
