import { describe, expect, it } from "vitest";
import { resolveSaleSellerName } from "../get-sales-history.controller";

describe("resolveSaleSellerName", () => {
  it("prioritizes the seller name from the Bling order", () => {
    expect(resolveSaleSellerName("Maria Bling", "João Responsável")).toBe(
      "Maria Bling",
    );
  });

  it("falls back to the client's responsible user", () => {
    expect(resolveSaleSellerName(null, "João Responsável")).toBe(
      "João Responsável",
    );
  });

  it("returns Não informado when neither seller is available", () => {
    expect(resolveSaleSellerName(null, null)).toBe("Não informado");
  });
});
