import { Router } from "express";
import {
  createInteres,
  desactivarInteres,
  listCatalogo,
} from "../controllers/intereses.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const interesesRouter = Router();

interesesRouter.get("/", requireAuth, asyncHandler(listCatalogo));
interesesRouter.post("/", requireAuth, asyncHandler(createInteres));
interesesRouter.delete("/:id", requireAuth, asyncHandler(desactivarInteres));
