import { Router } from "express";
import {
  createSeguimiento,
  createTarea,
  deleteTarea,
  getTarea,
  listCartera,
  listSeguimientos,
  listTareas,
  reconstruirCartera,
  redistribuirCartera,
  updateTarea,
} from "../controllers/tareas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const tareasRouter = Router();

tareasRouter.get("/", requireAuth, asyncHandler(listTareas));
tareasRouter.post("/", requireAuth, asyncHandler(createTarea));
// Antes de "/:id" — si no, Express la matchea como :id="reparto-mensual".
tareasRouter.get("/reparto-mensual", requireAuth, asyncHandler(listCartera));
tareasRouter.post("/reparto-mensual/redistribuir", requireAuth, asyncHandler(redistribuirCartera));
// Cambia fechas y responsables de muchas tareas a la vez: solo ADMIN.
tareasRouter.post(
  "/reparto-mensual/reconstruir",
  requireAuth,
  requireRol("ADMIN"),
  asyncHandler(reconstruirCartera)
);
tareasRouter.get("/:id", requireAuth, asyncHandler(getTarea));
tareasRouter.patch("/:id", requireAuth, asyncHandler(updateTarea));
tareasRouter.delete("/:id", requireAuth, asyncHandler(deleteTarea));
tareasRouter.get("/:id/seguimientos", requireAuth, asyncHandler(listSeguimientos));
tareasRouter.post("/:id/seguimientos", requireAuth, asyncHandler(createSeguimiento));
