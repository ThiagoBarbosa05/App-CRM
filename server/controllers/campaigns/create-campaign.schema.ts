import { z } from "zod";

/**
 * Schema de validação para criação de campanha
 */
export const createCampaignSchema = z.object({
  title: z
    .string()
    .min(3, "O título deve ter no mínimo 3 caracteres")
    .max(100, "O título deve ter no máximo 100 caracteres"),
  tagIds: z
    .array(z.string())
    .min(1, "Selecione pelo menos uma tag")
    .max(10, "Máximo de 10 tags por campanha"),
  exclusiveTagFilter: z.boolean().default(true),
  botId: z.string().min(1, "Selecione um bot"),
  botTriggerName: z.string().min(1, "Selecione um gatilho"),
  channelId: z.string().min(1, "Selecione um canal"),
  fromPhone: z.string().min(1, "Número de telefone do canal é obrigatório"),
  scheduledDate: z.string().datetime("Data inválida"),
  intervalSeconds: z
    .number()
    .int("Intervalo deve ser um número inteiro")
    .min(1, "Intervalo mínimo é 1 segundo")
    .max(60, "Intervalo máximo é 60 segundos")
    .default(5),
  cancelUpon: z.array(z.string()).default([]),
  organizationId: z.string().min(1, "Organization ID é obrigatório"),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
