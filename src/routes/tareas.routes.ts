import { Router } from "express";
import {
  createSeguimiento,
  createTarea,
  deleteTarea,
  getTarea,
  listCartera,
  listRenovacion,
  listSeguimientos,
  listTareas,
  redistribuirCartera,
  updateTarea,
} from "../controllers/tareas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const tareasRouter = Router();

tareasRouter.get("/", requireAuth, asyncHandler(listTareas));
tareasRouter.post("/", requireAuth, asyncHandler(createTarea));
// Antes de "/:id" — si no, Express la matchea como :id="renovacion"/"reparto-mensual".
tareasRouter.get("/renovacion", requireAuth, asyncHandler(listRenovacion));
tareasRouter.get("/reparto-mensual", requireAuth, asyncHandler(listCartera));
tareasRouter.post("/reparto-mensual/redistribuir", requireAuth, asyncHandler(redistribuirCartera));
tareasRouter.get("/:id", requireAuth, asyncHandler(getTarea));
tareasRouter.patch("/:id", requireAuth, asyncHandler(updateTarea));
tareasRouter.delete("/:id", requireAuth, asyncHandler(deleteTarea));
tareasRouter.get("/:id/seguimientos", requireAuth, asyncHandler(listSeguimientos));
tareasRouter.post("/:id/seguimientos", requireAuth, asyncHandler(createSeguimiento));
