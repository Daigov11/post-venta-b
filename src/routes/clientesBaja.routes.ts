import { Router } from "express";
import { getResumenBajas, listClientesBaja } from "../controllers/clientesBaja.controller.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const clientesBajaRouter = Router();

clientesBajaRouter.use(requireAuth);
clientesBajaRouter.use(requireRol("ADMIN", "ADMINISTRATIVO"));
clientesBajaRouter.get("/resumen", getResumenBajas);
clientesBajaRouter.get("/", listClientesBaja);
