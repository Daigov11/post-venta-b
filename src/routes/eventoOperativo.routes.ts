import { Router } from "express";
import {
  getResumenHoy,
  getResumenRango,
  listEventos,
} from "../controllers/eventoOperativo.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const eventoOperativoRouter = Router();

eventoOperativoRouter.use(requireAuth);
// "/resumen-hoy" y "/resumen" son exclusivos de la pagina Resultados — el
// listado ("/") lo usan Alertas y Tareas y debe seguir abierto a todos los
// roles autorizados.
eventoOperativoRouter.get(
  "/resumen-hoy",
  requireRol("ADMIN", "ADMINISTRATIVO"),
  asyncHandler(getResumenHoy)
);
eventoOperativoRouter.get(
  "/resumen",
  requireRol("ADMIN", "ADMINISTRATIVO"),
  asyncHandler(getResumenRango)
);
eventoOperativoRouter.get("/", asyncHandler(listEventos));
