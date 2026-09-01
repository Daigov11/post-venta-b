import type { Request, Response } from "express";
import { evaluateAlertas } from "../engines/alertas.engine.js";
import * as alertasEstadoRepository from "../repositories/alertasEstado.repository.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import { getConfig } from "../services/postventa/configService.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { Alerta, EstadoAlerta, NivelAlerta, PostVentaCliente } from "../types/postventa.js";

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

  const clientePorDocumento = new Map(clientes.map((c) => [c.numeroDocumentoCliente, c]));
  const sistemasVacio: PostVentaCliente["sistemas"] = {
    apiWorking: 0,
    apiLoyalty: false,
    donChat: false,
    sireContable: false,
    apiReview: false,
    pos: false,
  };

  return reuniones.map((r) => ({
    id: `reunion-proxima:${r.numeroDocumentoCliente}:${r.id}`,
    tipo: "REUNION_PROXIMA",
    nivel: "INFO" as const,
    titulo: "Reunión próxima",
    mensaje: `Reunión ${r.modalidad === "VIRTUAL" ? "virtual" : "presencial"} con ${r.ejecutivo} el ${r.fecha} a las ${r.horaInicio}.`,
    cliente: r.numeroDocumentoCliente,
    nombreCliente:
      clientePorDocumento.get(r.numeroDocumentoCliente)?.nombreCliente ?? r.numeroDocumentoCliente,
    sistemas: clientePorDocumento.get(r.numeroDocumentoCliente)?.sistemas ?? sistemasVacio,
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

  // Las alertas no se guardan — se recalculan en cada request. Lo unico
  // persistido es la marca manual (VISTA/RESUELTA) en postventa_alertas_estado,
  // indexada por el mismo id deterministico que genera el motor de alertas.
  // Una vez marcada RESUELTA queda asi hasta que alguien la reabra a mano
  // (DELETE), sin importar si la condicion que la disparo sigue activa.
  const estados = await alertasEstadoRepository.listByIds(alertas.map((a) => a.id));
  alertas = alertas.map((a) => {
    const override = estados.get(a.id);
    return override ? { ...a, estado: override.estado as EstadoAlerta } : a;
  });

  const nivel = req.query.nivel ? (String(req.query.nivel) as NivelAlerta) : undefined;
  const tipo = req.query.tipo ? String(req.query.tipo) : undefined;
  const cliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  const estadoFiltro = req.query.estado ? (String(req.query.estado) as EstadoAlerta) : undefined;

  if (nivel) alertas = alertas.filter((a) => a.nivel === nivel);
  if (tipo) alertas = alertas.filter((a) => a.tipo === tipo);
  if (cliente) alertas = alertas.filter((a) => a.cliente === cliente);
  // Sin filtro explicito de estado: se esconden las resueltas (siguen vivas
  // en la base para la pestaña "Resueltas") pero se muestran las VISTA — ver
  // una alerta no significa que ya este resuelta.
  alertas = estadoFiltro
    ? alertas.filter((a) => a.estado === estadoFiltro)
    : alertas.filter((a) => a.estado !== "RESUELTA");

  res.status(200).json({ data: alertas, generatedAt: dataset.generatedAt });
}

export async function marcarEstadoAlerta(req: Request, res: Response) {
  const { id } = req.params;
  const { estado, nota, numeroDocumentoCliente } = req.body ?? {};
  if (estado !== "VISTA" && estado !== "RESUELTA") {
    return res.status(400).json({ message: "estado debe ser VISTA o RESUELTA" });
  }
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const updated = await alertasEstadoRepository.upsert({
    alertaId: id,
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    estado,
    nota: nota ? String(nota) : null,
    usuario: req.usuario as string,
  });
  res.status(200).json(updated);
}

export async function reabrirAlerta(req: Request, res: Response) {
  const { id } = req.params;
  await alertasEstadoRepository.remove(id);
  res.status(204).send();
}
