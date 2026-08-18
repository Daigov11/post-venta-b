import { Router } from "express";
import { refresh } from "../controllers/postventa.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const postventaRouter = Router();

postventaRouter.post("/refresh", requireAuth, asyncHandler(refresh));
