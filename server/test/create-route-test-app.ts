import express, { type Express, type Request, type RequestHandler, type Router } from "express";
import { JwtPayload } from "../lib/jwt";

type CreateRouteTestAppOptions = {
  router: Router;
  basePath?: string;
  rawBody?: boolean;
  middlewares?: RequestHandler[];
};

const JSON_LIMIT = "50mb";

type MockAuthOverrides = Partial<JwtPayload> & {
  /**
   * Unidade PDV da requisição. `null` desliga a injeção, para exercitar o 400
   * `NO_PDV_UNIT` do middleware real.
   */
  pdvUnitId?: string | null;
};

/**
 * Cria um middleware que injeta req.user diretamente (bypassa JWT para testes)
 */
export const createMockAuthMiddleware = (
  overrides: MockAuthOverrides = {},
): RequestHandler => {
  return (req, _res, next) => {
    req.user = {
      userId: overrides.userId ?? "test-user-id",
      role: overrides.role ?? "admin",
      email: overrides.email ?? "test@example.com",
      eventAccess: overrides.eventAccess,
    };
    // As rotas do PDV resolvem a unidade num middleware que consulta o banco
    // (`resolvePdvUnit`). Injetar aqui é o que mantém o project `unit` sem
    // banco: o middleware real tem curto-circuito quando `req.pdvUnitId` já
    // veio resolvido, então ele continua montado e testável.
    //
    // O `delete` é necessário, não redundante: `createRouteTestApp` monta um
    // mock padrão antes dos middlewares customizados, então ele já injetou
    // "test-unit-id". Só deixar de atribuir não desligava nada, e o `null`
    // documentado aqui nunca chegava a exercitar o 400 do middleware real.
    if (overrides.pdvUnitId === null) {
      delete req.pdvUnitId;
    } else {
      req.pdvUnitId = overrides.pdvUnitId ?? "test-unit-id";
    }
    next();
  };
};

export const createRouteTestApp = ({
  router,
  basePath = "/",
  rawBody = false,
  middlewares = [],
}: CreateRouteTestAppOptions): Express => {
  const app = express();

  app.use(
    express.json({
      limit: JSON_LIMIT,
      verify: rawBody
        ? (req, _res, buffer) => {
            (req as Request & { rawBody?: Buffer }).rawBody = buffer;
          }
        : undefined,
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: JSON_LIMIT }));

  // Injetar mock auth por padrão (pode ser sobrescrito via middlewares)
  app.use(createMockAuthMiddleware());

  for (const middleware of middlewares) {
    app.use(middleware);
  }

  app.use(basePath, router);

  return app;
};
