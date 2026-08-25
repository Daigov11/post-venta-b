import { Router } from "express";
import { getHistorialSeguimiento } from "../controllers/historial.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const historialRouter = Router();

historialRouter.use(requireAuth);
historialRouter.get("/", getHistorialSeguimiento);
