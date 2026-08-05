import { Response } from "express";
import { z } from "zod";
import { ClientOperationError } from "../../services/clients.errors";

/**
 * Resposta de erro padronizada do cadastro de clientes.
 *
 * `message` é sempre uma frase pronta para exibição; `errors` acompanha as
 * falhas de validação campo a campo, no mesmo formato do middleware
 * `validateBody` (server/middleware/validation.ts), para o formulário
 * conseguir destacar o campo em vez de só mostrar um toast.
 */
export interface ClientErrorResponse {
  message: string;
  field?: string;
  errors?: { field: string; message: string }[];
}

/**
 * Rótulo em português de cada campo do cadastro, com o gênero necessário para
 * montar a frase de obrigatoriedade. Sem isso as mensagens saem do drizzle-zod
 * em inglês (`Required at "categoria"`), que é o que o usuário vê hoje.
 */
const FIELD_LABELS: Record<string, { label: string; feminine?: boolean }> = {
  name: { label: "Nome" },
  phone: { label: "Celular" },
  fixedPhone: { label: "Telefone fixo" },
  cpf: { label: "CPF/CNPJ" },
  documentType: { label: "Tipo de documento" },
  nomeFantasia: { label: "Nome fantasia" },
  inscricaoEstadual: { label: "Inscrição estadual", feminine: true },
  email: { label: "E-mail" },
  instagram: { label: "Instagram" },
  birthday: { label: "Data de nascimento", feminine: true },
  sexo: { label: "Sexo" },
  cep: { label: "CEP" },
  address: { label: "Endereço" },
  number: { label: "Número" },
  complement: { label: "Complemento" },
  neighborhood: { label: "Bairro" },
  city: { label: "Cidade", feminine: true },
  state: { label: "Estado" },
  markers: { label: "Marcadores" },
  responsavelId: { label: "Responsável" },
  categoria: { label: "Categoria", feminine: true },
  origem: { label: "Origem", feminine: true },
};

function describeField(field: string): { label: string; feminine: boolean } {
  const known = FIELD_LABELS[field];
  return {
    label: known?.label ?? field,
    feminine: known?.feminine ?? false,
  };
}

/**
 * Traduz uma falha do Zod para uma frase em português.
 *
 * Mensagens de `refine` (código `custom`) já foram escritas por nós em
 * português — são repassadas como estão. As demais vêm do drizzle-zod em
 * inglês e são reescritas a partir do rótulo do campo.
 */
function describeIssue(issue: z.ZodIssue): { field: string; message: string } {
  const field = issue.path.join(".") || "formulário";

  if (issue.code === "custom") {
    return { field, message: issue.message };
  }

  const { label, feminine } = describeField(field);

  const isMissing =
    (issue.code === "invalid_type" &&
      (issue.received === "undefined" || issue.received === "null")) ||
    (issue.code === "too_small" && issue.type === "string" && issue.minimum === 1);

  if (isMissing) {
    return {
      field,
      message: `${label} ${feminine ? "é obrigatória" : "é obrigatório"}.`,
    };
  }

  if (issue.code === "invalid_enum_value") {
    return { field, message: `${label}: selecione uma das opções disponíveis.` };
  }

  return { field, message: `${label}: valor inválido.` };
}

/**
 * Responde a uma falha de criação/edição de cliente.
 *
 * Nunca devolve `error.message` de um erro desconhecido: o detalhe técnico vai
 * para o log e o usuário recebe uma frase genérica que diz o que fazer.
 */
export function respondWithClientError(
  res: Response,
  error: unknown,
  context: "create" | "update",
): Response {
  if (error instanceof z.ZodError) {
    const errors = error.errors.map(describeIssue);
    return res.status(400).json({
      message: errors[0]?.message ?? "Confira os dados preenchidos.",
      field: errors[0]?.field,
      errors,
    } satisfies ClientErrorResponse);
  }

  if (error instanceof ClientOperationError) {
    return res.status(error.httpStatus).json({
      message: error.userMessage,
      field: error.field,
    } satisfies ClientErrorResponse);
  }

  if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
    return res.status(404).json({
      message: "Cliente não encontrado. Ele pode ter sido excluído.",
    } satisfies ClientErrorResponse);
  }

  console.error(
    `Erro inesperado ao ${context === "create" ? "criar" : "atualizar"} cliente:`,
    error,
  );

  return res.status(500).json({
    message:
      context === "create"
        ? "Não foi possível cadastrar o cliente. Tente novamente em instantes."
        : "Não foi possível salvar as alterações. Tente novamente em instantes.",
  } satisfies ClientErrorResponse);
}
