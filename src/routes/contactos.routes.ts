import { Router } from "express";
import { createContacto, listContactos } from "../controllers/contactos.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const contactosRouter = Router();

contactosRouter.get("/", requireAuth, asyncHandler(listContactos));
contactosRouter.post("/", requireAuth, asyncHandler(createContacto));
