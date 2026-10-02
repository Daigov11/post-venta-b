import { Router } from "express";
import { getConfigValues, patchConfigValues } from "../controllers/config.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const configRouter = Router();

configRouter.use(requireAuth);
configRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));

configRouter.get("/", asyncHandler(getConfigValues));
configRouter.patch("/", asyncHandler(patchConfigValues));
