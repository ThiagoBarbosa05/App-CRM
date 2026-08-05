import { beforeEach, describe, expect, it, vi } from "vitest";
import { Router } from "express";
import request from "supertest";
import { z } from "zod";

import { createRouteTestApp } from "../../test/create-route-test-app";
import { ClientOperationError } from "../../services/clients.errors";

// O service importa `server/db` no topo — mockar o módulo inteiro mantém o
// teste no project `unit` (sem banco) e deixa em foco o que interessa aqui: o
// contrato de erro que chega ao formulário.
const createClient = vi.fn();
const updateClient = vi.fn();

vi.mock("../../services/clients.service", () => ({
  clientsService: {
    createClient: (...args: unknown[]) => createClient(...args),
    updateClient: (...args: unknown[]) => updateClient(...args),
    processCreateClientParams: (req: { body: unknown }) => ({
      clientData: req.body,
    }),
    processUpdateClientParams: (req: { params: { id: string }; body: unknown }) => ({
      clientId: req.params.id,
      updateData: req.body,
    }),
  },
}));

const { postClientController } = await import(
  "../../controllers/clients/post-client.controller"
);
const { putClientController } = await import(
  "../../controllers/clients/put-client.controller"
);

const router = Router();
router.post("/", postClientController);
router.put("/:id", putClientController);

const app = createRouteTestApp({ router, basePath: "/api/clients" });

/** ZodError equivalente ao que `insertClientSchema` lança para campo ausente. */
function requiredFieldError(field: string) {
  return new z.ZodError([
    {
      code: "invalid_type",
      expected: "string",
      received: "undefined",
      path: [field],
      message: "Required",
    },
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/clients — contrato de erro", () => {
  it("devolve 400 com a falha por campo, em português", async () => {
    createClient.mockRejectedValue(requiredFieldError("categoria"));

    const res = await request(app).post("/api/clients").send({ name: "Ana" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Categoria é obrigatória.");
    expect(res.body.errors).toEqual([
      { field: "categoria", message: "Categoria é obrigatória." },
    ]);
  });

  it("mantém em português a mensagem de um refine nosso", async () => {
    createClient.mockRejectedValue(
      new z.ZodError([
        {
          code: "custom",
          path: ["birthday"],
          message: "Cliente deve ser maior de idade (18 anos ou mais)",
        },
      ]),
    );

    const res = await request(app).post("/api/clients").send({ name: "Ana" });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      "Cliente deve ser maior de idade (18 anos ou mais)",
    );
  });

  it("devolve 409 e o campo culpado para documento duplicado", async () => {
    createClient.mockRejectedValue(
      new ClientOperationError(
        'Este CPF/CNPJ já está cadastrado para o cliente "João Silva".',
        409,
        { field: "cpf" },
      ),
    );

    const res = await request(app).post("/api/clients").send({ name: "Ana" });

    expect(res.status).toBe(409);
    expect(res.body.field).toBe("cpf");
    expect(res.body.message).toBe(
      'Este CPF/CNPJ já está cadastrado para o cliente "João Silva".',
    );
  });

  it("não vaza o detalhe técnico de um erro inesperado", async () => {
    createClient.mockRejectedValue(
      new Error('relation "clients" does not exist at character 13'),
    );

    const res = await request(app).post("/api/clients").send({ name: "Ana" });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Não foi possível cadastrar o cliente. Tente novamente em instantes.",
    );
    expect(JSON.stringify(res.body)).not.toContain("relation");
  });

  it("devolve 201 com o cliente criado no caminho feliz", async () => {
    createClient.mockResolvedValue({ id: "c1", name: "Ana" });

    const res = await request(app).post("/api/clients").send({ name: "Ana" });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "c1", name: "Ana" });
  });
});

describe("PUT /api/clients/:id — contrato de erro", () => {
  it("devolve 409 para CPF duplicado em vez de 500 genérico", async () => {
    // Regressão: o service trocava a mensagem de duplicidade por um
    // "Erro ao atualizar cliente" fixo, e o usuário via só um 500 sem causa.
    updateClient.mockRejectedValue(
      new ClientOperationError(
        'Este CPF/CNPJ já está cadastrado para o cliente "João Silva".',
        409,
        { field: "cpf" },
      ),
    );

    const res = await request(app).put("/api/clients/c1").send({ cpf: "1" });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain("já está cadastrado");
    expect(res.body.field).toBe("cpf");
  });

  it("devolve 409 para e-mail duplicado", async () => {
    updateClient.mockRejectedValue(
      new ClientOperationError(
        'Este e-mail já está cadastrado para o cliente "João Silva".',
        409,
        { field: "email" },
      ),
    );

    const res = await request(app).put("/api/clients/c1").send({});

    expect(res.status).toBe(409);
    expect(res.body.field).toBe("email");
  });

  it("devolve 404 explicando o que houve quando o cliente não existe", async () => {
    updateClient.mockRejectedValue(new Error("CLIENT_NOT_FOUND"));

    const res = await request(app).put("/api/clients/sumiu").send({});

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(
      "Cliente não encontrado. Ele pode ter sido excluído.",
    );
  });

  it("não vaza o detalhe técnico de um erro inesperado", async () => {
    updateClient.mockRejectedValue(new Error("ECONNREFUSED 10.0.0.5:5432"));

    const res = await request(app).put("/api/clients/c1").send({});

    expect(res.status).toBe(500);
    expect(res.body.message).toBe(
      "Não foi possível salvar as alterações. Tente novamente em instantes.",
    );
    expect(JSON.stringify(res.body)).not.toContain("ECONNREFUSED");
  });
});
