import { Router } from "express";
import { getConfigValues, patchConfigValues } from "../controllers/config.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const configRouter = Router();

configRouter.get("/", requireAuth, asyncHandler(getConfigValues));
configRouter.patch("/", requireAuth, asyncHandler(patchConfigValues));
