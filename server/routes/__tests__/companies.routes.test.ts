import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createRouteTestApp, createRouteTestHeaders } from "../../test/create-route-test-app";
import { companyProductsRouter } from "../products.routes";

const {
  getCompanyProductsMock,
  getAvailableProductsForCompanyMock,
  addProductToCompanyMock,
  removeProductFromCompanyMock,
  updateCompanyProductPriceMock,
} = vi.hoisted(() => ({
  getCompanyProductsMock: vi.fn(),
  getAvailableProductsForCompanyMock: vi.fn(),
  addProductToCompanyMock: vi.fn(),
  removeProductFromCompanyMock: vi.fn(),
  updateCompanyProductPriceMock: vi.fn(),
}));

vi.mock("../../storage", () => ({
  storage: {
    getCompanyProducts: getCompanyProductsMock,
    getAvailableProductsForCompany: getAvailableProductsForCompanyMock,
    addProductToCompany: addProductToCompanyMock,
    removeProductFromCompany: removeProductFromCompanyMock,
    updateCompanyProductPrice: updateCompanyProductPriceMock,
  },
}));

vi.mock("../../controllers/companies/get-companies.controller", () => ({ getCompaniesController: vi.fn() }));
vi.mock("../../controllers/companies/post-company.controller", () => ({ postCompanyController: vi.fn() }));
vi.mock("../../controllers/companies/put-company.controller", () => ({ putCompanyController: vi.fn() }));
vi.mock("../../controllers/companies/delete-company.controller", () => ({ deleteCompanyController: vi.fn() }));
vi.mock("../../controllers/companies/delete-companies-bulk.controller", () => ({ deleteCompaniesBulkController: vi.fn() }));
vi.mock("../../controllers/companies/get-company-interactions.controller", () => ({ getCompanyInteractionsController: vi.fn() }));
vi.mock("../../controllers/companies/get-company-funnels.controller", () => ({ getCompanyFunnelsController: vi.fn() }));
vi.mock("../../controllers/get-deal-answered-questions.controller", () => ({ getDealAnsweredQuestionsController: vi.fn() }));

describe("companiesRouter product routes", () => {
  beforeEach(() => {
    getCompanyProductsMock.mockReset();
    getAvailableProductsForCompanyMock.mockReset();
    addProductToCompanyMock.mockReset();
    removeProductFromCompanyMock.mockReset();
    updateCompanyProductPriceMock.mockReset();
  });

  it("keeps GET /:companyId/products", async () => {
    getCompanyProductsMock.mockResolvedValue([{ id: "product-1" }]);
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app).get("/companies/company-1/products");

    expect(getCompanyProductsMock).toHaveBeenCalledWith("company-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "product-1" }]);
  });

  it("keeps GET /:companyId/available-products", async () => {
    getAvailableProductsForCompanyMock.mockResolvedValue([{ id: "product-2" }]);
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app).get("/companies/company-1/available-products");

    expect(getAvailableProductsForCompanyMock).toHaveBeenCalledWith("company-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{ id: "product-2" }]);
  });

  it("returns 401 for POST /:companyId/products without x-user-id", async () => {
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app)
      .post("/companies/company-1/products")
      .send({ productId: "product-1" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Usuário não autenticado" });
  });

  it("creates company product with the same body/header contract", async () => {
    addProductToCompanyMock.mockResolvedValue({ id: "company-product-1" });
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app)
      .post("/companies/company-1/products")
      .set(createRouteTestHeaders())
      .send({ productId: "product-1" });

    expect(addProductToCompanyMock).toHaveBeenCalledWith({
      companyId: "company-1",
      productId: "product-1",
      addedBy: "test-user-id",
      isActive: "true",
    });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ id: "company-product-1" });
  });

  it("keeps DELETE /:companyId/products/:productId", async () => {
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app).delete("/companies/company-1/products/product-1");

    expect(removeProductFromCompanyMock).toHaveBeenCalledWith("company-1", "product-1");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Product removed from company wine list" });
  });

  it("keeps PUT /:companyId/products/:productId/price validations and success shape", async () => {
    updateCompanyProductPriceMock.mockResolvedValue({ id: "company-product-1", customPrice: "99.90" });
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app)
      .put("/companies/company-1/products/product-1/price")
      .send({ customPrice: "99.90" });

    expect(updateCompanyProductPriceMock).toHaveBeenCalledWith("company-1", "product-1", "99.9");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "Preço atualizado com sucesso",
      data: { id: "company-product-1", customPrice: "99.90" },
    });
  });

  it("returns 404 when company product price target is missing", async () => {
    updateCompanyProductPriceMock.mockResolvedValue(null);
    const app = createRouteTestApp({ router: companyProductsRouter, basePath: "/" });

    const response = await request(app)
      .put("/companies/company-1/products/product-1/price")
      .send({ customPrice: "10" });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Produto não encontrado na carta da empresa" });
  });
});
