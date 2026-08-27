import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("MainLayout WhatsApp floating button", () => {
  it("renders the button without restricting it by role or user name", () => {
    const layoutPath = fileURLToPath(
      new URL("../../layouts/main-layout.tsx", import.meta.url),
    );
    const source = readFileSync(layoutPath, "utf8");

    expect(source).toContain("<WhatsAppFloatingButton />");
    expect(source).not.toMatch(
      /user\?\.(?:role|name)[\s\S]*?<WhatsAppFloatingButton\s*\/>/,
    );
  });
});
