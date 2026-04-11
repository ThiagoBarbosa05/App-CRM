import { Router } from "express";

import {
  getClientReportsController,
  getCompanyReportsController,
  getGeneralReportsController,
} from "../controllers/reports";
import { getSalesReportsController } from "../controllers/reports/get-sales-reports.controller";

export const reportsRouter = Router();

reportsRouter.get("/general", getGeneralReportsController);
reportsRouter.get("/clients", getClientReportsController);
reportsRouter.get("/companies", getCompanyReportsController);
reportsRouter.get("/sales", getSalesReportsController);

export default reportsRouter;
