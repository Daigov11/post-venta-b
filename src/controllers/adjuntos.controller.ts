import crypto from "node:crypto";
import path from "node:path";
import type { Request, Response } from "express";
import multer from "multer";
import { adjuntosDir } from "../config/uploads.js";
import * as adjuntosRepository from "../repositories/adjuntos.repository.js";
import type { Adjunto, EntidadAdjunto } from "../types/postventa.js";

const ENTIDADES_VALIDAS: EntidadAdjunto[] = [
  "NOTA",
  "TAREA_SEGUIMIENTO",
  "REUNION",
  "INCIDENCIA_MANUAL",
];

const MIME_A_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, adjuntosDir),
  filename: (_req, file, cb) => {
    const extension = MIME_A_EXTENSION[file.mimetype] ?? path.extname(file.originalname) ?? "";
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${extension}`);
  },
});

// Solo imagenes — es lo unico que pidieron adjuntar a comentarios/notas, y
// mantiene la carpeta de uploads simple de razonar (no hay que preocuparse
// por PDFs/ejecutables sirviendose directo desde /uploads).
export const uploadAdjunto = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!MIME_A_EXTENSION[file.mimetype]) {
      cb(new UploadValidationError("Solo se permiten imágenes (jpg, png, webp, gif)."));
      return;
    }
    cb(null, true);
  },
}).single("file");

export async function createAdjunto(req: Request, res: Response) {
  const { entidadTipo, entidadId } = req.body ?? {};
  if (!ENTIDADES_VALIDAS.includes(entidadTipo)) {
    return res.status(400).json({ message: "entidadTipo invalido" });
  }
  const idNumerico = Number(entidadId);
  if (!entidadId || Number.isNaN(idNumerico)) {
    return res.status(400).json({ message: "entidadId es requerido" });
  }
  if (!req.file) {
    return res.status(400).json({ message: "Falta el archivo" });
  }

  const adjunto = await adjuntosRepository.create({
    entidadTipo: entidadTipo as EntidadAdjunto,
    entidadId: idNumerico,
    archivo: req.file.filename,
    nombreOriginal: req.file.originalname,
    mimeType: req.file.mimetype,
    tamanoBytes: req.file.size,
    usuario: req.usuario as string,
  });
  res.status(201).json(adjunto);
}

export async function listAdjuntos(req: Request, res: Response) {
  const entidadTipo = req.query.entidadTipo ? String(req.query.entidadTipo) : undefined;
  if (!entidadTipo || !ENTIDADES_VALIDAS.includes(entidadTipo as EntidadAdjunto)) {
    return res.status(400).json({ message: "entidadTipo invalido" });
  }

  // Un solo id (item puntual) o varios separados por coma (lista completa,
  // evita N+1 requests — ver adjuntosRepository.listByEntidades).
  const entidadIdsRaw = req.query.entidadIds ? String(req.query.entidadIds) : undefined;
  const entidadIdRaw = req.query.entidadId ? String(req.query.entidadId) : undefined;

  if (entidadIdsRaw) {
    const ids = entidadIdsRaw
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => !Number.isNaN(id));
    const map = await adjuntosRepository.listByEntidades(entidadTipo as EntidadAdjunto, ids);
    const data: Record<number, Adjunto[]> = {};
    for (const id of ids) data[id] = map.get(id) ?? [];
    return res.status(200).json({ data });
  }

  if (!entidadIdRaw || Number.isNaN(Number(entidadIdRaw))) {
    return res.status(400).json({ message: "entidadId o entidadIds es requerido" });
  }
  const adjuntos = await adjuntosRepository.listByEntidad(
    entidadTipo as EntidadAdjunto,
    Number(entidadIdRaw)
  );
  res.status(200).json({ data: adjuntos });
}

export async function deleteAdjunto(req: Request, res: Response) {
  const id = Number(req.params.id);
  const deleted = await adjuntosRepository.remove(id);
  if (!deleted) {
    return res.status(404).json({ message: "Adjunto no encontrado" });
  }
  res.status(204).send();
}
