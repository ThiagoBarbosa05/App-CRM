import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "express";
import request from "supertest";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { validateBody } from "../../middleware/validation";

// O service importa `server/db` no topo — mockar o módulo inteiro mantém o
// teste no project `unit` (sem banco) e deixa em foco o contrato HTTP.
const resolveOrCreateAudienceClients = vi.fn();

vi.mock("../../services/clients-import-audience.service", () => ({
  resolveOrCreateAudienceClients: (...args: unknown[]) =>
    resolveOrCreateAudienceClients(...args),
}));

const { postImportAudienceController, importAudienceSchema } = await import(
  "../../controllers/clients/post-import-audience.controller"
);

const router = Router();
router.post(
  "/import-audience",
  validateBody(importAudienceSchema),
  postImportAudienceController,
);

const app = createRouteTestApp({ router, basePath: "/api/clients" });

const validBody = {
  rows: [{ name: "Hanna Leal", phone: "21995652555", rowNumber: 2 }],
  categoria: "Geral",
  origem: "Website",
  markers: ["importacao-campanha"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/clients/import-audience", () => {
  it("devolve os IDs e as contagens do service", async () => {
    resolveOrCreateAudienceClients.mockResolvedValue({
      clientIds: ["client-1"],
      created: 1,
      matched: 0,
      optedOut: 0,
      rejected: [],
    });

    const res = await request(app)
      .post("/api/clients/import-audience")
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.clientIds).toEqual(["client-1"]);
    expect(res.body.created).toBe(1);
  });

  it("repassa o usuário autenticado, para o cliente criado ter responsável", async () => {
    resolveOrCreateAudienceClients.mockResolvedValue({
      clientIds: [],
      created: 0,
      matched: 0,
      optedOut: 0,
      rejected: [],
    });

    await request(app).post("/api/clients/import-audience").send(validBody);

    expect(resolveOrCreateAudienceClients).toHaveBeenCalledWith(
      expect.objectContaining({
        categoria: "Geral",
        origem: "Website",
        markers: ["importacao-campanha"],
        userId: "test-user-id",
        userRole: "admin",
      }),
    );
  });

  it("assume markers vazio quando o campo não vem", async () => {
    resolveOrCreateAudienceClients.mockResolvedValue({
      clientIds: [],
      created: 0,
      matched: 0,
      optedOut: 0,
      rejected: [],
    });

    const { markers, ...withoutMarkers } = validBody;
    await request(app).post("/api/clients/import-audience").send(withoutMarkers);

    expect(resolveOrCreateAudienceClients).toHaveBeenCalledWith(
      expect.objectContaining({ markers: [] }),
    );
  });

  it("rejeita corpo sem nenhuma linha", async () => {
    const res = await request(app)
      .post("/api/clients/import-audience")
      .send({ ...validBody, rows: [] });

    expect(res.status).toBe(400);
    expect(resolveOrCreateAudienceClients).not.toHaveBeenCalled();
  });

  it("rejeita corpo sem categoria ou origem", async () => {
    const res = await request(app)
      .post("/api/clients/import-audience")
      .send({ ...validBody, categoria: "", origem: "" });

    expect(res.status).toBe(400);
    expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
      expect.arrayContaining(["categoria", "origem"]),
    );
    expect(resolveOrCreateAudienceClients).not.toHaveBeenCalled();
  });

  it("rejeita planilha acima do teto de 5000 linhas", async () => {
    const rows = Array.from({ length: 5001 }, (_, index) => ({
      name: `Contato ${index}`,
      phone: "21995652555",
      rowNumber: index + 2,
    }));

    const res = await request(app)
      .post("/api/clients/import-audience")
      .send({ ...validBody, rows });

    expect(res.status).toBe(400);
    expect(resolveOrCreateAudienceClients).not.toHaveBeenCalled();
  });

  it("responde 500 sem vazar o erro interno quando o service falha", async () => {
    resolveOrCreateAudienceClients.mockRejectedValue(
      new Error("connection terminated unexpectedly"),
    );

    const res = await request(app)
      .post("/api/clients/import-audience")
      .send(validBody);

    expect(res.status).toBe(500);
    expect(res.body.message).not.toContain("connection");
  });
});
