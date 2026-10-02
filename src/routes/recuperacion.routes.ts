import { Router } from "express";
import { actualizarEpisodio, listEpisodios } from "../controllers/recuperacion.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const recuperacionRouter = Router();

recuperacionRouter.use(requireAuth);
recuperacionRouter.get("/", asyncHandler(listEpisodios));
recuperacionRouter.patch("/:id", asyncHandler(actualizarEpisodio));
