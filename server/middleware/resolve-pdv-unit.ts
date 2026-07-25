import type { RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { pdvUnits, users } from "../../shared/schema";

/**
 * Resolve a unidade PDV da requisição em `req.pdvUnitId`.
 *
 * Garçom: a unidade vem do vínculo dele no banco — não do cliente, senão
 * bastaria trocar um header para operar o caixa de outro restaurante.
 * Admin/gerente: vem do header `X-PDV-Unit-Id`, porque eles trocam de unidade
 * pela interface.
 *
 * O header é **candidato**, não verdade: antes era aceito como veio, sem
 * conferir se a unidade existe ou está ativa. Um valor inventado virava
 * `req.pdvUnitId` e passava a filtrar consultas por um id que não existe —
 * telas vazias sem erro, e comandas criadas apontando para o nada.
 *
 * O `try/catch` é obrigatório: o Express 4 não captura rejeição de handler
 * `async`. Sem ele, uma falha no banco pendura a requisição até o timeout do
 * cliente e derruba todo o PDV atrás de um `unhandledRejection`.
 */
export const resolvePdvUnit: RequestHandler = async (req, res, next) => {
  try {
    // Já resolvido a montante (teste de rota, ou outro middleware): respeitar.
    // É o único ponto de injeção — nada vindo de header chega aqui direto.
    if (req.pdvUnitId) return next();

    const userId = req.user?.userId;
    if (!userId) return next(); // Rotas sem autenticação passam direto

    let candidate: string | undefined;

    if (req.user?.role === "garcom") {
      const [user] = await db
        .select({ pdvUnitId: users.pdvUnitId })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user?.pdvUnitId) {
        return res.status(400).json({
          message: "Garçom não vinculado a nenhuma unidade PDV. Fale com o administrador.",
          code: "NO_PDV_UNIT",
        });
      }
      candidate = user.pdvUnitId;
    } else {
      candidate = req.headers["x-pdv-unit-id"] as string | undefined;
      if (!candidate) {
        return res.status(400).json({
          message: "Selecione uma unidade PDV para continuar.",
          code: "NO_PDV_UNIT",
        });
      }
    }

    const [unit] = await db
      .select({ id: pdvUnits.id })
      .from(pdvUnits)
      .where(and(eq(pdvUnits.id, candidate), eq(pdvUnits.isActive, true)))
      .limit(1);

    if (!unit) {
      return res.status(400).json({
        message: "Unidade PDV inválida ou inativa.",
        code: "INVALID_PDV_UNIT",
      });
    }

    req.pdvUnitId = unit.id;
    return next();
  } catch (error) {
    return next(error);
  }
};
