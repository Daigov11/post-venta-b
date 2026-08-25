import type { Request, Response } from "express";
import axios from "axios";
import {
  mapHistorialSeguimientoItem,
  type RawHistorialSeguimientoItem,
} from "../mappers/historialSeguimiento.mapper.js";
import { fetchHistorialSeguimiento } from "../services/apiworking/externalApi.js";

interface RawHistorialResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

export async function getHistorialSeguimiento(req: Request, res: Response) {
  const idOrdenServicio = req.query.idOrdenServicio ? String(req.query.idOrdenServicio) : "";
  if (!idOrdenServicio) {
    return res.status(400).json({ message: "idOrdenServicio es requerido" });
  }

  try {
    const raw = (await fetchHistorialSeguimiento(req.externalToken as string, {
      idOrdenServicio,
    })) as RawHistorialResponse;

    const filas = Array.isArray(raw?.data) ? (raw.data as RawHistorialSeguimientoItem[]) : [];
    const eventos = filas
      .map(mapHistorialSeguimientoItem)
      // Mas reciente primero — es un timeline de actividad, lo ultimo es lo
      // que mas le importa a quien lo esta revisando.
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    res.status(200).json({ data: eventos, total: eventos.length });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo obtener el historial de seguimiento";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al obtener historial de seguimiento:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}
