import { Router } from "express";
import {
  getSeguimientoDetalle,
  listSeguimientoPostVenta,
  upsertEtapaSeguimiento,
} from "../controllers/seguimientoPostVenta.controller.js";
import { requireAuth, requireRol } from "../middleware/auth.js";

export const seguimientoPostVentaRouter = Router();

seguimientoPostVentaRouter.use(requireAuth);
// Solo el listado ("/") es exclusivo de Movimientos — el detalle y el
// upsert de etapa los usa el drawer de Seguimiento Post Venta dentro de la
// ficha de cliente, que debe seguir abierto a todos los roles autorizados.
seguimientoPostVentaRouter.get("/", requireRol("ADMIN", "ADMINISTRATIVO"), listSeguimientoPostVenta);
seguimientoPostVentaRouter.get("/:numeroDocumentoCliente", getSeguimientoDetalle);
seguimientoPostVentaRouter.post("/:numeroDocumentoCliente/etapas/:etapa", upsertEtapaSeguimiento);
