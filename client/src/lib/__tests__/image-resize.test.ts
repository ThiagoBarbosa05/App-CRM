import { describe, expect, it } from "vitest";

import { computeResizedDimensions } from "../image-resize";

describe("computeResizedDimensions", () => {
  it("não amplia imagem menor que o limite", () => {
    expect(computeResizedDimensions(200, 100, 512)).toEqual({ width: 200, height: 100 });
  });

  it("mantém imagem exatamente no limite", () => {
    expect(computeResizedDimensions(512, 512, 512)).toEqual({ width: 512, height: 512 });
  });

  it("reduz paisagem pelo lado maior, mantendo proporção", () => {
    expect(computeResizedDimensions(2000, 1000, 512)).toEqual({ width: 512, height: 256 });
  });

  it("reduz retrato pelo lado maior, mantendo proporção", () => {
    expect(computeResizedDimensions(1000, 2000, 512)).toEqual({ width: 256, height: 512 });
  });

  it("arredonda para inteiro", () => {
    const result = computeResizedDimensions(1000, 333, 512);

    expect(result.width).toBe(512);
    expect(Number.isInteger(result.height)).toBe(true);
    expect(result.height).toBe(171);
  });

  it("nunca devolve dimensão zero", () => {
    const result = computeResizedDimensions(1000, 1, 512);

    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
