import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "./jobs/birthday-job-scheduler";
import "./jobs/update-expired-events-scheduler";
import {
  initializePubSubSubscriber,
  shutdownPubSubSubscriber,
} from "./jobs/pubsub-subscriber";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      // host: "127.0.0.1",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);

      // Inicializa o consumidor do Pub/Sub após o servidor estar rodando
      initializePubSubSubscriber().catch((error) => {
        console.error(
          "[Server] Erro ao inicializar Pub/Sub subscriber:",
          error
        );
      });
    }
  );

  // Graceful shutdown handlers
  process.on("SIGTERM", async () => {
    log("SIGTERM recebido, encerrando gracefully...");
    await shutdownPubSubSubscriber();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    log("SIGINT recebido, encerrando gracefully...");
    await shutdownPubSubSubscriber();
    process.exit(0);
  });
})();
