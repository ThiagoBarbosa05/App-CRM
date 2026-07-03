import { describe, expect, it } from "vitest";
import { clampLimit, decodeCursor, encodeCursor } from "../../lib/cursor-pagination";

describe("encodeCursor / decodeCursor", () => {
  it("faz round-trip preservando at e id", () => {
    const cursor = { at: "2026-07-02T23:16:00.000Z", id: "msg-1" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("preserva at: null (bucket sem timestamp da lista de conversas)", () => {
    const cursor = { at: null, id: "conv-1" };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it("retorna null para string que não é base64/JSON válido", () => {
    expect(decodeCursor("not-a-valid-cursor!!!")).toBeNull();
  });

  it("retorna null para JSON válido mas com formato errado", () => {
    const badShape = Buffer.from(JSON.stringify({ foo: "bar" }), "utf-8").toString(
      "base64url",
    );
    expect(decodeCursor(badShape)).toBeNull();
  });

  it("retorna null para undefined ou string vazia", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("clampLimit", () => {
  it("usa o fallback quando o valor é ausente", () => {
    expect(clampLimit(undefined, { fallback: 20, max: 100 })).toBe(20);
  });

  it("usa o fallback quando o valor não é um número válido", () => {
    expect(clampLimit("abc", { fallback: 20, max: 100 })).toBe(20);
  });

  it("usa o fallback quando o valor é <= 0", () => {
    expect(clampLimit("0", { fallback: 20, max: 100 })).toBe(20);
    expect(clampLimit("-5", { fallback: 20, max: 100 })).toBe(20);
  });

  it("trava no máximo quando o valor pedido excede", () => {
    expect(clampLimit("500", { fallback: 20, max: 100 })).toBe(100);
  });

  it("respeita o valor pedido quando está dentro do intervalo", () => {
    expect(clampLimit("35", { fallback: 20, max: 100 })).toBe(35);
  });

  it("aceita number diretamente (não só string) — services chamam com pagination.limit já numérico", () => {
    expect(clampLimit(35, { fallback: 20, max: 100 })).toBe(35);
    expect(clampLimit(500, { fallback: 20, max: 100 })).toBe(100);
    expect(clampLimit(0, { fallback: 20, max: 100 })).toBe(20);
    expect(clampLimit(-5, { fallback: 20, max: 100 })).toBe(20);
  });
});
