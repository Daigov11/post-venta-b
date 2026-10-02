import { Router } from "express";
import {
  getIncidencias,
  listTiposIncidencia,
  postIncidencia,
} from "../controllers/incidencias.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const incidenciasRouter = Router();

incidenciasRouter.use(requireAuth);
incidenciasRouter.get("/", getIncidencias);
incidenciasRouter.get("/tipos", listTiposIncidencia);
incidenciasRouter.post("/", asyncHandler(postIncidencia));
