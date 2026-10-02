import { Router } from "express";
import {
  getMiBolsa,
  postCerrarBolsa,
  postConversionBolsa,
  postReabrirBolsa,
} from "../controllers/bolsa.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const bolsaRouter = Router();

bolsaRouter.use(requireAuth);
bolsaRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));
bolsaRouter.get("/", asyncHandler(getMiBolsa));
bolsaRouter.post("/cerrar", asyncHandler(postCerrarBolsa));
bolsaRouter.post("/reabrir", asyncHandler(postReabrirBolsa));
bolsaRouter.post("/conversiones", asyncHandler(postConversionBolsa));
