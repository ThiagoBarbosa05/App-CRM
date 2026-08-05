import { describe, expect, it } from "vitest";

import { ClientOperationError, mapDatabaseError } from "../clients.errors";

describe("mapDatabaseError", () => {
  it("traduz a constraint de telefone lendo o campo `constraint` do driver", () => {
    const error = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint: "clients_phone_unique",
    });

    const mapped = mapDatabaseError(error);

    expect(mapped).toBeInstanceOf(ClientOperationError);
    expect(mapped?.httpStatus).toBe(409);
    expect(mapped?.field).toBe("phone");
    expect(mapped?.userMessage).toBe(
      "Este número de telefone já está cadastrado para outro cliente.",
    );
  });

  it("traduz a constraint quando ela só aparece no texto do erro", () => {
    const error = new Error(
      'duplicate key value violates unique constraint "clients_cpf_unique"',
    );

    const mapped = mapDatabaseError(error);

    expect(mapped?.field).toBe("cpf");
    expect(mapped?.userMessage).toContain("CPF/CNPJ já está cadastrado");
  });

  it("traduz e-mail duplicado", () => {
    const error = Object.assign(new Error("dup"), {
      constraint: "clients_email_unique",
    });

    expect(mapDatabaseError(error)?.field).toBe("email");
  });

  it("traduz responsável inexistente como 422", () => {
    const error = Object.assign(new Error("fk"), { code: "23503" });

    const mapped = mapDatabaseError(error);

    expect(mapped?.httpStatus).toBe(422);
    expect(mapped?.field).toBe("responsavelId");
  });

  it("devolve null para erro desconhecido, para não inventar explicação", () => {
    expect(mapDatabaseError(new Error("connection terminated"))).toBeNull();
    expect(mapDatabaseError(null)).toBeNull();
  });

  it("nunca expõe o detalhe técnico na mensagem exibível", () => {
    const error = Object.assign(
      new Error('insert into "clients" ... violates "clients_cpf_unique"'),
      { constraint: "clients_cpf_unique" },
    );

    const mapped = mapDatabaseError(error);

    expect(mapped?.userMessage).not.toContain("clients_cpf_unique");
    expect(mapped?.userMessage).not.toContain("insert into");
  });
});
