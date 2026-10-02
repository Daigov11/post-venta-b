import { Router } from "express";
import {
  abrirDia,
  cerrarDia,
  eliminarAccion,
  getResultadoDetalle,
  getResultadoHoy,
  listHistorico,
  registrarAccion,
  registrarConversion,
} from "../controllers/resultadoDia.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const resultadoDiaRouter = Router();

resultadoDiaRouter.use(requireAuth);
resultadoDiaRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));

resultadoDiaRouter.get("/hoy", asyncHandler(getResultadoHoy));
resultadoDiaRouter.post("/abrir", asyncHandler(abrirDia));
resultadoDiaRouter.put("/:id/acciones", asyncHandler(registrarAccion));
resultadoDiaRouter.delete("/:id/acciones/:tipo", asyncHandler(eliminarAccion));
resultadoDiaRouter.put("/:id/conversiones", asyncHandler(registrarConversion));
resultadoDiaRouter.put("/:id/cerrar", asyncHandler(cerrarDia));
resultadoDiaRouter.get("/historico", asyncHandler(listHistorico));
// Registrada al final a proposito: debe quedar despues de "/hoy" y
// "/historico" para que esos paths literales no caigan en este ":id".
resultadoDiaRouter.get("/:id", asyncHandler(getResultadoDetalle));
