import { Router } from "express";

import { getTemplatesController } from "../controllers/get-templates-controller";

export const templatesRouter = Router();

templatesRouter.get("/templates", getTemplatesController);

export default templatesRouter;
