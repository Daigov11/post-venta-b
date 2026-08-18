import type { Request, Response } from "express";
import * as savedViewsRepository from "../repositories/savedViews.repository.js";

export async function listSavedViews(req: Request, res: Response) {
  const screen = req.query.screen ? String(req.query.screen) : "clientes";
  const views = await savedViewsRepository.listByUsuarioAndScreen(
    req.usuario as string,
    screen
  );
  res.status(200).json({ data: views });
}

export async function createSavedView(req: Request, res: Response) {
  const { screen, nombre, columnas, filtros } = req.body ?? {};
  if (!nombre || !Array.isArray(columnas)) {
    return res.status(400).json({ message: "nombre y columnas son requeridos" });
  }
  const created = await savedViewsRepository.create({
    usuario: req.usuario as string,
    screen: screen ? String(screen) : "clientes",
    nombre: String(nombre),
    columnas,
    filtros: filtros ?? {},
  });
  res.status(201).json(created);
}

export async function updateSavedView(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { nombre, columnas, filtros } = req.body ?? {};
  const updated = await savedViewsRepository.update(id, { nombre, columnas, filtros });
  if (!updated) {
    return res.status(404).json({ message: "Vista no encontrada" });
  }
  res.status(200).json(updated);
}

export async function deleteSavedView(req: Request, res: Response) {
  const deleted = await savedViewsRepository.remove(Number(req.params.id));
  if (!deleted) {
    return res.status(404).json({ message: "Vista no encontrada" });
  }
  res.status(204).send();
}
