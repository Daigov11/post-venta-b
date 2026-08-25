import { Router } from "express";
import { getIncidencias } from "../controllers/incidencias.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const incidenciasRouter = Router();

incidenciasRouter.use(requireAuth);
incidenciasRouter.get("/", getIncidencias);
