import { Router } from "express";
import { refresh } from "../controllers/postventa.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const postventaRouter = Router();

postventaRouter.use(requireAuth);
postventaRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));

postventaRouter.post("/refresh", asyncHandler(refresh));
