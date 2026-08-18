import { Router } from "express";
import {
  createReunion,
  getDisponibilidad,
  listReuniones,
  updateReunionEstado,
} from "../controllers/reuniones.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const reunionesRouter = Router();

reunionesRouter.get("/disponibilidad", requireAuth, asyncHandler(getDisponibilidad));
reunionesRouter.get("/", requireAuth, asyncHandler(listReuniones));
reunionesRouter.post("/", requireAuth, asyncHandler(createReunion));
reunionesRouter.patch("/:id", requireAuth, asyncHandler(updateReunionEstado));
