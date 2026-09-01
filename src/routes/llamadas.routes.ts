import { Router } from "express";
import { createLlamada, listLlamadas } from "../controllers/llamadas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const llamadasRouter = Router();

llamadasRouter.get("/", requireAuth, asyncHandler(listLlamadas));
llamadasRouter.post("/", requireAuth, asyncHandler(createLlamada));
