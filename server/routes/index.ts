import { Router } from "express";
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

/**
 * Router principal que organiza todos os routers de domínio
 * Centraliza o ponto de entrada para todas as rotas da API
 */
export const apiRouter = Router();

/**
 * Registra routers por domínio
 * Cada domínio tem seu próprio arquivo de rotas
 */
apiRouter.use("/clients", clientsRouter);
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

// TODO: Adicionar outros routers conforme migração:
// apiRouter.use("/auth", authRouter);
// ✅ apiRouter.use("/companies", companiesRouter); - MIGRADO
// ✅ apiRouter.use("/funnels", funnelsRouter); - MIGRADO
// ✅ apiRouter.use("/deals", dealsRouter); - MIGRADO
// ✅ apiRouter.use("/deal-questions", dealQuestionsRouter); - MIGRADO
// ✅ apiRouter.use("/", dealAnswersRouter); - MIGRADO (deal-answers)
// ✅ apiRouter.use("/users", usersRouter); - MIGRADO
// apiRouter.use("/cashback", cashbackRouter);
// apiRouter.use("/reports", reportsRouter);
// apiRouter.use("/events", eventsRouter);
// apiRouter.use("/products", productsRouter);
// apiRouter.use("/integrations", integrationsRouter);
// apiRouter.use("/admin", adminRouter);
