import type { NextFunction, Request, Response } from "express";
import axios from "axios";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status ?? 502;
    const message =
      (typeof error.response?.data === "string" && error.response.data) ||
      (error.response?.data as { message?: string } | undefined)?.message ||
      "No se pudo completar la solicitud a la API externa";
    return res.status(status).json({ message });
  }

  console.error("Error inesperado:", error);
  res.status(500).json({ message: "Error inesperado" });
}
