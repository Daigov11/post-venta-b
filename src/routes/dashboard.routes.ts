import { Router } from "express";
import { getKpis } from "../controllers/dashboard.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const dashboardRouter = Router();

dashboardRouter.use(requireAuth);
dashboardRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));

dashboardRouter.get("/kpis", asyncHandler(getKpis));
