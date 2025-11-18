import { Request, Response } from "express";
import { cashbackSettingsService } from "../../services/cashback-settings.service";
import { insertCashbackTransactionSchema } from "../../../shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Controller para criação de transações de cashback
 *
 * @route POST /api/cashback-settings/transactions
 *
 * @requestBody
 * - clientId: string (required) - UUID do cliente
 * - dealId?: string - UUID do negócio relacionado
 * - purchaseAmount: string (required) - Valor da compra
 * - cashbackAmount: string (required) - Valor do cashback
 * - cashbackRate: string (required) - Taxa de cashback aplicada
 * - status: "pending" | "approved" | "expired" (required) - Status da transação
 * - settingId?: string - UUID da configuração de cashback utilizada
 * - processedBy?: string - UUID do usuário que processou
 * - notes?: string - Observações sobre a transação
 * - expiresAt?: Date - Data de expiração (calculada automaticamente se não fornecida)
 *
 * @returns {201} Transação criada com sucesso
 * @returns {400} Erro de validação dos dados
 * @returns {500} Erro interno do servidor
 *
 * @example
 * POST /api/cashback-settings/transactions
 * Body: {
 *   "clientId": "client-123",
 *   "dealId": "deal-456",
 *   "purchaseAmount": "1000.00",
 *   "cashbackAmount": "100.00",
 *   "cashbackRate": "10",
 *   "status": "approved",
 *   "settingId": "setting-789",
 *   "processedBy": "user-123",
 *   "notes": "Cashback da compra X"
 * }
 *
 * Response: {
 *   "id": "transaction-uuid",
 *   "clientId": "client-123",
 *   "dealId": "deal-456",
 *   "purchaseAmount": "1000.00",
 *   "cashbackAmount": "100.00",
 *   "cashbackRate": "10",
 *   "status": "approved",
 *   "expiresAt": "2025-12-15T00:00:00.000Z",
 *   "processedBy": "user-123",
 *   "settingId": "setting-789",
 *   "notes": "Cashback da compra X",
 *   "createdAt": "2025-11-17T10:30:00.000Z",
 *   "updatedAt": "2025-11-17T10:30:00.000Z"
 * }
 *
 * @notes
 * - Se expiresAt não for fornecido, é calculado automaticamente:
 *   - Se settingId estiver presente, usa expirationDays da configuração
 *   - Caso contrário, usa 28 dias como padrão
 * - Após criar a transação, atualiza automaticamente o saldo do cliente
 * - O saldo considera apenas cashbacks aprovados e não expirados
 * - Valida todos os campos obrigatórios usando Zod schema
 * - Retorna erro 400 com detalhes se validação falhar
 */
export async function createCashbackTransaction(req: Request, res: Response) {
  try {
    const data = req.body;

    // Validar dados usando schema
    const validatedData = insertCashbackTransactionSchema.parse(data);

    // Criar transação (service calcula expiresAt e atualiza saldo do cliente)
    const transaction = await cashbackSettingsService.createCashbackTransaction(
      validatedData
    );

    res.status(201).json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar transação:", error);
    res.status(500).json({ message: "Erro ao criar transação" });
  }
}
