/**
 * Erros de domínio do cadastro de clientes.
 *
 * Mesmo desenho de `BlingSyncError` (bling-clients-export.service.ts): a
 * mensagem exibível fica em `userMessage` e o detalhe técnico em `message`,
 * que nunca sai do log. Assim o controller responde sempre com uma frase em
 * português, sem nome de constraint, código do Postgres ou stack.
 */
export class ClientOperationError extends Error {
  readonly userMessage: string;
  readonly httpStatus: number;
  /** Campo do formulário que causou o erro, quando dá para apontar um. */
  readonly field?: string;

  constructor(
    userMessage: string,
    httpStatus: number,
    options?: { field?: string; technicalMessage?: string },
  ) {
    super(options?.technicalMessage ?? userMessage);
    this.name = "ClientOperationError";
    this.userMessage = userMessage;
    this.httpStatus = httpStatus;
    this.field = options?.field;
  }
}

/**
 * Constraints do Postgres que sabemos traduzir. A comparação é feita tanto
 * pelo campo `constraint` (driver `pg`/Neon o preenche em violações) quanto
 * pelo texto do erro, porque nem todo caminho preserva o objeto original.
 */
const UNIQUE_CONSTRAINTS: Record<
  string,
  { userMessage: string; field: string }
> = {
  clients_phone_unique: {
    userMessage: "Este número de telefone já está cadastrado para outro cliente.",
    field: "phone",
  },
  clients_cpf_unique: {
    userMessage: "Este CPF/CNPJ já está cadastrado para outro cliente.",
    field: "cpf",
  },
  clients_email_unique: {
    userMessage: "Este e-mail já está cadastrado para outro cliente.",
    field: "email",
  },
};

/**
 * Traduz um erro de banco em `ClientOperationError` quando é uma falha que o
 * usuário consegue corrigir (documento duplicado, responsável inexistente).
 * Retorna `null` para qualquer outra coisa — nesse caso o erro sobe intacto e
 * o controller responde 500 genérico, sem expor o motivo real.
 */
export function mapDatabaseError(error: unknown): ClientOperationError | null {
  if (!error) return null;

  const pgError = error as { code?: string; constraint?: string };
  const asText = String(error);

  const constraintName =
    pgError.constraint && pgError.constraint in UNIQUE_CONSTRAINTS
      ? pgError.constraint
      : Object.keys(UNIQUE_CONSTRAINTS).find((name) => asText.includes(name));

  if (constraintName) {
    const { userMessage, field } = UNIQUE_CONSTRAINTS[constraintName];
    return new ClientOperationError(userMessage, 409, {
      field,
      technicalMessage: `Violação de unicidade em ${constraintName}`,
    });
  }

  // 23503 = foreign_key_violation. Na prática só acontece com responsavelId
  // apontando para um usuário que foi removido.
  if (pgError.code === "23503" || asText.includes("foreign key constraint")) {
    return new ClientOperationError(
      "O responsável selecionado não está mais disponível. Escolha outro.",
      422,
      { field: "responsavelId", technicalMessage: asText },
    );
  }

  return null;
}

/** Duplicidade detectada por consulta prévia (não pela constraint). */
export function duplicateDocumentError(
  existingClientName: string,
): ClientOperationError {
  return new ClientOperationError(
    `Este CPF/CNPJ já está cadastrado para o cliente "${existingClientName}".`,
    409,
    { field: "cpf" },
  );
}

/**
 * Duplicidade de telefone detectada por consulta prévia.
 *
 * Não dá para depender só de `clients_phone_unique`: o UNIQUE é sobre o texto
 * cru e as linhas antigas de Bling/Connect/PDV estão gravadas em formatos
 * diferentes ("21975865422" vs "+5521975865422"), então a constraint não
 * dispara contra elas. A consulta prévia compara por dígitos, cobrindo o legado.
 */
export function duplicatePhoneError(
  existingClientName: string,
  existingCategoria?: string | null,
): ClientOperationError {
  const origin = existingCategoria ? ` (${existingCategoria})` : "";
  return new ClientOperationError(
    `Este telefone já está cadastrado para o cliente "${existingClientName}"${origin}.`,
    409,
    { field: "phone" },
  );
}

/** Duplicidade de e-mail detectada por consulta prévia. */
export function duplicateEmailError(
  existingClientName: string,
): ClientOperationError {
  return new ClientOperationError(
    `Este e-mail já está cadastrado para o cliente "${existingClientName}".`,
    409,
    { field: "email" },
  );
}
