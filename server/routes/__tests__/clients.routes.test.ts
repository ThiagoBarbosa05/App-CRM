import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { clientsRouter } from "../clients.routes";

vi.mock("../../controllers/clients/get-clients.controller", () => ({
  getClientsController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-client-by-phone.controller", () => ({
  getClientByPhoneController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-clients-without-contact.controller", () => ({
  getClientsWithoutContactController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-clients-export-all.controller", () => ({
  getClientsExportAllController: vi.fn(),
}));
vi.mock("../../controllers/clients/post-client.controller", () => ({
  postClientController: vi.fn(),
}));
vi.mock("../../controllers/clients/put-client.controller", () => ({
  putClientController: vi.fn(),
}));
vi.mock("../../controllers/clients/delete-client.controller", () => ({
  deleteClientController: vi.fn(),
}));
vi.mock("../../controllers/clients/delete-clients-bulk.controller", () => ({
  deleteClientsBulkController: vi.fn(),
}));
vi.mock("../../controllers/clients/confirm-client.controller", () => ({
  confirmClientController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-client-interactions.controller", () => ({
  getClientInteractionsController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-client-funnels.controller", () => ({
  getClientFunnelsController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-client-by-id.controller", () => ({
  getClientByIdController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-client-purchase-insights.controller", () => ({
  getClientPurchaseInsightsController: vi.fn(),
}));
vi.mock("../../controllers/clients/check-duplicate.controller", () => ({
  checkDuplicateController: vi.fn(),
}));
vi.mock("../../controllers/clients/get-duplicates.controller", () => ({
  getDuplicatesController: vi.fn(),
}));

describe("clientsRouter import route", () => {
  it("returns 400 when file is missing", async () => {
    const app = createRouteTestApp({ router: clientsRouter, basePath: "/clients" });

    const response = await request(app).post("/clients/import");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Arquivo não fornecido" });
  });

  it("returns the current stub payload when file is uploaded", async () => {
    const app = createRouteTestApp({ router: clientsRouter, basePath: "/clients" });

    const response = await request(app)
      .post("/clients/import")
      .attach("file", Buffer.from("id,name\n1,Cliente"), "clientes.csv");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: 0, errors: [] });
  });
});
