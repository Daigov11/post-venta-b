import { Router } from "express";
import { listClientesBaja } from "../controllers/clientesBaja.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const clientesBajaRouter = Router();

clientesBajaRouter.use(requireAuth);
clientesBajaRouter.get("/", listClientesBaja);
