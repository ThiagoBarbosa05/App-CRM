export interface RegistrationQualityField {
  key: "name" | "phone" | "cpf" | "birthday" | "email";
  label: string;
  filled: boolean;
}

export interface ClientRegistrationQuality {
  score: number;
  total: number;
  percent: number;
  fields: RegistrationQualityField[];
}

interface ClientRegistrationQualityInput {
  name: string | null | undefined;
  phone: string | null | undefined;
  cpf: string | null | undefined;
  birthday: string | null | undefined;
  email: string | null | undefined;
}

/**
 * Calcula a qualidade do cadastro do cliente com base no preenchimento de
 * NOME, CELULAR, CPF, DATA DE NASCIMENTO e EMAIL. Cada campo preenchido vale
 * 1 ponto (de um total de 5); usado tanto para o indicador visual da ficha
 * do cliente quanto (futuramente) para priorizar tarefas de vendedores em
 * clientes com bom histórico de compra mas cadastro incompleto.
 */
export function getClientRegistrationQuality(
  client: ClientRegistrationQualityInput,
): ClientRegistrationQuality {
  const fields: RegistrationQualityField[] = [
    { key: "name", label: "Nome", filled: !!client.name?.trim() },
    { key: "phone", label: "Celular", filled: !!client.phone?.trim() },
    { key: "cpf", label: "CPF", filled: !!client.cpf?.trim() },
    { key: "birthday", label: "Data de nascimento", filled: !!client.birthday?.trim() },
    { key: "email", label: "Email", filled: !!client.email?.trim() },
  ];

  const score = fields.filter((field) => field.filled).length;
  const total = fields.length;

  return {
    score,
    total,
    percent: Math.round((score / total) * 100),
    fields,
  };
}
