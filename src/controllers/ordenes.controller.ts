import type { Request, Response } from "express";
import axios from "axios";
import { fetchOrdenesServicio } from "../services/apiworking/externalApi.js";

export async function listOrdenesServicio(req: Request, res: Response) {
  const {
    fechaInicio,
    fechaFin,
    plan,
    estado,
    allFechas,
    displayStart,
    displayLength,
    search,
  } = req.query;

  if (!fechaInicio || !fechaFin) {
    return res.status(400).json({ message: "fechaInicio y fechaFin son requeridos" });
  }

  try {
    const data = await fetchOrdenesServicio(req.externalToken as string, {
      fechaInicio: String(fechaInicio),
      fechaFin: String(fechaFin),
      plan: plan ? String(plan) : undefined,
      estado: estado ? String(estado) : undefined,
      allFechas: allFechas !== undefined ? String(allFechas) : undefined,
      displayStart: displayStart !== undefined ? String(displayStart) : undefined,
      displayLength: displayLength !== undefined ? String(displayLength) : undefined,
      search: search ? String(search) : undefined,
    });
    return res.status(200).json(data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo obtener el listado de ordenes de servicio";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al listar ordenes de servicio:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}
