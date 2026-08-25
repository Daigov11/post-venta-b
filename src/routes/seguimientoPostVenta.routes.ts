import { Router } from "express";
import {
  getSeguimientoDetalle,
  listSeguimientoPostVenta,
  upsertEtapaSeguimiento,
} from "../controllers/seguimientoPostVenta.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const seguimientoPostVentaRouter = Router();

seguimientoPostVentaRouter.use(requireAuth);
seguimientoPostVentaRouter.get("/", listSeguimientoPostVenta);
seguimientoPostVentaRouter.get("/:numeroDocumentoCliente", getSeguimientoDetalle);
seguimientoPostVentaRouter.post("/:numeroDocumentoCliente/etapas/:etapa", upsertEtapaSeguimiento);
