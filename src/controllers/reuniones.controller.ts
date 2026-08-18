import type { Request, Response } from "express";
import { calcularHoraFin, generarSlotsDisponibles, validarHorario } from "../engines/disponibilidad.engine.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import type { EstadoReunion, ModalidadReunion } from "../types/postventa.js";

function esModalidadValida(value: unknown): value is ModalidadReunion {
  return value === "VIRTUAL" || value === "PRESENCIAL";
}

export async function getDisponibilidad(req: Request, res: Response) {
  const ejecutivo = req.query.ejecutivo ? String(req.query.ejecutivo) : "";
  const fecha = req.query.fecha ? String(req.query.fecha) : "";
  const modalidad = req.query.modalidad;

  if (!ejecutivo || !fecha || !esModalidadValida(modalidad)) {
    return res
      .status(400)
      .json({ message: "ejecutivo, fecha y modalidad (VIRTUAL|PRESENCIAL) son requeridos" });
  }

  const existentes = await reunionesRepository.listProgramadasPorEjecutivoYFecha(ejecutivo, fecha);
  const slots = generarSlotsDisponibles(fecha, modalidad, existentes);
  res.status(200).json({ fecha, modalidad, ejecutivo, slots });
}

export async function listReuniones(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : undefined;
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  const reuniones = await reunionesRepository.listByCliente(numeroDocumentoCliente);
  res.status(200).json({ data: reuniones });
}

export async function createReunion(req: Request, res: Response) {
  const {
    numeroDocumentoCliente,
    idOrdenServicio,
    ejecutivo,
    fecha,
    horaInicio,
    modalidad,
    lugarOLink,
    nota,
  } = req.body ?? {};

  if (!numeroDocumentoCliente || !ejecutivo || !fecha || !horaInicio || !esModalidadValida(modalidad)) {
    return res.status(400).json({
      message:
        "numeroDocumentoCliente, ejecutivo, fecha, horaInicio y modalidad (VIRTUAL|PRESENCIAL) son requeridos",
    });
  }

  // Se revalida en el backend aunque el frontend solo deberia ofrecer slots
  // ya libres — pudo ocuparse entre que se cargo la disponibilidad y se
  // confirmo el formulario.
  const existentes = await reunionesRepository.listProgramadasPorEjecutivoYFecha(
    String(ejecutivo),
    String(fecha)
  );
  const validacion = validarHorario(String(fecha), String(horaInicio), modalidad, existentes);
  if (!validacion.valido) {
    return res.status(409).json({ message: validacion.motivo });
  }

  const horaFin = calcularHoraFin(String(horaInicio), modalidad);
  const created = await reunionesRepository.create({
    numeroDocumentoCliente: String(numeroDocumentoCliente),
    idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
    ejecutivo: String(ejecutivo),
    fecha: String(fecha),
    horaInicio: String(horaInicio),
    horaFin,
    modalidad,
    lugarOLink: lugarOLink ? String(lugarOLink) : null,
    nota: nota ? String(nota) : null,
    createdBy: req.usuario as string,
  });
  res.status(201).json(created);
}

export async function updateReunionEstado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { estado } = req.body ?? {};
  const estadosValidos: EstadoReunion[] = ["PROGRAMADA", "COMPLETADA", "CANCELADA"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ message: "estado invalido" });
  }
  const updated = await reunionesRepository.updateEstado(id, estado);
  if (!updated) {
    return res.status(404).json({ message: "Reunión no encontrada" });
  }
  res.status(200).json(updated);
}
