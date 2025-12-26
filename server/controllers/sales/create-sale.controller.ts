import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para criar uma nova venda
 *
 * @route POST /api/sales
 * @description Cria uma nova venda calculando automaticamente o uso de cashback,
 * valor líquido e cashback gerado. Atualiza o saldo de cashback do cliente.
 * @access Private (requer autenticação)
 *
 * @bodyParams {string} clientId - ID do cliente (obrigatório)
 * @bodyParams {string} date - Data da venda (obrigatório)
 * @bodyParams {number} grossValue - Valor bruto da venda (obrigatório)
 * @bodyParams {string} [notes] - Observações da venda
 * @bodyParams {string} [invoiceNumber] - Número da nota fiscal
 * @bodyParams {string} [userId] - ID do usuário que registrou a venda
 * @bodyParams {boolean} [useCashback=true] - Se deve usar cashback disponível (padrão: true)
 *
 * @returns {Object} Venda criada com saldo atualizado do cliente
 *
 * @example Request Body
 * {
 *   "clientId": "client-123",
 *   "date": "2025-12-25",
 *   "grossValue": 1000.00,
 *   "notes": "Venda de produtos",
 *   "invoiceNumber": "NF-001",
 *   "userId": "user-456",
 *   "useCashback": true
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "sale-id",
 *   "clientId": "client-123",
 *   "date": "2025-12-25",
 *   "grossValue": "1000.00",
 *   "cashbackUsed": "50.00",
 *   "netValue": "950.00",
 *   "cashbackGenerated": "95.00",
 *   "notes": "Venda de produtos",
 *   "invoiceNumber": "NF-001",
 *   "userId": "user-456",
 *   "useCashback": true,
 *   "clientCurrentBalance": "145.00"
 * }
 *
 * @notes
 * - Calcula automaticamente cashbackUsed (máximo 50% do valor bruto)
 * - Calcula netValue = grossValue - cashbackUsed
 * - Calcula cashbackGenerated baseado na configuração ativa
 * - Se useCashback = false, não usa saldo disponível
 * - Atualiza automaticamente o saldo do cliente via storage.createSale
 * - Retorna o saldo atualizado do cliente após a venda
 *
 * @throws {400} Campos obrigatórios faltando (clientId, date, grossValue)
 * @throws {500} Erro ao criar venda
 */
export const createSaleController = async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      date,
      grossValue,
      notes,
      invoiceNumber,
      userId,
      useCashback = true,
    } = req.body;

    if (!clientId || !date || !grossValue) {
      return res
        .status(400)
        .json({ message: "Campos obrigatórios: clientId, date, grossValue" });
    }

    // Buscar saldo atual de cashback do cliente
    const clientBalance = await storage.getClientCashbackBalance(clientId);
    const currentBalance = clientBalance
      ? parseFloat(clientBalance.currentBalance)
      : 0;

    // Buscar configuração ativa de cashback
    const settings = await storage.getCashbackSettings();
    const activeSetting = settings.find((s: any) => s.isActive === "true");

    // Calcular valores da venda
    let cashbackUsed = 0;
    if (useCashback === true && currentBalance > 0) {
      const maxCashbackUsage = grossValue * 0.5; // Máximo 50% do valor bruto
      cashbackUsed = Math.min(currentBalance, maxCashbackUsage);
    }
    // Garantir que se useCashback for false, cashbackUsed seja 0
    if (useCashback === false) {
      cashbackUsed = 0;
    }
    const netValue = grossValue - cashbackUsed;

    // Calcular cashback usando a configuração ativa
    let cashbackGenerated = 0;
    if (activeSetting) {
      const minimumPurchase = parseFloat(activeSetting.minimumPurchase || "0");
      if (netValue >= minimumPurchase) {
        const rate = parseFloat(activeSetting.percentageRate) / 100;
        cashbackGenerated = netValue * rate;

        // Aplicar limite máximo se definido
        if (activeSetting.maximumCashback) {
          const maxCashback = parseFloat(activeSetting.maximumCashback);
          cashbackGenerated = Math.min(cashbackGenerated, maxCashback);
        }
      }
    }

    // Registrar a venda
    const sale = await storage.createSale({
      clientId,
      date,
      grossValue,
      cashbackUsed,
      netValue,
      cashbackGenerated,
      notes,
      invoiceNumber,
      userId,
      useCashback,
    });

    // O saldo de cashback será atualizado automaticamente pelo createSale

    // Buscar o saldo atualizado do cliente após a venda
    const updatedClientBalance = await storage.getClientCashbackBalance(
      clientId
    );
    const updatedBalance = updatedClientBalance
      ? parseFloat(updatedClientBalance.currentBalance)
      : 0;

    res.status(201).json({
      ...sale,
      clientCurrentBalance: updatedBalance,
    });
  } catch (error) {
    console.error("Erro ao criar venda:", error);
    res.status(500).json({ message: "Erro ao criar venda" });
  }
};
