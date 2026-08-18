import { Router } from "express";
import { createNota, deleteNota, listNotas, updateNota } from "../controllers/notas.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const notasRouter = Router();

notasRouter.get("/", requireAuth, asyncHandler(listNotas));
notasRouter.post("/", requireAuth, asyncHandler(createNota));
notasRouter.patch("/:id", requireAuth, asyncHandler(updateNota));
notasRouter.delete("/:id", requireAuth, asyncHandler(deleteNota));
