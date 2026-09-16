import type { Request, Response } from "express";
import { getCapacitacionesPorCliente } from "../services/postventa/postventaCache.js";

export async function listCapacitaciones(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const capacitaciones = await getCapacitacionesPorCliente(numeroDocumentoCliente);
  res.status(200).json({ data: capacitaciones });
}
