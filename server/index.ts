import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "./jobs/birthday-job-scheduler";
import "./jobs/update-expired-events-scheduler";
import "./jobs/bling-token-refresh-scheduler";
import "./jobs/campaign-dispatcher";
import "./jobs/whatsapp-campaign-dispatcher";
import { startExpireBotSessionsJob } from "./jobs/expire-bot-sessions.job";
import { startResumeBotSessionsJob } from "./jobs/resume-bot-sessions.job";
import { db } from "./db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { getCachedPage, setCachedPage } from "./lib/landing-page-cache";
// import "./jobs/umbler-sync-scheduler";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      (req as Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

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
  // Rota pública de landing pages de eventos — registrada ANTES do Vite
  // para que /lp/:slug não seja capturada pelo catch-all do SPA
  const r2Client = new S3Client({
    region: "auto",
    endpoint: process.env.CLOUDFLARE_URL,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });

  app.get("/lp/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;

      const cached = getCachedPage(slug);
      if (cached) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=300");
        return res.send(cached);
      }

      const event = await storage.getEventBySlug(slug);

      if (!event || !event.landingPageHtmlKey) {
        return res.status(404).send("<h1>Página não encontrada</h1>");
      }

      const command = new GetObjectCommand({
        Bucket: "crm-test",
        Key: event.landingPageHtmlKey,
      });

      const r2Response = await r2Client.send(command);

      if (!r2Response.Body) {
        return res.status(404).send("<h1>Página não encontrada</h1>");
      }

      const bodyStream = r2Response.Body as NodeJS.ReadableStream;
      const cacheChunks: Buffer[] = [];

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300");

      bodyStream.on("data", (chunk: Buffer) =>
        cacheChunks.push(Buffer.from(chunk)),
      );
      bodyStream.on("end", () =>
        setCachedPage(slug, Buffer.concat(cacheChunks)),
      );
      bodyStream.pipe(res);
      return;
    } catch (error) {
      console.error("Error serving landing page:", error);
      return res.status(500).send("<h1>Erro ao carregar a página</h1>");
    }
  });
  const server = await registerRoutes(app);
  startExpireBotSessionsJob();
  startResumeBotSessionsJob();

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
      host: "127.0.0.1",
      // host: "0.0.0.0",
      // reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // Graceful shutdown handlers
  process.on("SIGTERM", () => {
    log("SIGTERM recebido, encerrando gracefully...");
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("SIGINT recebido, encerrando gracefully...");
    process.exit(0);
  });
})();
