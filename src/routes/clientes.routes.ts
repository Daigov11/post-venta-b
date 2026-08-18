import { Router } from "express";
import {
  getFichaCliente,
  listClientes,
  updateClienteMetadata,
} from "../controllers/clientes.controller.js";
import { getClienteIntereses, setClienteIntereses } from "../controllers/intereses.controller.js";
import { refreshAll, refreshOne } from "../controllers/systemUsers.controller.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";

export const clientesRouter = Router();

clientesRouter.get("/", requireAuth, asyncHandler(listClientes));
clientesRouter.post("/system-users/refresh", requireAuth, asyncHandler(refreshAll));
clientesRouter.get("/:numeroDocumentoCliente", requireAuth, asyncHandler(getFichaCliente));
clientesRouter.patch(
  "/:numeroDocumentoCliente/metadata",
  requireAuth,
  asyncHandler(updateClienteMetadata)
);
clientesRouter.post(
  "/:numeroDocumentoCliente/system-users/refresh",
  requireAuth,
  asyncHandler(refreshOne)
);
clientesRouter.get(
  "/:numeroDocumentoCliente/intereses",
  requireAuth,
  asyncHandler(getClienteIntereses)
);
clientesRouter.put(
  "/:numeroDocumentoCliente/intereses",
  requireAuth,
  asyncHandler(setClienteIntereses)
);
