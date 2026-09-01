import type { Request, Response } from "express";
import * as incidenciasManualesRepository from "../repositories/incidenciasManuales.repository.js";

export async function listIncidenciasManuales(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const data = await incidenciasManualesRepository.listByCliente(numeroDocumentoCliente);
  res.status(200).json({ data });
}

export async function createIncidenciaManual(req: Request, res: Response) {
  const { numeroDocumentoCliente, idOrdenServicio, caso, tipo, descripcion } = req.body ?? {};
  if (!numeroDocumentoCliente || !caso) {
    return res.status(400).json({ message: "numeroDocumentoCliente y caso son requeridos" });
  }
  const created = await incidenciasManualesRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    caso: String(caso),
    tipo: tipo ? String(tipo) : null,
    descripcion: descripcion ? String(descripcion) : null,
    createdBy: req.usuario as string,
  });
  res.status(201).json(created);
}
