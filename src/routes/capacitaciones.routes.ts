import { Router } from "express";
import { listCapacitaciones } from "../controllers/capacitaciones.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const capacitacionesRouter = Router();

capacitacionesRouter.get("/", requireAuth, asyncHandler(listCapacitaciones));
