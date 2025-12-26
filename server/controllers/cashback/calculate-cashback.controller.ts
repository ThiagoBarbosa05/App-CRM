import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para calcular o valor de cashback baseado em uma compra
 *
 * @route POST /api/cashback-settings/calculate
 * @access Private
 *
 * @param {Object} req.body - Dados da compra
 * @param {number} req.body.purchaseAmount - Valor bruto da compra
 * @param {number} [req.body.netAmount] - Valor líquido (opcional, priorizado se fornecido)
 *
 * @returns {Object} Cálculo do cashback
 * @returns {number} cashbackAmount - Valor calculado de cashback
 * @returns {number} rate - Taxa percentual aplicada
 * @returns {Object|null} setting - Configuração de cashback utilizada
 *
 * @description
 * Calcula o cashback baseado nas configurações ativas do sistema:
 * - Busca configuração ativa de cashback
 * - Valida valor mínimo de compra
 * - Aplica taxa percentual
 * - Respeita limite máximo de cashback
 * - Prioriza netAmount sobre purchaseAmount se fornecido
 *
 * @example Request Body
 * {
 *   "purchaseAmount": 1000.00,
 *   "netAmount": 950.00
 * }
 *
 * @example Success Response (200)
 * {
 *   "cashbackAmount": 95.00,
 *   "rate": 10,
 *   "setting": {
 *     "id": "setting-id",
 *     "name": "Cashback Padrão",
 *     "percentageRate": "10",
 *     "minimumPurchase": "100",
 *     "maximumCashback": "500",
 *     "isActive": "true"
 *   }
 * }
 *
 * @example No Active Settings Response (200)
 * {
 *   "cashbackAmount": 0,
 *   "rate": 0,
 *   "setting": null
 * }
 *
 * @example Below Minimum Response (200)
 * {
 *   "cashbackAmount": 0,
 *   "rate": 0,
 *   "setting": { ... }
 * }
 *
 * @example Error Response (400)
 * {
 *   "message": "Valor de compra inválido"
 * }
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao calcular cashback"
 * }
 */
export const calculateCashbackController = async (
  req: Request,
  res: Response
) => {
  try {
    const { purchaseAmount, netAmount } = req.body;

    // Use netAmount if provided, otherwise fall back to purchaseAmount
    const valueForCalculation = netAmount || purchaseAmount;

    // Validar valor de compra
    if (!valueForCalculation || valueForCalculation <= 0) {
      return res.status(400).json({ message: "Valor de compra inválido" });
    }

    // Buscar configurações ativas de cashback
    const settings = await storage.getCashbackSettings();
    const activeSetting = settings.find((s) => s.isActive === "true");

    // Retornar zero se não houver configuração ativa
    if (!activeSetting) {
      return res.json({
        cashbackAmount: 0,
        rate: 0,
        setting: null,
      });
    }

    // Extrair parâmetros da configuração ativa
    const rate = parseFloat(activeSetting.percentageRate);
    const minPurchase = parseFloat(activeSetting.minimumPurchase || "0");
    const maxCashback = activeSetting.maximumCashback
      ? parseFloat(activeSetting.maximumCashback)
      : null;

    // Verificar se atinge o valor mínimo de compra
    if (valueForCalculation < minPurchase) {
      return res.json({
        cashbackAmount: 0,
        rate: 0,
        setting: activeSetting,
      });
    }

    // Calcular cashback baseado na taxa percentual
    let cashbackAmount = (valueForCalculation * rate) / 100;

    // Aplicar limite máximo se configurado
    if (maxCashback && cashbackAmount > maxCashback) {
      cashbackAmount = maxCashback;
    }

    // Retornar resultado do cálculo
    res.json({
      cashbackAmount,
      rate,
      setting: activeSetting,
    });
  } catch (error) {
    console.error("Erro ao calcular cashback:", error);
    res.status(500).json({ message: "Erro ao calcular cashback" });
  }
};
