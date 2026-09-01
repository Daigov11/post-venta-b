import type { NextFunction, Request, Response } from "express";
import axios from "axios";
import multer from "multer";

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

  // Subida de adjuntos (imagenes) — archivo muy pesado, tipo no permitido,
  // etc. Multer/nuestro fileFilter llaman next(err) en vez de responder
  // directo, asi que se resuelve aca para devolver 400 en vez del generico
  // 500.
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ message: `No se pudo subir el archivo: ${error.message}` });
  }
  if (error instanceof Error && error.name === "UploadValidationError") {
    return res.status(400).json({ message: error.message });
  }

  console.error("Error inesperado:", error);
  res.status(500).json({ message: "Error inesperado" });
}
