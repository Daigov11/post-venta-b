import type { Request, Response } from "express";
import * as clienteInteresesRepository from "../repositories/clienteIntereses.repository.js";
import * as interesesCatalogoRepository from "../repositories/interesesCatalogo.repository.js";

export async function listCatalogo(_req: Request, res: Response) {
  const catalogo = await interesesCatalogoRepository.listActivos();
  res.status(200).json({ data: catalogo });
}

export async function createInteres(req: Request, res: Response) {
  const { icono, nombre, descripcion, etiqueta } = req.body ?? {};
  if (!nombre) {
    return res.status(400).json({ message: "nombre es requerido" });
  }
  const created = await interesesCatalogoRepository.create({
    icono: icono ? String(icono) : null,
    nombre: String(nombre),
    descripcion: descripcion ? String(descripcion) : null,
    etiqueta: etiqueta ? String(etiqueta) : null,
    createdBy: req.usuario as string,
  });
  res.status(201).json(created);
}

export async function desactivarInteres(req: Request, res: Response) {
  const updated = await interesesCatalogoRepository.setActivo(Number(req.params.id), false);
  if (!updated) {
    return res.status(404).json({ message: "Interés no encontrado" });
  }
  res.status(200).json(updated);
}

export async function getClienteIntereses(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const [catalogo, marcados] = await Promise.all([
    interesesCatalogoRepository.listActivos(),
    clienteInteresesRepository.listInteresIdsByCliente(numeroDocumentoCliente),
  ]);
  res.status(200).json({ catalogo, marcados });
}

export async function setClienteIntereses(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const { interesIds } = req.body ?? {};
  if (!Array.isArray(interesIds)) {
    return res.status(400).json({ message: "interesIds debe ser un arreglo" });
  }
  await clienteInteresesRepository.reemplazarIntereses(
    numeroDocumentoCliente,
    interesIds.map(Number),
    req.usuario as string
  );
  const marcados = await clienteInteresesRepository.listInteresIdsByCliente(numeroDocumentoCliente);
  res.status(200).json({ marcados });
}
