import { z } from "zod";
import { validateCpf } from "./utils";

export const clientValidationSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  cpf: z.string().refine(validateCpf, "CPF inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  birthday: z.string().min(1, "Data de aniversário é obrigatória"),
  cep: z.string().min(8, "CEP deve ter 8 dígitos"),
  address: z.string().min(5, "Endereço deve ter pelo menos 5 caracteres"),
  number: z.string().min(1, "Número é obrigatório"),
  neighborhood: z.string().min(2, "Bairro deve ter pelo menos 2 caracteres"),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado é obrigatório"),
  markers: z.array(z.string()).optional(),
  responsible: z.string().min(2, "Responsável deve ter pelo menos 2 caracteres"),
  categoria: z.string().min(1, "Categoria é obrigatória"),
  origem: z.string().min(1, "Origem é obrigatória"),
});

export const dealValidationSchema = z.object({
  title: z.string().min(3, "Título deve ter pelo menos 3 caracteres"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  value: z.string().min(1, "Valor é obrigatório"),
  stage: z.enum(["prospeccao", "negociacao", "fechamento"]),
  notes: z.string().optional(),
});
