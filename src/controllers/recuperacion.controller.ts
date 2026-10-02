import type { Request, Response } from "express";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import * as recuperacionRepository from "../repositories/recuperacionEpisodio.repository.js";
import { listar, sincronizarEpisodios } from "../services/postventa/recuperacionService.js";
import type { EstadoRecuperacion, OrigenRecuperacion } from "../types/postventa.js";

const ORIGENES_VALIDOS: OrigenRecuperacion[] = ["RENOVACION_IMPAGA", "SUSPENSION", "BAJA"];
const ESTADOS_VALIDOS: EstadoRecuperacion[] = [
  "EN_RECUPERACION",
  "RECUPERADO",
  "PERDIDO",
  "PENDIENTE_VALIDACION",
];

export async function listEpisodios(req: Request, res: Response) {
  const incluirHistorico = req.query.incluirHistorico === "true";
  const montoPorOrden = await sincronizarEpisodios(incluirHistorico);

  const origen = req.query.origen ? String(req.query.origen) : undefined;
  const estado = req.query.estado ? String(req.query.estado) : undefined;
  const resultado = await listar(
    {
      origen: origen && ORIGENES_VALIDOS.includes(origen as OrigenRecuperacion)
        ? (origen as OrigenRecuperacion)
        : undefined,
      responsable: req.query.responsable ? String(req.query.responsable) : undefined,
      estado: estado && ESTADOS_VALIDOS.includes(estado as EstadoRecuperacion)
        ? (estado as EstadoRecuperacion)
        : undefined,
      numeroDocumentoCliente: req.query.cliente ? String(req.query.cliente) : undefined,
      diasRestantesMax:
        req.query.diasRestantesMax !== undefined ? Number(req.query.diasRestantesMax) : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    },
    montoPorOrden
  );

  res.status(200).json(resultado);
}

export async function actualizarEpisodio(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ message: "id inválido" });
  }
  const actual = await recuperacionRepository.findById(id);
  if (!actual) {
    return res.status(404).json({ message: "Episodio de recuperación no encontrado" });
  }

  const { estado, responsable, resultado, fechaIngreso } = req.body ?? {};

  if (estado !== undefined && !ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ message: `estado debe ser uno de: ${ESTADOS_VALIDOS.join(", ")}` });
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const patch: Parameters<typeof recuperacionRepository.update>[1] = {};
  let tipoAccion: "RECUPERACION_MARCADA_RECUPERADO" | "RECUPERACION_MARCADA_PERDIDO" | "RECUPERACION_REASIGNADA" | null =
    null;

  if (estado === "RECUPERADO") {
    patch.estado = "RECUPERADO";
    patch.fechaRecuperacion = hoy;
    tipoAccion = "RECUPERACION_MARCADA_RECUPERADO";
  } else if (estado === "PERDIDO") {
    patch.estado = "PERDIDO";
    patch.fechaPerdida = hoy;
    tipoAccion = "RECUPERACION_MARCADA_PERDIDO";
  } else if (estado !== undefined) {
    patch.estado = estado;
  }

  // Confirmar una fecha de ingreso real saca al episodio de
  // PENDIENTE_VALIDACION (ver auditoria: SUSPENSION/BAJA nacen sin fecha
  // real) — recien ahi se puede fijar una fecha limite.
  if (fechaIngreso !== undefined && fechaIngreso !== null) {
    patch.fechaIngreso = String(fechaIngreso);
    const limite = new Date(`${fechaIngreso}T00:00:00Z`);
    limite.setUTCDate(limite.getUTCDate() + 30);
    patch.fechaLimite = limite.toISOString().slice(0, 10);
    if (actual.estado === "PENDIENTE_VALIDACION" && estado === undefined) {
      patch.estado = "EN_RECUPERACION";
    }
  }

  if (responsable !== undefined) {
    patch.responsable = String(responsable);
    if (tipoAccion === null) tipoAccion = "RECUPERACION_REASIGNADA";
  }
  if (resultado !== undefined) patch.resultado = String(resultado);

  const updated = await recuperacionRepository.update(id, patch);

  if (tipoAccion) {
    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion,
      modulo: "RECUPERACION",
      numeroDocumentoCliente: actual.numeroDocumentoCliente,
      entidadTipo: "RECUPERACION_EPISODIO",
      entidadId: String(id),
      detalle: resultado ? String(resultado) : undefined,
    });
  }

  res.status(200).json(updated);
}
