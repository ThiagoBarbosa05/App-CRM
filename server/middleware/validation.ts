import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { verifyToken } from "../lib/jwt";

// Middleware de validação genérico
export function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = schema.parse(req.body);
      req.body = validatedData; // Substitui o body com dados validados
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          message: "Dados de entrada inválidos",
          errors: validationErrors,
        });
      }
      next(error);
    }
  };
}

// Middleware de validação de parâmetros de URL
export function validateParams(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedParams = schema.parse(req.params);
      req.params = validatedParams;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          message: "Parâmetros de URL inválidos",
          errors: validationErrors,
        });
      }
      next(error);
    }
  };
}

// Middleware de validação de query parameters
export function validateQuery(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedQuery = schema.parse(req.query);
      req.query = validatedQuery;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          message: "Parâmetros de consulta inválidos",
          errors: validationErrors,
        });
      }
      next(error);
    }
  };
}

// Schemas de validação para os endpoints
export const dealQuestionParamsSchema = z.object({
  id: z.string().uuid("ID deve ser um UUID válido"),
});

export const dealAnswersParamsSchema = z.object({
  dealId: z.string().uuid("ID do deal deve ser um UUID válido"),
});

export const dealQuestionsQuerySchema = z
  .object({
    isActive: z.enum(["true", "false"]).optional(),
  })
  .partial();

export const saveDealAnswersBodySchema = z.object({
  answers: z
    .array(
      z
        .object({
          dealId: z.string().uuid("ID do deal deve ser um UUID válido"),
          questionId: z.string().uuid("ID da pergunta deve ser um UUID válido"),
          answerBoolean: z.boolean().optional(),
          answerNumber: z
            .union([z.string(), z.number()])
            .optional()
            .nullable()
            .transform((val) => {
              if (val === null || val === undefined || val === "")
                return undefined;
              const num = typeof val === "string" ? parseFloat(val) : val;
              return isNaN(num) ? undefined : num.toString();
            }),
          answerText: z
            .string()
            .optional()
            .nullable()
            .transform((val) => {
              if (val === null || val === "" || val === undefined)
                return undefined;
              return val;
            }),
        })
        .refine(
          (data) => {
            // Garantir que apenas um campo de resposta esteja preenchido
            // Usar typeof para distinguir boolean false de undefined
            const hasBoolean = typeof data.answerBoolean === "boolean";
            const hasNumber =
              data.answerNumber !== undefined && data.answerNumber !== "";
            const hasText =
              data.answerText !== undefined && data.answerText !== "";

            const filledFields = [hasBoolean, hasNumber, hasText].filter(
              Boolean
            ).length;

            return filledFields === 1;
          },
          {
            message: "Apenas um campo de resposta deve estar preenchido",
          }
        )
    )
    .min(1, "Pelo menos uma resposta deve ser fornecida"),
});

// Middleware de autenticação via JWT cookie
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.["auth_token"] as string | undefined;
  if (!token) {
    return res.status(401).json({
      message: "Usuário não autenticado",
      code: "UNAUTHORIZED",
    });
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({
      message: "Sessão inválida ou expirada",
      code: "UNAUTHORIZED",
    });
  }
}

// Middleware de tratamento de erros global
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("Erro não tratado:", error);

  // Se já foi enviada uma resposta, passar para o Express
  if (res.headersSent) {
    return next(error);
  }

  // Erros de validação do Zod
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Erro de validação",
      errors: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      })),
    });
  }

  // Erro padrão
  res.status(500).json({
    message: "Erro interno do servidor",
    code: "INTERNAL_SERVER_ERROR",
    ...(process.env.NODE_ENV === "development" && { error: error.message }),
  });
}
