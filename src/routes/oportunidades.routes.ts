import { Router } from "express";
import { actualizarEstadoOportunidad, listOportunidades } from "../controllers/oportunidades.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const oportunidadesRouter = Router();

oportunidadesRouter.get("/", requireAuth, asyncHandler(listOportunidades));
oportunidadesRouter.put("/:id/estado", requireAuth, asyncHandler(actualizarEstadoOportunidad));
