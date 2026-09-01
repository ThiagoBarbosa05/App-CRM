import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const indexCss = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const conversations = readFileSync(
  new URL("../../pages/whatsapp/conversations.tsx", import.meta.url),
  "utf8",
);

describe("dark mode message palette", () => {
  it("defines dedicated chat colors and uses them for outgoing messages", () => {
    expect(indexCss).toContain("--chat-outgoing");
    expect(indexCss).toContain("--chat-outgoing-foreground");
    expect(indexCss).toContain("--chat-outgoing-quote");
    expect(conversations).toContain("bg-[hsl(var(--chat-outgoing))]");
    expect(conversations).not.toContain("bg-black/10 border-primary-foreground/60");
  });
});
