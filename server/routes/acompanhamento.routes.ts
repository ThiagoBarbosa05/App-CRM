import { Router } from "express";

import { getAcompanhamentoController } from "../controllers/acompanhamento/get-acompanhamento.controller";

export const acompanhamentoRouter = Router();

acompanhamentoRouter.get("/", getAcompanhamentoController);

export default acompanhamentoRouter;
