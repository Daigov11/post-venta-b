import { Router } from "express";
import { listAlertas, marcarEstadoAlerta, reabrirAlerta } from "../controllers/alertas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const alertasRouter = Router();

alertasRouter.get("/", requireAuth, asyncHandler(listAlertas));
alertasRouter.put("/:id/estado", requireAuth, asyncHandler(marcarEstadoAlerta));
alertasRouter.delete("/:id/estado", requireAuth, asyncHandler(reabrirAlerta));
