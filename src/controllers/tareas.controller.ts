import type { Request, Response } from "express";
import * as seguimientosRepository from "../repositories/seguimientos.repository.js";
import * as tareasRepository from "../repositories/tareas.repository.js";
import type { EstadoTarea, PrioridadTarea } from "../types/postventa.js";

export async function listTareas(req: Request, res: Response) {
  const tareas = await tareasRepository.list({
    numeroDocumentoCliente: req.query.numeroDocumentoCliente
      ? String(req.query.numeroDocumentoCliente)
      : undefined,
    estado: req.query.estado ? (String(req.query.estado) as EstadoTarea) : undefined,
    responsable: req.query.responsable ? String(req.query.responsable) : undefined,
    vencidas: req.query.vencidas === "true",
  });
  res.status(200).json({ data: tareas });
}

export async function getTarea(req: Request, res: Response) {
  const tarea = await tareasRepository.findById(Number(req.params.id));
  if (!tarea) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
  res.status(200).json(tarea);
}

export async function createTarea(req: Request, res: Response) {
  const { numeroDocumentoCliente, idOrdenServicio, titulo, descripcion, responsable, prioridad, fechaVencimiento } =
    req.body ?? {};

  if (!numeroDocumentoCliente || !titulo || !responsable) {
    return res
      .status(400)
      .json({ message: "numeroDocumentoCliente, titulo y responsable son requeridos" });
  }

  const created = await tareasRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    titulo: String(titulo),
    descripcion: descripcion ? String(descripcion) : null,
    responsable: String(responsable),
    prioridad: (prioridad as PrioridadTarea) ?? "MEDIA",
    fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : null,
    createdBy: req.usuario as string,
  });
  res.status(201).json(created);
}

export async function updateTarea(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { titulo, descripcion, responsable, prioridad, estado, fechaVencimiento } = req.body ?? {};

  const updated = await tareasRepository.update(id, {
    titulo,
    descripcion,
    responsable,
    prioridad,
    estado,
    fechaVencimiento,
  });
  if (!updated) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
  res.status(200).json(updated);
}

export async function deleteTarea(req: Request, res: Response) {
  const deleted = await tareasRepository.remove(Number(req.params.id));
  if (!deleted) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
  res.status(204).send();
}

export async function listSeguimientos(req: Request, res: Response) {
  const tareaId = Number(req.params.id);
  const tarea = await tareasRepository.findById(tareaId);
  if (!tarea) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
  const seguimientos = await seguimientosRepository.listByTarea(tareaId);
  res.status(200).json({ data: seguimientos });
}

export async function createSeguimiento(req: Request, res: Response) {
  const tareaId = Number(req.params.id);
  const { comentario } = req.body ?? {};
  if (!comentario) {
    return res.status(400).json({ message: "comentario es requerido" });
  }

  const tarea = await tareasRepository.findById(tareaId);
  if (!tarea) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }

  // Agregar un seguimiento nunca cambia el estado de la tarea automaticamente
  // (eso requiere un PATCH /api/tareas/:id explicito) — solo se guarda un
  // snapshot descriptivo del estado en ese momento.
  const created = await seguimientosRepository.create({
    tareaId,
    usuario: req.usuario as string,
    comentario: String(comentario),
    estadoEnEseMomento: tarea.estado,
  });
  res.status(201).json(created);
}
