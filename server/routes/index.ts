import { Router } from "express";
import { clientsRouter } from "./clients.routes";
import { companiesRouter } from "./companies.routes";
import { funnelsRouter } from "./funnels.routes";
import { dealsRouter } from "./deals.routes";
import { dealQuestionsRouter } from "./deal-questions.routes";
import { dealAnswersRouter } from "./deal-answers.routes";

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

// TODO: Adicionar outros routers conforme migração:
// apiRouter.use("/auth", authRouter);
// ✅ apiRouter.use("/companies", companiesRouter); - MIGRADO
// ✅ apiRouter.use("/funnels", funnelsRouter); - MIGRADO
// ✅ apiRouter.use("/deals", dealsRouter); - MIGRADO
// ✅ apiRouter.use("/deal-questions", dealQuestionsRouter); - MIGRADO
// ✅ apiRouter.use("/", dealAnswersRouter); - MIGRADO (deal-answers)
// apiRouter.use("/users", usersRouter);
// apiRouter.use("/cashback", cashbackRouter);
// apiRouter.use("/reports", reportsRouter);
// apiRouter.use("/events", eventsRouter);
// apiRouter.use("/products", productsRouter);
// apiRouter.use("/integrations", integrationsRouter);
// apiRouter.use("/admin", adminRouter);
