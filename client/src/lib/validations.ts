import { z } from "zod";
import { isValidCpf, isValidCnpj } from "@shared/document";

/**
 * Valida se a pessoa é maior de idade (18 anos ou mais)
 */
const validateAdultAge = (dateStr: string): boolean => {
  if (!dateStr || dateStr.trim() === "") return true; // Se vazio, não valida

  let birthDate: Date;

  // Formato ISO (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    birthDate = new Date(dateStr);
  }
  // Formato brasileiro (DD/MM/YYYY)
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [day, month, year] = dateStr.split("/");
    birthDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } else {
    return false; // Formato inválido
  }

  if (isNaN(birthDate.getTime())) return false;

  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  // Verifica se já fez 18 anos
  if (age > 18) return true;
  if (age === 18) {
    if (monthDiff > 0) return true;
    if (monthDiff === 0 && dayDiff >= 0) return true;
  }

  return false;
};

export const clientValidationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || val.replace(/\D/g, "").length >= 10,
      "Celular deve ter pelo menos 10 dígitos",
    ),
  fixedPhone: z.string().optional().or(z.literal("")),
  documentType: z.enum(["cpf", "cnpj"]).default("cpf"),
  cpf: z
    .string()
    .optional()
    .or(z.literal(""))
    // Um documento pela metade era descartado silenciosamente no envio — o
    // usuário salvava e o CPF simplesmente sumia do cadastro.
    .refine((val) => {
      const digits = (val || "").replace(/\D/g, "");
      return digits.length === 0 || digits.length === 11 || digits.length === 14;
    }, "Informe o CPF completo (11 dígitos) ou o CNPJ completo (14 dígitos)")
    .refine((val) => {
      const digits = (val || "").replace(/\D/g, "");
      if (digits.length === 11) return isValidCpf(digits);
      if (digits.length === 14) return isValidCnpj(digits);
      return true;
    }, "CPF ou CNPJ inválido — confira os números digitados"),
  nomeFantasia: z.string().optional().or(z.literal("")),
  inscricaoEstadual: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  instagram: z.string().optional().or(z.literal("")),
  birthday: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || validateAdultAge(val),
      "Cliente deve ser maior de idade (18 anos ou mais)",
    ),
  sexo: z.enum(["M", "F"]).optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  complement: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  markers: z.array(z.string()).default([]),
  responsavelId: z.string().optional(),
  // `categoria` e `origem` são NOT NULL no banco e a UI já os marca com "*".
  // Como eram opcionais aqui, o cadastro passava vazio e o servidor gravava
  // "Geral"/"Website" sem avisar ninguém.
  categoria: z.string().min(1, "Selecione uma categoria"),
  origem: z.string().min(1, "Selecione a origem principal"),
  externalTagIds: z.array(z.string()).optional(), // IDs das tags do Umbler
});

export const dealValidationSchema = z.object({
  dealType: z.enum(["client", "company"], {
    required_error: "Tipo de negócio é obrigatório",
  }),
  clientId: z.string().optional(),
  companyId: z.string().optional(),
  title: z.string().optional(),
  funnelId: z.string().min(1, "Funil é obrigatório"),
  stageId: z.string().min(1, "Estágio é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  assignedTo: z.string().min(1, "Responsável é obrigatório"),
  createdBy: z.string().min(1, "Criador é obrigatório"),
  notes: z.string().optional(),
});

export const userValidationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  role: z.enum(["admin", "gerente", "vendedor", "eventos", "garcom"]),
  isActive: z.string().optional(),
});

export const salesFunnelValidationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional(),
  createdBy: z.string().min(1, "Criador é obrigatório"),
  isActive: z.string().optional(),
});

export const funnelStageValidationSchema = z.object({
  funnelId: z.string().min(1, "Funil é obrigatório"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  order: z.number().min(1, "Ordem deve ser maior que 0"),
  color: z.string().min(4, "Cor é obrigatória"),
});
