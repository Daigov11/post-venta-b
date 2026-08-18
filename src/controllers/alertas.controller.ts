import type { Request, Response } from "express";
import { evaluateAlertas } from "../engines/alertas.engine.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { Alerta, NivelAlerta, PostVentaCliente } from "../types/postventa.js";

function fechaISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Reuniones no son parte del dataset de APIWorking (evaluateAlertas trabaja
// sobre PostVentaCliente[]) — es nuestro propio dato en MySQL, asi que se
// mezcla aca como un paso adicional en vez de forzarlo dentro del motor de
// alertas puro. Recordatorio simple: reuniones PROGRAMADA de hoy o manana.
export async function construirAlertasReuniones(
  clientes: PostVentaCliente[],
  generatedAt: string
): Promise<Alerta[]> {
  const hoy = new Date();
  const manana = new Date(hoy.getTime() + 24 * 60 * 60 * 1000);
  const reuniones = await reunionesRepository.listProximas(fechaISO(hoy), fechaISO(manana));

  const nombrePorDocumento = new Map(clientes.map((c) => [c.numeroDocumentoCliente, c.nombreCliente]));

  return reuniones.map((r) => ({
    id: `reunion-proxima:${r.numeroDocumentoCliente}:${r.id}`,
    tipo: "REUNION_PROXIMA",
    nivel: "INFO" as const,
    titulo: "Reunión próxima",
    mensaje: `Reunión ${r.modalidad === "VIRTUAL" ? "virtual" : "presencial"} con ${r.ejecutivo} el ${r.fecha} a las ${r.horaInicio}.`,
    cliente: r.numeroDocumentoCliente,
    nombreCliente: nombrePorDocumento.get(r.numeroDocumentoCliente) ?? r.numeroDocumentoCliente,
    idOrdenServicio: r.idOrdenServicio,
    fecha: generatedAt,
    origen: "reunion-proxima",
    estado: "ABIERTA" as const,
  }));
}

export async function listAlertas(req: Request, res: Response) {
  const dataset = await getPostVentaDataset();
  const config = await getConfig();
  const alertasReuniones = await construirAlertasReuniones(dataset.clientes, dataset.generatedAt);
  let alertas = [...evaluateAlertas(dataset.clientes, config, dataset.generatedAt), ...alertasReuniones];

  const nivel = req.query.nivel ? (String(req.query.nivel) as NivelAlerta) : undefined;
  const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
  const cliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;

  if (nivel) alertas = alertas.filter((a) => a.nivel === nivel);
  if (tipo) alertas = alertas.filter((a) => a.tipo === tipo);
  if (cliente) alertas = alertas.filter((a) => a.cliente === cliente);

  res.status(200).json({ data: alertas, generatedAt: dataset.generatedAt });
}
