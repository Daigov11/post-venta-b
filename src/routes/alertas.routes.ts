import { Router } from "express";
import { listAlertas } from "../controllers/alertas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const alertasRouter = Router();

alertasRouter.get("/", requireAuth, asyncHandler(listAlertas));
