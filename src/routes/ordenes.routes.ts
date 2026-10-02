import { Router } from "express";
import { requireAuth, requireRol } from "../middleware/auth.js";
import { listOrdenesServicio } from "../controllers/ordenes.controller.js";

export const ordenesRouter = Router();

ordenesRouter.use(requireAuth);
ordenesRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));

ordenesRouter.get("/servicio", listOrdenesServicio);
