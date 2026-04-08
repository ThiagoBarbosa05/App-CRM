import express, { type Express, type Request, type RequestHandler, type Router } from "express";

type RouteTestHeaders = {
  "x-user-id": string;
  "x-user-role": string;
};

type CreateRouteTestAppOptions = {
  router: Router;
  basePath?: string;
  rawBody?: boolean;
  middlewares?: RequestHandler[];
};

const JSON_LIMIT = "50mb";

export const createRouteTestHeaders = (
  overrides: Partial<RouteTestHeaders> = {},
): RouteTestHeaders => ({
  "x-user-id": overrides["x-user-id"] ?? "test-user-id",
  "x-user-role": overrides["x-user-role"] ?? "admin",
});

export const createRouteTestMiddleware = (
  middleware?: RequestHandler,
): RequestHandler => {
  if (middleware) {
    return middleware;
  }

  return (_req, _res, next) => {
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

  for (const middleware of middlewares) {
    app.use(middleware);
  }

  app.use(basePath, router);

  return app;
};
