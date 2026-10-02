import { Router } from "express";
import { getHistorialSeguimiento, postSeguimiento } from "../controllers/historial.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const historialRouter = Router();

historialRouter.use(requireAuth);
historialRouter.get("/", getHistorialSeguimiento);
historialRouter.post("/", asyncHandler(postSeguimiento));
