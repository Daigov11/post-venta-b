import { Router } from "express";
import {
  createSeguimiento,
  createTarea,
  deleteTarea,
  getTarea,
  listSeguimientos,
  listTareas,
  updateTarea,
} from "../controllers/tareas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const tareasRouter = Router();

tareasRouter.get("/", requireAuth, asyncHandler(listTareas));
tareasRouter.post("/", requireAuth, asyncHandler(createTarea));
tareasRouter.get("/:id", requireAuth, asyncHandler(getTarea));
tareasRouter.patch("/:id", requireAuth, asyncHandler(updateTarea));
tareasRouter.delete("/:id", requireAuth, asyncHandler(deleteTarea));
tareasRouter.get("/:id/seguimientos", requireAuth, asyncHandler(listSeguimientos));
tareasRouter.post("/:id/seguimientos", requireAuth, asyncHandler(createSeguimiento));
