import type { Request, Response } from "express";
import * as notasRepository from "../repositories/notas.repository.js";

export async function listNotas(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const notas = await notasRepository.listByCliente(numeroDocumentoCliente);
  res.status(200).json({ data: notas });
}

export async function createNota(req: Request, res: Response) {
  const { numeroDocumentoCliente, idOrdenServicio, nota } = req.body ?? {};
  if (!numeroDocumentoCliente || !nota) {
    return res.status(400).json({ message: "numeroDocumentoCliente y nota son requeridos" });
  }
  const created = await notasRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    usuario: req.usuario as string,
    nota: String(nota),
  });
  res.status(201).json(created);
}

export async function updateNota(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { nota } = req.body ?? {};
  if (!nota) {
    return res.status(400).json({ message: "nota es requerida" });
  }
  const updated = await notasRepository.update(id, String(nota));
  if (!updated) {
    return res.status(404).json({ message: "Nota no encontrada" });
  }
  res.status(200).json(updated);
}

export async function deleteNota(req: Request, res: Response) {
  const id = Number(req.params.id);
  const deleted = await notasRepository.remove(id);
  if (!deleted) {
    return res.status(404).json({ message: "Nota no encontrada" });
  }
  res.status(204).send();
}
