import { Router } from "express";
import {
  createUsuarioAutorizado,
  listUsuariosAutorizados,
  updateUsuarioAutorizado,
} from "../controllers/usuariosAutorizados.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const usuariosAutorizadosRouter = Router();

usuariosAutorizadosRouter.use(requireAuth);
usuariosAutorizadosRouter.use(requireRol("ADMIN"));

usuariosAutorizadosRouter.get("/", asyncHandler(listUsuariosAutorizados));
usuariosAutorizadosRouter.post("/", asyncHandler(createUsuarioAutorizado));
usuariosAutorizadosRouter.patch("/:id", asyncHandler(updateUsuarioAutorizado));
