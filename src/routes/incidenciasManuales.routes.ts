import { Router } from "express";
import {
  createIncidenciaManual,
  listIncidenciasManuales,
} from "../controllers/incidenciasManuales.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const incidenciasManualesRouter = Router();

incidenciasManualesRouter.get("/", requireAuth, asyncHandler(listIncidenciasManuales));
incidenciasManualesRouter.post("/", requireAuth, asyncHandler(createIncidenciaManual));
