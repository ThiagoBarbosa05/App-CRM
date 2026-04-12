import express, { type Express, type Request, type RequestHandler, type Router } from "express";
import { JwtPayload } from "../lib/jwt";

type CreateRouteTestAppOptions = {
  router: Router;
  basePath?: string;
  rawBody?: boolean;
  middlewares?: RequestHandler[];
};

const JSON_LIMIT = "50mb";

/**
 * Cria um middleware que injeta req.user diretamente (bypassa JWT para testes)
 */
export const createMockAuthMiddleware = (
  overrides: Partial<JwtPayload> = {},
): RequestHandler => {
  return (req, _res, next) => {
    req.user = {
      userId: overrides.userId ?? "test-user-id",
      role: overrides.role ?? "admin",
      email: overrides.email ?? "test@example.com",
    };
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
