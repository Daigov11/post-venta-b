import type { Request, Response } from "express";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import * as seguimientosRepository from "../repositories/seguimientos.repository.js";
import * as tareasRepository from "../repositories/tareas.repository.js";
import { getEstadoIncidencias } from "../services/postventa/postventaCache.js";
import { listTareasRenovacion } from "../services/postventa/renovacionContacto.js";
import {
  listCarteraMensual,
  reconstruirRepartoDelPeriodo,
  redistribuirPendientesDelPeriodo,
} from "../services/postventa/repartoMensualContacto.js";
import type { EstadoTarea, OrigenTarea, PrioridadTarea, Tarea, TipoTarea } from "../types/postventa.js";

export async function listRenovacion(_req: Request, res: Response) {
  const data = await listTareasRenovacion();
  res.status(200).json({ data, total: data.length });
}

// ?alcance=mias limita a las tareas del propio usuario. Un no-admin siempre
// ve solo las suyas, aunque pida otra cosa: el filtro real vive aca, no en
// el frontend.
export async function listCartera(req: Request, res: Response) {
  const { resumen, data } = await listCarteraMensual({
    usuario: req.usuario as string,
    esAdmin: req.rolUsuario === "ADMIN",
    soloMias: req.query.alcance === "mias",
  });
  res.status(200).json({ resumen, data, total: data.length });
}

export async function reconstruirCartera(req: Request, res: Response) {
  const resultado = await reconstruirRepartoDelPeriodo(req.usuario as string);
  res.status(200).json(resultado);
}

export async function redistribuirCartera(req: Request, res: Response) {
  const resultado = await redistribuirPendientesDelPeriodo(req.usuario as string);
  res.status(200).json(resultado);
}

// incidenciaAbierta: true/false = estado real leido del snapshot diario ya
// cargado en memoria (getEstadoIncidencias, cero llamadas nuevas a
// APIWorking — nunca N+1). null = la tarea no esta ligada a una incidencia
// (origenEntidadTipo distinto de INCIDENCIA) O SI lo esta pero no se pudo
// determinar su estado — el frontend nunca debe leer null como "resuelta"
// cuando origenEntidadTipo SI es INCIDENCIA (ver Tareas.tsx, badge "Estado
// de incidencia no disponible").
export interface TareaListItem extends Tarea {
  incidenciaAbierta: boolean | null;
}

async function enriquecerConEstadoIncidencia(tareas: Tarea[]): Promise<TareaListItem[]> {
  const idsIncidencia = tareas
    .filter((t) => t.origenEntidadTipo === "INCIDENCIA" && t.origenEntidadId)
    .map((t) => Number(t.origenEntidadId))
    .filter((id) => Number.isFinite(id));

  const estadoMap = idsIncidencia.length > 0 ? await getEstadoIncidencias(idsIncidencia) : new Map();

  return tareas.map((t) => {
    if (t.origenEntidadTipo !== "INCIDENCIA" || !t.origenEntidadId) {
      return { ...t, incidenciaAbierta: null };
    }
    const incidencia = estadoMap.get(Number(t.origenEntidadId));
    return { ...t, incidenciaAbierta: incidencia ? !incidencia.resuelta : null };
  });
}

export async function listTareas(req: Request, res: Response) {
  // La generacion/sincronizacion del reparto mensual NO corre aca (ver
  // feedback de rendimiento): vive exclusivamente en listCartera, detras de
  // GET /api/tareas/reparto-mensual. La carga general de Tareas nunca paga
  // el costo de esa validacion.
  const tareas = await tareasRepository.list({
    numeroDocumentoCliente: req.query.numeroDocumentoCliente
      ? String(req.query.numeroDocumentoCliente)
      : undefined,
    estado: req.query.estado ? (String(req.query.estado) as EstadoTarea) : undefined,
    responsable: req.query.responsable ? String(req.query.responsable) : undefined,
    tipo: req.query.tipo ? (String(req.query.tipo) as TipoTarea) : undefined,
    origen: req.query.origen ? (String(req.query.origen) as OrigenTarea) : undefined,
    prioridad: req.query.prioridad ? (String(req.query.prioridad) as PrioridadTarea) : undefined,
    fechaDesde: req.query.fechaDesde ? String(req.query.fechaDesde) : undefined,
    fechaHasta: req.query.fechaHasta ? String(req.query.fechaHasta) : undefined,
    vencidas: req.query.vencidas === "true",
  });
  const data = await enriquecerConEstadoIncidencia(tareas);
  res.status(200).json({ data });
}

export async function getTarea(req: Request, res: Response) {
  const tarea = await tareasRepository.findById(Number(req.params.id));
  if (!tarea) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }
  res.status(200).json(tarea);
}

const TIPOS_VALIDOS = new Set<TipoTarea>([
  "RENOVACION",
  "PENDIENTE_CLASIFICACION",
  "COBRANZA",
  "DOCUMENTACION",
  "SOPORTE",
  "SEGUIMIENTO",
  "REUNION",
  "OPORTUNIDAD_COMERCIAL",
]);
const ORIGENES_VALIDOS = new Set<OrigenTarea>([
  "MANUAL",
  "ALERTA",
  "INCIDENCIA",
  "FICHA_CLIENTE",
  "OPORTUNIDAD",
  "RENOVACION",
  "REPARTO_MENSUAL",
  "RECUPERACION",
]);

export async function createTarea(req: Request, res: Response) {
  const {
    numeroDocumentoCliente,
    idOrdenServicio,
    tipo,
    origen,
    origenEntidadTipo,
    origenEntidadId,
    titulo,
    descripcion,
    responsable,
    prioridad,
    fechaVencimiento,
  } = req.body ?? {};

  if (!numeroDocumentoCliente || !titulo || !responsable) {
    return res
      .status(400)
      .json({ message: "numeroDocumentoCliente, titulo y responsable son requeridos" });
  }
  if (tipo !== undefined && !TIPOS_VALIDOS.has(tipo)) {
    return res.status(400).json({ message: `tipo invalido: ${tipo}` });
  }
  if (origen !== undefined && !ORIGENES_VALIDOS.has(origen)) {
    return res.status(400).json({ message: `origen invalido: ${origen}` });
  }

  const created = await tareasRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    tipo: tipo as TipoTarea | undefined,
    origen: origen as OrigenTarea | undefined,
    origenEntidadTipo: origenEntidadTipo ? String(origenEntidadTipo) : null,
    origenEntidadId: origenEntidadId ? String(origenEntidadId) : null,
    titulo: String(titulo),
    descripcion: descripcion ? String(descripcion) : null,
    responsable: String(responsable),
    prioridad: (prioridad as PrioridadTarea) ?? "MEDIA",
    fechaVencimiento: fechaVencimiento ? String(fechaVencimiento) : null,
    createdBy: req.usuario as string,
  });

  await eventoOperativoRepository.registrarSeguro({
    usuario: req.usuario as string,
    tipoAccion: "TAREA_CREADA",
    modulo: "TAREAS",
    numeroDocumentoCliente: created.numeroDocumentoCliente,
    entidadTipo: "TAREA",
    entidadId: String(created.id),
    detalle: created.titulo,
  });

  res.status(201).json(created);
}

export async function updateTarea(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { titulo, descripcion, responsable, prioridad, estado, fechaVencimiento } = req.body ?? {};

  const antes = await tareasRepository.findById(id);
  if (!antes) {
    return res.status(404).json({ message: "Tarea no encontrada" });
  }

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

  // Derivado por transicion real de estado (antes -> despues), no por el
  // solo hecho de recibir el campo en el body — asi un reintento/doble clic
  // que vuelve a mandar el mismo PATCH sobre una tarea ya completada no
  // cuenta una segunda vez (no hay transicion, no hay evento).
  if (antes.estado !== "COMPLETADA" && updated.estado === "COMPLETADA") {
    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion: "TAREA_COMPLETADA",
      modulo: "TAREAS",
      numeroDocumentoCliente: updated.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(updated.id),
      detalle: updated.titulo,
    });
  }
  if (antes.fechaVencimiento !== updated.fechaVencimiento && updated.estado !== "COMPLETADA") {
    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion: "TAREA_POSTERGADA",
      modulo: "TAREAS",
      numeroDocumentoCliente: updated.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(updated.id),
      detalle: `Nueva fecha: ${updated.fechaVencimiento ?? "sin fecha"}`,
    });
  }
  if (antes.responsable !== updated.responsable) {
    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion: "TAREA_REASIGNADA",
      modulo: "TAREAS",
      numeroDocumentoCliente: updated.numeroDocumentoCliente,
      entidadTipo: "TAREA",
      entidadId: String(updated.id),
      detalle: `Reasignada a ${updated.responsable}`,
    });
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
