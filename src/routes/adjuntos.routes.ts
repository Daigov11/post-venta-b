import { Router } from "express";
import {
  createAdjunto,
  deleteAdjunto,
  listAdjuntos,
  uploadAdjunto,
} from "../controllers/adjuntos.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const adjuntosRouter = Router();

adjuntosRouter.get("/", requireAuth, asyncHandler(listAdjuntos));
adjuntosRouter.post("/", requireAuth, uploadAdjunto, asyncHandler(createAdjunto));
adjuntosRouter.delete("/:id", requireAuth, asyncHandler(deleteAdjunto));
