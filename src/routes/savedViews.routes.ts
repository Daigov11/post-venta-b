import { Router } from "express";
import {
  createSavedView,
  deleteSavedView,
  listSavedViews,
  updateSavedView,
} from "../controllers/savedViews.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const savedViewsRouter = Router();

savedViewsRouter.get("/", requireAuth, asyncHandler(listSavedViews));
savedViewsRouter.post("/", requireAuth, asyncHandler(createSavedView));
savedViewsRouter.patch("/:id", requireAuth, asyncHandler(updateSavedView));
savedViewsRouter.delete("/:id", requireAuth, asyncHandler(deleteSavedView));
