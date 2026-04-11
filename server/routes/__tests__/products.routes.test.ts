import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createRouteTestHeaders } from "../../test/create-route-test-app";
import { productsRouter } from "../products.routes";

const {
  getProductsMock,
  createProductMock,
  updateProductMock,
  deleteProductMock,
  getCompaniesWithProductMock,
  getProductsStatisticsMock,
} = vi.hoisted(() => ({
  getProductsMock: vi.fn(),
  createProductMock: vi.fn(),
  updateProductMock: vi.fn(),
  deleteProductMock: vi.fn(),
  getCompaniesWithProductMock: vi.fn(),
  getProductsStatisticsMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getProducts: getProductsMock,
    createProduct: createProductMock,
    updateProduct: updateProductMock,
    deleteProduct: deleteProductMock,
    getCompaniesWithProduct: getCompaniesWithProductMock,
    getProductsStatistics: getProductsStatisticsMock,
  },
}));

describe("productsRouter", () => {
  beforeEach(() => {
    getProductsMock.mockReset();
    createProductMock.mockReset();
    updateProductMock.mockReset();
    deleteProductMock.mockReset();
    getCompaniesWithProductMock.mockReset();
    getProductsStatisticsMock.mockReset();
  });

  it("keeps GET /products query and pagination contract", async () => {
    getProductsMock.mockResolvedValue({ data: [{ id: "product-1" }], total: 1 });
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app).get(
      "/products?name=vinho&type=tinto&country=BR&volume=750&page=2&pageSize=5",
    );

    expect(getProductsMock).toHaveBeenCalledWith(
      { name: "vinho", type: "tinto", country: "BR", volume: "750" },
      2,
      5,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: [{ id: "product-1" }],
      currentPage: 2,
      totalPages: 1,
      totalItems: 1,
    });
  });

  it("returns 401 for POST /products without x-user-id", async () => {
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app).post("/products").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Usuário não autenticado" });
  });

  it("creates product with createdBy injected from header", async () => {
    createProductMock.mockResolvedValue({ id: "product-1" });
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app)
      .post("/products")
      .set(createRouteTestHeaders())
      .send({
        name: "Vinho",
        type: "TINTO",
        country: "BRASIL",
        volume: "750ml",
        negotiatedPrice: "10.00",
      });

    expect(createProductMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "product-1" });
  });

  it("returns 400 for invalid PUT /products/:id body", async () => {
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app)
      .put("/products/product-1")
      .send({ country: "INVALIDO" });

    expect(response.status).toBe(400);
  });

  it("returns 404 for DELETE /products/:id when product is missing", async () => {
    deleteProductMock.mockResolvedValue(false);
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app).delete("/products/product-1");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Produto não encontrado" });
  });

  it("keeps GET /products/:productId/companies", async () => {
    getCompaniesWithProductMock.mockResolvedValue([{ id: "company-1" }]);
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app).get("/products/product-1/companies");

    expect(getCompaniesWithProductMock).toHaveBeenCalledWith("product-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "company-1" }]);
  });

  it("keeps GET /products/statistics reachable", async () => {
    getProductsStatisticsMock.mockResolvedValue({ totalProducts: 3 });
    const app = createRouteTestApp({ router: productsRouter, basePath: "/products" });

    const response = await request(app).get("/products/statistics");

    expect(getProductsStatisticsMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalProducts: 3 });
  });
});
