import { Router } from "express";

import {
  createFileController,
  uploadMiddleware,
} from "../controllers/create-file.controller";
import { deleteFileController } from "../controllers/delete-file.controller";

export const filesRouter = Router();

filesRouter.post("/upload", uploadMiddleware, createFileController);
filesRouter.delete("/:fileId", deleteFileController);

export default filesRouter;
