import type { Request, Response } from "express";
import * as systemUsersCacheRepository from "../repositories/systemUsersCache.repository.js";
import { fetchSystemUsers } from "../services/apiworking/systemUsers.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { PostVentaCliente } from "../types/postventa.js";

const CONCURRENCY = 8;

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;

  async function next(): Promise<void> {
    const current = index++;
    if (current >= items.length) return;
    await worker(items[current]);
    return next();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

async function refreshCliente(token: string, cliente: PostVentaCliente): Promise<boolean> {
  const linkSistema = cliente.ordenVigente.linkSistema;
  if (!linkSistema) return false;

  const result = await fetchSystemUsers(token, linkSistema);
  if (!result) return false;

  await systemUsersCacheRepository.upsert({
    numeroDocumentoCliente: cliente.numeroDocumentoCliente,
    cantidadTrabajadores: result.cantidadTrabajadores,
    baseDatos: result.baseDatos,
    usuarios: result.usuarios,
    linkSistemaUsado: linkSistema,
  });
  return true;
}

// Recorre TODOS los clientes del dataset actual llamando a systemUser con
// concurrencia limitada — puede tardar varios minutos con miles de clientes,
// pensado como accion administrativa manual, no como parte de un request normal.
export async function refreshAll(req: Request, res: Response) {
  const token = req.externalToken as string;
  const dataset = await getPostVentaDataset();

  let exitosos = 0;
  let fallidos = 0;

  await runWithConcurrency(dataset.clientes, CONCURRENCY, async (cliente) => {
    try {
      const ok = await refreshCliente(token, cliente);
      if (ok) exitosos += 1;
      else fallidos += 1;
    } catch (error) {
      console.error(`system-users refresh fallo para ${cliente.numeroDocumentoCliente}:`, error);
      fallidos += 1;
    }
  });

  res.status(200).json({ totalClientes: dataset.clientes.length, exitosos, fallidos });
}

export async function refreshOne(req: Request, res: Response) {
  const { numeroDocumentoCliente } = req.params;
  const token = req.externalToken as string;
  const dataset = await getPostVentaDataset();
  const cliente = dataset.clientes.find(
    (c) => c.numeroDocumentoCliente === numeroDocumentoCliente
  );

  if (!cliente) {
    return res.status(404).json({ message: "Cliente no encontrado" });
  }
  if (!cliente.ordenVigente.linkSistema) {
    return res.status(422).json({ message: "El cliente no tiene link de sistema asociado" });
  }

  const ok = await refreshCliente(token, cliente);
  if (!ok) {
    return res
      .status(502)
      .json({ message: "No se pudo obtener los usuarios del sistema del cliente" });
  }

  const cache = await systemUsersCacheRepository.findOne(numeroDocumentoCliente);
  res.status(200).json(cache);
}
