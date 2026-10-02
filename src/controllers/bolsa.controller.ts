import type { Request, Response } from "express";
import {
  cerrarBolsa,
  esCategoriaConversionValida,
  obtenerEstadoBolsa,
  reabrirBolsa,
  registrarConversion,
} from "../services/postventa/bolsaService.js";

export async function getMiBolsa(req: Request, res: Response) {
  const estado = await obtenerEstadoBolsa(req.usuario as string);
  res.status(200).json(estado);
}

export async function postCerrarBolsa(req: Request, res: Response) {
  const { observacion } = req.body ?? {};
  try {
    const estado = await cerrarBolsa(req.usuario as string, observacion ? String(observacion) : null);
    res.status(200).json(estado);
  } catch (error) {
    res.status(409).json({ message: (error as Error).message });
  }
}

export async function postReabrirBolsa(req: Request, res: Response) {
  const estado = await reabrirBolsa(req.usuario as string);
  res.status(200).json(estado);
}

export async function postConversionBolsa(req: Request, res: Response) {
  const { tipo, descripcion } = req.body ?? {};
  if (!tipo || typeof tipo !== "string" || !esCategoriaConversionValida(tipo)) {
    return res.status(400).json({
      message:
        "tipo debe ser una de: CAMBIO_PERIODICIDAD, ADQUISICION_EQUIPO, RECUPERACION_CLIENTE, VENTA_PRODUCTO, APILOYALTY, APIREVIEW",
    });
  }
  try {
    const estado = await registrarConversion(req.usuario as string, {
      tipo,
      descripcion: descripcion ? String(descripcion).trim() : null,
    });
    res.status(201).json(estado);
  } catch (error) {
    res.status(409).json({ message: (error as Error).message });
  }
}
