import { Request, Response } from "express";
import { z } from "zod";
import { resolveOrCreateAudienceClients } from "../../services/clients-import-audience.service";

/**
 * Contrato do corpo da requisição. Vive aqui, e não no arquivo de rotas, para
 * poder ser importado num teste sem arrastar o router inteiro de clientes (e,
 * com ele, `server/db`).
 */
export const importAudienceSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().max(200),
        phone: z.string().trim().max(40),
        rowNumber: z.number().int().nonnegative(),
      }),
    )
    .min(1, "Envie ao menos um contato")
    // Teto para não deixar um upload acidental de planilha gigante virar
    // milhares de INSERTs em série numa única requisição HTTP.
    .max(5000, "Máximo de 5000 contatos por importação"),
  categoria: z.string().trim().min(1, "Categoria é obrigatória"),
  origem: z.string().trim().min(1, "Origem é obrigatória"),
  markers: z.array(z.string().trim().min(1)).max(10).default([]),
});

/**
 * @route POST /api/clients/import-audience
 * @description Converte linhas de uma planilha (nome + telefone) em clientes do
 *              CRM e devolve os IDs, para uso como audiência `explicit` de uma
 *              campanha de WhatsApp. Contatos já cadastrados são reaproveitados
 *              (casamento por telefone, tolerante a DDI e 9º dígito) em vez de
 *              duplicados.
 * @access Private (requireAuth)
 * @bodyParams {Array<{name, phone, rowNumber}>} rows - Linhas já parseadas no cliente
 * @bodyParams {string} categoria - Categoria a aplicar nos clientes criados
 * @bodyParams {string} origem - Origem a aplicar nos clientes criados
 * @bodyParams {string[]} [markers=[]] - Marcadores a aplicar nos clientes criados
 * @returns {Object} 200 - { clientIds, created, matched, optedOut, rejected[] }
 * @returns {Object} 400 - Payload inválido
 * @returns {Object} 500 - Erro interno
 */
export async function postImportAudienceController(req: Request, res: Response) {
  try {
    const { rows, categoria, origem, markers } = req.body;

    const result = await resolveOrCreateAudienceClients({
      rows,
      categoria,
      origem,
      markers,
      userId: req.user?.userId,
      userRole: req.user?.role,
    });

    res.json(result);
  } catch (error) {
    console.error("[postImportAudience]", error);
    res.status(500).json({ message: "Erro ao importar contatos da planilha." });
  }
}
