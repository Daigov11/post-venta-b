import { Router } from "express";
import { getKpis } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.get("/kpis", requireAuth, asyncHandler(getKpis));
