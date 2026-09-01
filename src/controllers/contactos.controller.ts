import type { Request, Response } from "express";
import * as contactosRepository from "../repositories/contactos.repository.js";
import type { CanalContacto } from "../types/postventa.js";

const CANALES_VALIDOS: CanalContacto[] = ["LLAMADA", "WHATSAPP"];

export async function listContactos(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const data = await contactosRepository.listByCliente(numeroDocumentoCliente);
  res.status(200).json({ data });
}

export async function createContacto(req: Request, res: Response) {
  const { numeroDocumentoCliente, idOrdenServicio, canal } = req.body ?? {};
  if (!numeroDocumentoCliente || !CANALES_VALIDOS.includes(canal)) {
    return res
      .status(400)
      .json({ message: "numeroDocumentoCliente y canal (LLAMADA|WHATSAPP) son requeridos" });
  }
  const created = await contactosRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    canal,
    usuario: req.usuario as string,
  });
  res.status(201).json(created);
}
