import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listOrdenesServicio } from "../controllers/ordenes.controller.js";

export const ordenesRouter = Router();

ordenesRouter.get("/servicio", requireAuth, listOrdenesServicio);
