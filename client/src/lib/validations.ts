import { z } from "zod";
import { validateCpf } from "./utils";

export const clientValidationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  cpf: z.string().optional().refine((val) => !val || validateCpf(val), "CPF inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  birthday: z.string().optional().or(z.literal("")),
  cep: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  number: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  markers: z.array(z.string()).default([]),
  responsavelId: z.string().optional(),
  categoria: z.string().optional().or(z.literal("")),
  origem: z.string().optional().or(z.literal("")),
});

export const dealValidationSchema = z.object({
  clientId: z.string().min(1, "Cliente é obrigatório"),
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
  role: z.enum(["admin", "gerente", "vendedor"]),
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
