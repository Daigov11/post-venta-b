import type { Request, Response } from "express";
import { calcularHoraFin, generarSlotsDisponibles, validarHorario } from "../engines/disponibilidad.engine.js";
import * as reunionesRepository from "../repositories/reuniones.repository.js";
import { getPostVentaDataset } from "../services/postventa/postventaCache.js";
import type { EstadoReunion, ModalidadReunion, ReunionConCliente } from "../types/postventa.js";

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

  if (numeroDocumentoCliente) {
    const reuniones = await reunionesRepository.listByCliente(numeroDocumentoCliente);
    return res.status(200).json({ data: reuniones });
  }

  // Sin numeroDocumentoCliente: pantalla "Reuniones" que lista TODA la
  // cartera, enriquecida con el snapshot en vivo del cliente (nombre,
  // sistemas) para no tener que ir a buscarlo aparte por cada fila.
  const estado = req.query.estado ? (String(req.query.estado) as EstadoReunion) : undefined;
  const tipoReunion = req.query.tipoReunion ? String(req.query.tipoReunion) : undefined;
  const [reuniones, dataset] = await Promise.all([
    reunionesRepository.listAll({ estado, tipoReunion }),
    getPostVentaDataset(),
  ]);
  const clientePorDocumento = new Map(dataset.clientes.map((c) => [c.numeroDocumentoCliente, c]));
  const data: ReunionConCliente[] = reuniones.map((reunion) => {
    const cliente = clientePorDocumento.get(reunion.numeroDocumentoCliente);
    return {
      reunion,
      cliente: cliente
        ? {
            numeroDocumentoCliente: cliente.numeroDocumentoCliente,
            nombreCliente: cliente.nombreCliente,
            sistemas: cliente.sistemas,
          }
        : null,
    };
  });
  res.status(200).json({ data, total: data.length });
}

export async function createReunion(req: Request, res: Response) {
  const {
    numeroDocumentoCliente,
    idOrdenServicio,
    ejecutivo,
    fecha,
    horaInicio,
    modalidad,
    tipoReunion,
    lugarOLink,
    nota,
  } = req.body ?? {};

  if (!numeroDocumentoCliente || !ejecutivo || !esModalidadValida(modalidad)) {
    return res.status(400).json({
      message: "numeroDocumentoCliente, ejecutivo y modalidad (VIRTUAL|PRESENCIAL) son requeridos",
    });
  }

  // Reunion especial "en espera": sin fecha/horaInicio todavia — se salta la
  // validacion de horario (no hay horario que validar), el comentario de
  // disponibilidad del cliente queda en `nota`. Se le asigna horario real
  // despues via asignarHorarioReunion, que si pasa por validarHorario.
  if (!fecha || !horaInicio) {
    const created = await reunionesRepository.create({
      numeroDocumentoCliente: String(numeroDocumentoCliente),
      idOrdenServicio: idOrdenServicio ? Number(idOrdenServicio) : null,
      ejecutivo: String(ejecutivo),
      fecha: null,
      horaInicio: null,
      horaFin: null,
      modalidad,
      tipoReunion: tipoReunion ? String(tipoReunion) : null,
      lugarOLink: lugarOLink ? String(lugarOLink) : null,
      nota: nota ? String(nota) : null,
      estado: "EN_ESPERA",
      createdBy: req.usuario as string,
    });
    return res.status(201).json(created);
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
    tipoReunion: tipoReunion ? String(tipoReunion) : null,
    lugarOLink: lugarOLink ? String(lugarOLink) : null,
    nota: nota ? String(nota) : null,
    estado: "PROGRAMADA",
    createdBy: req.usuario as string,
  });
  res.status(201).json(created);
}

export async function updateReunionEstado(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { estado } = req.body ?? {};
  const estadosValidos: EstadoReunion[] = ["PROGRAMADA", "COMPLETADA", "CANCELADA", "EN_ESPERA"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ message: "estado invalido" });
  }
  const updated = await reunionesRepository.updateEstado(id, estado);
  if (!updated) {
    return res.status(404).json({ message: "Reunión no encontrada" });
  }
  res.status(200).json(updated);
}

// Le asigna horario real a una reunion EN_ESPERA (o la reprograma) — pasa
// por la misma validacion (horario de atencion + choques) que crear una
// reunion normal, como corresponde a una reunion real aunque haya nacido
// "especial".
export async function asignarHorarioReunion(req: Request, res: Response) {
  const id = Number(req.params.id);
  const { fecha, horaInicio } = req.body ?? {};
  if (!fecha || !horaInicio) {
    return res.status(400).json({ message: "fecha y horaInicio son requeridos" });
  }

  const reunion = await reunionesRepository.findById(id);
  if (!reunion) {
    return res.status(404).json({ message: "Reunión no encontrada" });
  }

  const existentes = await reunionesRepository.listProgramadasPorEjecutivoYFecha(
    reunion.ejecutivo,
    String(fecha)
  );
  const validacion = validarHorario(String(fecha), String(horaInicio), reunion.modalidad, existentes);
  if (!validacion.valido) {
    return res.status(409).json({ message: validacion.motivo });
  }

  const horaFin = calcularHoraFin(String(horaInicio), reunion.modalidad);
  const updated = await reunionesRepository.updateHorario(id, {
    fecha: String(fecha),
    horaInicio: String(horaInicio),
    horaFin,
  });
  res.status(200).json(updated);
}
