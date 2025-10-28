import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * @route POST /api/clients
 * @description Cria um novo cliente no sistema
 * @access Private (baseado em role do usuário)
 * @bodyParams {string} name - Nome completo do cliente (obrigatório)
 * @bodyParams {string} phone - Telefone do cliente (obrigatório, único)
 * @bodyParams {string} [email] - Email do cliente (opcional)
 * @bodyParams {string} [cpf] - CPF do cliente (opcional)
 * @bodyParams {string} [birthday] - Data de nascimento (opcional)
 * @bodyParams {string} [categoria="Geral"] - Categoria do cliente (default: "Geral")
 * @bodyParams {string} [origem="Website"] - Origem do lead (default: "Website")
 * @bodyParams {string} [responsavelId] - ID do responsável (se não admin, usa usuário atual)
 * @bodyParams {string[]} [markers=[]] - Array de marcadores/tags
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/admin)
 * @returns {Object} 201 - Cliente criado com sucesso
 * @returns {Object} 400 - Erro de validação ou telefone duplicado
 * @returns {Object} 500 - Erro interno do servidor
 */
export const postClientController = async (req: Request, res: Response) => {
  try {
    console.log(
      "Dados recebidos para criação de cliente:",
      JSON.stringify(req.body, null, 2)
    );

    // Processar parâmetros da requisição
    const createClientParams = clientsService.processCreateClientParams(req);

    // Criar cliente através do service
    const client = await clientsService.createClient(createClientParams);

    res.status(201).json(client);
  } catch (error) {
    console.error("Erro no postClientController:", error);

    // Tratamento específico para erros de validação Zod
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      console.error("Erro de validação Zod:", validationError.toString());
      return res.status(400).json({
        message: validationError.toString(),
      });
    }

    // Tratamento específico para telefone duplicado
    if (
      error instanceof Error &&
      error.message.includes("telefone já está cadastrado")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Erro genérico do servidor
    res.status(500).json({
      message: "Erro ao criar cliente",
    });
  }
};
