// Fixa o processo em UTC: colunas `timestamp` (sem timezone) do Postgres são
// lidas pelo driver interpretando o valor bruto no timezone LOCAL do
// processo Node. A paginação por cursor em getEventsPaginated (server/storage.ts)
// depende de um round-trip Date -> toISOString() -> cast ::timestamp que só é
// estável se local === UTC; sem isso, rodar o processo num host não-UTC pode
// pular eventos silenciosamente nas bordas de página. Ver revisão final do
// plano docs/superpowers/plans/2026-07-20-dashboard-events-cursor-pagination.md.
//
// Nota: sob ESM, os `import`s abaixo são hoisted e avaliados antes deste
// `process.env.TZ`, então isso NÃO cobre efeitos colaterais em tempo de
// import (ex.: jobs que chamam `new Date()` ao carregar). Cobre apenas
// código que roda em tempo de request — que é o caso de getEventsPaginated.
process.env.TZ = "UTC";

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import "./jobs/birthday-job-scheduler";
import "./jobs/bling-token-refresh-scheduler";
import "./jobs/bling-sales-order-sync-scheduler";
import "./jobs/campaign-dispatcher";
import "./jobs/whatsapp-campaign-dispatcher";
import "./jobs/email-campaign-dispatcher";
import "./jobs/sms-campaign-dispatcher";
import "./jobs/rfm-recalculate-scheduler";
import "./jobs/copiloto-scan-scheduler";
import "./jobs/cashback-automation-scheduler";
import "./jobs/reengagement-automation-scheduler";
import "./jobs/quote-expiry-alert-scheduler";
import { startReconcileBaileysStatusJob } from "./jobs/reconcile-baileys-status.job";
import { startExpireBotSessionsJob } from "./jobs/expire-bot-sessions.job";
import { startResumeBotSessionsJob } from "./jobs/resume-bot-sessions.job";
import { startTemplateTimeoutsJob } from "./jobs/template-timeouts.job";
import { startUpdateExpiredEventsJob } from "./jobs/update-expired-events-scheduler";
import { startGatewayWebhookInboxWorker } from "./services/baileys-gateway-webhook-inbox.service";
import "./jobs/whatsapp-message-audit-retention.job";
import { startWhatsappCloudWebhookInboxWorker } from "./services/whatsapp-cloud-webhook-inbox.service";
import { assertGatewayConfiguration } from "./integrations/baileys-gateway";

import { storage } from "./storage";
import { getCachedPage, setCachedPage } from "./lib/landing-page-cache";
import { seedCountries } from "./jobs/seed-countries";
import { migrateWineryGoals } from "./jobs/migrate-winery-goals";
import { migrateCategoryGoals } from "./jobs/migrate-category-goals";
import { migratePdvSettings } from "./jobs/migrate-pdv-settings";
import { migrateOrderClient } from "./jobs/migrate-order-client";
import { migrateQuotes } from "./jobs/migrate-quotes";
import { migrateEventPricing } from "./jobs/migrate-event-pricing";
import { migrateEventResponsibleContacts } from "./jobs/migrate-event-responsible-contacts";
import { migrateEventBudgets } from "./jobs/migrate-event-budgets";
import { redactPii } from "./lib/log-redaction";
import { UsersService } from "./services/users.service";
// import "./jobs/umbler-sync-scheduler";

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));

// Lista explícita de origens do próprio frontend (produção + dev). Webhooks de
// terceiros (Twilio, ElevenLabs, Bling) são chamadas servidor-a-servidor sem
// header Origin e não passam por aqui — CORS só afeta requisições de navegador.
const allowedOrigins = Array.from(
  new Set(
    [
      process.env.CLIENT_URL,
      process.env.APP_URL,
      "https://crmgrandcru.replit.app",
      "http://localhost:5000",
      "https://1f0bbde6-1c5c-4e9a-82c3-ec21ba583692-00-hgbt6xeiwp4q.janeway.replit.dev",
    ].filter((origin): origin is string => !!origin),
  ),
);

app.use(
  cors({
    origin(origin, callback) {
      // Sem Origin (server-to-server, Twilio, Bling, etc.) ou origem permitida → OK
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      // Retorna false em vez de lançar Error — evita "unhandled exception" nos logs
      callback(null, false);
    },
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
        logLine += ` :: ${JSON.stringify(redactPii(capturedJsonResponse))}`;
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
  assertGatewayConfiguration();
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
  await migrateEventPricing();
  await migrateEventResponsibleContacts();
  await migrateEventBudgets();
  const server = await registerRoutes(app);
  seedCountries().catch((err) =>
    console.error("[Seed] seedCountries falhou:", err),
  );
  migrateWineryGoals().catch((err) =>
    console.error("[Migrate] migrateWineryGoals falhou:", err),
  );
  migrateCategoryGoals().catch((err) =>
    console.error("[Migrate] migrateCategoryGoals falhou:", err),
  );
  migratePdvSettings().catch((err) =>
    console.error("[Migrate] migratePdvSettings falhou:", err),
  );
  migrateOrderClient().catch((err) =>
    console.error("[Migrate] migrateOrderClient falhou:", err),
  );
  migrateQuotes().catch((err) =>
    console.error("[Migrate] migrateQuotes falhou:", err),
  );
  startExpireBotSessionsJob();
  startResumeBotSessionsJob();
  startTemplateTimeoutsJob();
  const expiredEventsJob = startUpdateExpiredEventsJob();
  expiredEventsJob.catchUp.catch((error) => {
    console.error("[ExpiredEvents] Catch-up inicial falhou:", error);
  });
  startReconcileBaileysStatusJob();
  startGatewayWebhookInboxWorker();
  startWhatsappCloudWebhookInboxWorker();

  // Rede de segurança para erros que escapam de um handler de rota. Na prática
  // quase nunca dispara (as rotas têm try/catch próprio), mas quando dispara
  // precisa terminar a requisição em vez de derrubar o processo.
  //
  // Antes ele fazia `throw err` depois de responder: um throw dentro de um
  // error middleware não volta para o Express — vira unhandled rejection, e o
  // stack não ia para lugar nenhum. Agora o erro é logado.
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    console.error(`[express] erro não tratado em ${req.method} ${req.path}:`, err);

    // Se a resposta já começou a ser enviada, só o handler padrão do Express
    // consegue encerrar a conexão corretamente.
    if (res.headersSent) return next(err);

    // Detalhe técnico fica no log; o cliente recebe uma frase genérica.
    const message =
      status >= 500
        ? "Não foi possível concluir a operação. Tente novamente."
        : err?.message || "Requisição inválida.";
    res.status(status).json({ message });
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

  // O processo do CRM não possui sockets WhatsApp para encerrar.
  const shutdown = (signal: string) => {
    log(`${signal} recebido, encerrando CRM...`);
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
})();
