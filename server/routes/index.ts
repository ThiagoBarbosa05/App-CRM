import { Router } from "express";
import { requireAuth } from "../middleware/validation";
import { clientsRouter } from "./clients.routes";
import { companiesRouter } from "./companies.routes";
import { funnelsRouter } from "./funnels.routes";
import { dealsRouter } from "./deals.routes";
import { dealQuestionsRouter } from "./deal-questions.routes";
import { dealAnswersRouter } from "./deal-answers.routes";
import { usersRouter } from "./users.routes";
import { birthdaysRouter } from "./birthdays.routes";
import tagsRouter, {
  categoriesRouter,
  originsRouter,
  markersRouter,
} from "./tags.routes";
import { interactionsRouter } from "./interactions.routes";
import { cashbackSettingsRouter } from "./cashback-settings.routes";
import { cashbackRouter } from "./cashback.routes";
import { salesRouter } from "./sales.routes";
import { sectorsRouter } from "./sectors.routes";
import weeklyResultsRouter from "./weekly-results.routes";
import automationTriggersRouter from "./automation-triggers";
import automationExecutionRouter from "./automation-execution.routes";
import userGoalsRouter, {
  userGoalsWithResultsRouter,
  userRegistrationStatsRouter,
} from "./user-goals.routes";
import blingRouter from "./bling-orders.routes";
import { messageJobsLogsRouter } from "./message-jobs-logs.routes";
import {
  telemarketingGoalsRouter,
  telemarketingStatsRouter,
} from "./telemarketing-goals.routes";
import blingAccountsRouter from "./bling-accounts.routes";
import blingProductsRouter from "./bling-products.routes";
import connectOrdersRouter from "./connect-orders.routes";
import unifiedOrdersRouter from "./unified-orders.routes";
import blingWebhookRouter from "./bling-webhook.routes";
import systemSettingsRouter from "./system-settings.routes";
import telephonySettingsRouter from "./telephony-settings.routes";
import twilioRouter from "./twilio.routes";
import callsRouter from "./calls.routes";
import campaignsRouter from "./campaigns.routes";
import elevenLabsRouter from "./elevenlabs.routes";
import { authRouter } from "./auth.routes";
import { filesRouter } from "./files.routes";
import { acompanhamentoRouter } from "./acompanhamento.routes";
import { umblerRouter } from "./umbler.routes"; // @deprecated — Etapa 14: remover após migração WA completa
import waRouter from "./whatsapp.routes";
import { reportsRouter } from "./reports.routes";
import { companyProductsRouter, productsRouter } from "./products.routes";
import { productCategoriesRouter } from "./product-categories.routes";
import { clientDebtsRouter } from "./client-debts.routes";
import { dashboardRouter } from "./dashboard.routes";
import { trainingsRouter } from "./trainings.routes";
import { eventsRouter } from "./events.routes";
import { templatesRouter } from "./templates.routes";
import { birthdayAutomationRouter } from "./birthday-automation.routes";
import { healthRouter } from "./health.routes";
import { adminRouter } from "./admin.routes";
import { tasksRouter } from "./tasks.routes";
import { taskStagesRouter } from "./task-stages.routes";
import { taskBoardsRouter } from "./task-boards.routes";
import { noteSectionsRouter } from "./note-sections.routes";
import { notesRouter } from "./notes.routes";
import { taskFileFoldersRouter } from "./task-file-folders.routes";
import { taskFilesRouter } from "./task-files.routes";
import { messageAutomationSettingsRouter } from "./message-automation-settings.routes";
import {
  clientRegistrationGoalsRouter,
  clientRegistrationStatsRouter,
} from "./client-registration-goals.routes";
import { markerGoalsRouter, markerStatsRouter } from "./marker-goals.routes";
import {
  interactionGoalsRouter,
  interactionStatsRouter,
} from "./interaction-goals.routes";
import { referralsRouter } from "./referrals.routes";
import rfmRouter from "./rfm.routes";
import whatsappRouter from "./whatsapp-settings.routes";
import whatsappWebhookRouter from "./whatsapp-webhook.routes";
import evolutionWebhookRouter from "./evolution-webhook.routes";
import whatsappBotsRouter from "./whatsapp-bots.routes";
import whatsappConversationsRouter from "./whatsapp-conversations.routes";
import whatsappChannelsRouter from "./whatsapp-channels.routes";
import whatsappFlowsRouter from "./whatsapp-flows.routes";
import whatsappMonitorRouter from "./whatsapp-monitor.routes";
import { umblerTagImportRouter } from "./umbler-tag-import.routes";
import { mediaLibraryRouter } from "./media-library.routes";
import assertivaRouter from "./assertiva.routes";

/**
 * Router principal que organiza todos os routers de domínio
 * Centraliza o ponto de entrada para todas as rotas da API
 */
export const apiRouter = Router();

// === ROTAS PÚBLICAS (sem autenticação) ===
// Devem ser registradas ANTES do middleware requireAuth
apiRouter.use("/auth", authRouter);
apiRouter.use("/health", healthRouter);
// Webhook do Bling — sem autenticação de usuário (usa HMAC próprio)
apiRouter.use("/bling", blingWebhookRouter);
apiRouter.use("/bling-accounts", blingAccountsRouter);
// Webhooks Twilio/ElevenLabs — chamados pelos serviços externos sem JWT
// Os handlers protegidos nesses routers verificam req.user manualmente
apiRouter.use("/twilio", twilioRouter);
// Webhook WhatsApp Cloud API — verificação GET e notificações POST do Meta
apiRouter.use("/whatsapp", whatsappWebhookRouter);
// Webhook Evolution API — eventos de instâncias Baileys (QR, mensagens, status)
apiRouter.use("/evolution", evolutionWebhookRouter);
apiRouter.use("/calls", callsRouter);
apiRouter.use("/elevenlabs", elevenLabsRouter);

// === AUTENTICAÇÃO GLOBAL ===
// Todas as rotas registradas abaixo exigem JWT válido no cookie auth_token
apiRouter.use(requireAuth);

// === ROTAS PROTEGIDAS ===
apiRouter.use("/referrals", referralsRouter);
apiRouter.use("/rfm", rfmRouter);
apiRouter.use("/clients", clientsRouter);
apiRouter.use("/files", filesRouter);
apiRouter.use("/acompanhamento", acompanhamentoRouter);
apiRouter.use("/", umblerRouter); // @deprecated — manter até Etapa 14
apiRouter.use("/whatsapp", waRouter);
apiRouter.use("/reports", reportsRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/product-categories", productCategoriesRouter);
apiRouter.use("/", companyProductsRouter);
apiRouter.use("/client-debts", clientDebtsRouter);
apiRouter.use("/dashboard", dashboardRouter);
apiRouter.use("/", trainingsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/", templatesRouter);
apiRouter.use("/birthday-automation", birthdayAutomationRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/message-automation-settings", messageAutomationSettingsRouter);
apiRouter.use("/companies", companiesRouter);
apiRouter.use("/funnels", funnelsRouter);
apiRouter.use("/deals", dealsRouter);
apiRouter.use("/deal-questions", dealQuestionsRouter);
apiRouter.use("/", dealAnswersRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/birthdays", birthdaysRouter);
apiRouter.use("/tags", tagsRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/origins", originsRouter);
apiRouter.use("/markers", markersRouter);
apiRouter.use("/interactions", interactionsRouter);
apiRouter.use("/cashback-settings", cashbackSettingsRouter);
apiRouter.use("/", cashbackRouter);
apiRouter.use("/", salesRouter);
apiRouter.use("/", sectorsRouter);
apiRouter.use("/automations", automationTriggersRouter);
apiRouter.use("/automation", automationExecutionRouter);
apiRouter.use("/user-goals", userGoalsRouter);
apiRouter.use("/bling-orders", blingRouter);
apiRouter.use("/user-goals-with-results", userGoalsWithResultsRouter);
apiRouter.use("/user-registration-stats", userRegistrationStatsRouter);
apiRouter.use("/weekly-results", weeklyResultsRouter);
apiRouter.use("/message-jobs-logs", messageJobsLogsRouter);
apiRouter.use("/telemarketing-goals", telemarketingGoalsRouter);
apiRouter.use("/telemarketing-stats", telemarketingStatsRouter);
apiRouter.use("/client-registration-goals", clientRegistrationGoalsRouter);
apiRouter.use("/client-registration-stats", clientRegistrationStatsRouter);
apiRouter.use("/marker-goals", markerGoalsRouter);
apiRouter.use("/marker-stats", markerStatsRouter);
apiRouter.use("/interaction-goals", interactionGoalsRouter);
apiRouter.use("/interaction-stats", interactionStatsRouter);
apiRouter.use("/bling-products", blingProductsRouter);
apiRouter.use("/connect-orders", connectOrdersRouter);
apiRouter.use("/unified-orders", unifiedOrdersRouter);
apiRouter.use("/system-settings", systemSettingsRouter);
apiRouter.use("/telephony-settings", telephonySettingsRouter);
apiRouter.use("/whatsapp", whatsappRouter);
apiRouter.use("/whatsapp", whatsappBotsRouter);
apiRouter.use("/whatsapp", whatsappConversationsRouter);
apiRouter.use("/whatsapp", whatsappChannelsRouter);
apiRouter.use("/whatsapp", whatsappFlowsRouter);
apiRouter.use("/whatsapp", whatsappMonitorRouter);
apiRouter.use("/", umblerTagImportRouter);
apiRouter.use("/campaigns", campaignsRouter);
apiRouter.use("/tasks", tasksRouter);
apiRouter.use("/task-stages", taskStagesRouter);
apiRouter.use("/task-boards", taskBoardsRouter);
apiRouter.use("/note-sections", noteSectionsRouter);
apiRouter.use("/notes", notesRouter);
apiRouter.use("/task-file-folders", taskFileFoldersRouter);
apiRouter.use("/task-files", taskFilesRouter);
apiRouter.use("/media-library", mediaLibraryRouter);
apiRouter.use("/integrations/assertiva", assertivaRouter);
