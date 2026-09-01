import type { Request, Response } from "express";
import * as llamadasRepository from "../repositories/llamadas.repository.js";

export async function listLlamadas(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const data = await llamadasRepository.listByCliente(numeroDocumentoCliente);
  res.status(200).json({ data });
}

export async function createLlamada(req: Request, res: Response) {
  const { numeroDocumentoCliente, idOrdenServicio } = req.body ?? {};
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const created = await llamadasRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    usuario: req.usuario as string,
  });
  res.status(201).json(created);
}
