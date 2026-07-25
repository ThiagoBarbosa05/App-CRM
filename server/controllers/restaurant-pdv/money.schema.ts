import { z } from "zod";
import { MONEY_STRING_REGEX } from "../../../shared/restaurant-order-totals";

/**
 * Valor monetário vindo do cliente: string com ponto decimal e até 2 casas.
 *
 * Recusa `"33,34"` (vírgula pt-BR), `"abc"` e — o caso que motivou isto —
 * `"NaN"`. A coluna é `numeric`, e o Postgres **aceita** `'NaN'::numeric`:
 * `'NaN' > 0` é verdadeiro, então nenhum CHECK no banco barra o valor, e a
 * partir dele toda soma do caixa vira NaN. A defesa tem que ser na borda.
 *
 * Converter vírgula para ponto é responsabilidade da UI (`parseBRL`), não da
 * API — aceitar os dois formatos aqui esconderia bug de formulário.
 */
export const moneyString = z
  .string()
  .min(1, "Valor é obrigatório")
  .regex(
    MONEY_STRING_REGEX,
    "Valor inválido — use ponto como separador decimal, com até 2 casas (ex.: 33.34)",
  );

/** Igual a `moneyString`, mas recusa zero e negativo. */
export const positiveMoneyString = moneyString.refine(
  (value) => Number(value) > 0,
  "O valor deve ser maior que zero",
);
