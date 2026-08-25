import type { Request, Response } from "express";
import axios from "axios";
import { mapIncidenciaItem, type RawIncidenciaItem } from "../mappers/incidencias.mapper.js";
import { fetchIncidencias } from "../services/apiworking/externalApi.js";

interface RawIncidenciasResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

export async function getIncidencias(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : "";
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }

  try {
    const raw = (await fetchIncidencias(req.externalToken as string, {
      search: numeroDocumentoCliente,
    })) as RawIncidenciasResponse;

    const filas = Array.isArray(raw?.data) ? (raw.data as RawIncidenciaItem[]) : [];
    const incidencias = filas
      .map(mapIncidenciaItem)
      // Mas reciente primero, igual que historial de seguimiento.
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    res.status(200).json({
      data: incidencias,
      total: incidencias.length,
      abiertas: incidencias.filter((i) => !i.resuelta).length,
      resueltas: incidencias.filter((i) => i.resuelta).length,
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo obtener las incidencias";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al obtener incidencias:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}
