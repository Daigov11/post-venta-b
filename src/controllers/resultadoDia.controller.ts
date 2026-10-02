import type { Request, Response } from "express";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import * as resultadoDiaRepository from "../repositories/resultadoDia.repository.js";
import type { ResultadoDia, TipoConversion } from "../types/postventa.js";

const TIPOS_CONVERSION: TipoConversion[] = ["EQUIPO", "PLAN", "MODULO"];

// El proceso corre con TZ=America/Lima (ver server.ts) — getFullYear/getMonth/
// getDate respetan esa TZ. A diferencia de fechaISO() en otros controllers
// (que usa toISOString(), siempre UTC), aca importa que "hoy" sea el dia
// calendario de Lima y no el de UTC, sobre todo de tarde/noche.
function hoyLimaISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function numeroEnteroValido(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export async function getResultadoHoy(req: Request, res: Response) {
  const usuario = req.usuario as string;
  const fecha = hoyLimaISO();
  const resultado = await resultadoDiaRepository.findByUsuarioFecha(usuario, fecha);
  res.status(200).json({ resultado, fecha });
}

export async function abrirDia(req: Request, res: Response) {
  const usuario = req.usuario as string;
  const fecha = hoyLimaISO();
  const { montoApertura } = req.body ?? {};

  if (typeof montoApertura !== "number" || !Number.isFinite(montoApertura) || montoApertura < 0) {
    return res.status(400).json({ message: "montoApertura debe ser un número mayor o igual a 0" });
  }

  const existente = await resultadoDiaRepository.findByUsuarioFecha(usuario, fecha);
  if (existente) {
    return res.status(409).json({ message: "Ya existe un día abierto (o cerrado) para hoy", resultado: existente });
  }

  const creado = await resultadoDiaRepository.abrir({ usuario, fecha, montoApertura });

  await eventoOperativoRepository.registrarSeguro({
    usuario,
    tipoAccion: "DIA_ABIERTO",
    modulo: "RESULTADOS",
    entidadTipo: "RESULTADO_DIA",
    entidadId: String(creado.id),
    detalle: `Apertura: S/ ${montoApertura.toFixed(2)}`,
  });

  res.status(201).json(creado);
}

async function cargarResultadoPropioAbierto(
  req: Request,
  res: Response
): Promise<ResultadoDia | null> {
  const id = Number(req.params.id);
  const resultado = await resultadoDiaRepository.findById(id);
  if (!resultado) {
    res.status(404).json({ message: "Registro no encontrado" });
    return null;
  }
  if (resultado.usuario !== req.usuario) {
    res.status(403).json({ message: "Este día no pertenece al usuario actual" });
    return null;
  }
  if (resultado.estado === "CERRADO") {
    res.status(409).json({ message: "El día ya está cerrado — no se puede modificar" });
    return null;
  }
  return resultado;
}

export async function registrarAccion(req: Request, res: Response) {
  const resultado = await cargarResultadoPropioAbierto(req, res);
  if (!resultado) return;

  const { tipo, realizadas, noRealizadas } = req.body ?? {};
  if (typeof tipo !== "string" || tipo.trim().length === 0) {
    return res.status(400).json({ message: "tipo es requerido" });
  }
  if (!numeroEnteroValido(realizadas) || !numeroEnteroValido(noRealizadas)) {
    return res
      .status(400)
      .json({ message: "realizadas y noRealizadas deben ser números enteros mayores o iguales a 0" });
  }

  const accion = await resultadoDiaRepository.upsertAccion(resultado.id, {
    tipo: tipo.trim(),
    realizadas,
    noRealizadas,
  });
  res.status(200).json(accion);
}

export async function eliminarAccion(req: Request, res: Response) {
  const resultado = await cargarResultadoPropioAbierto(req, res);
  if (!resultado) return;
  const { tipo } = req.params;
  await resultadoDiaRepository.eliminarAccion(resultado.id, tipo);
  res.status(204).send();
}

export async function registrarConversion(req: Request, res: Response) {
  const resultado = await cargarResultadoPropioAbierto(req, res);
  if (!resultado) return;

  const { tipo, cantidad, detalle } = req.body ?? {};
  if (!TIPOS_CONVERSION.includes(tipo)) {
    return res.status(400).json({ message: `tipo debe ser uno de: ${TIPOS_CONVERSION.join(", ")}` });
  }
  if (!numeroEnteroValido(cantidad)) {
    return res.status(400).json({ message: "cantidad debe ser un número entero mayor o igual a 0" });
  }

  const conversion = await resultadoDiaRepository.upsertConversion(resultado.id, {
    tipo,
    cantidad,
    detalle: detalle ? String(detalle).trim() || null : null,
  });

  await eventoOperativoRepository.registrarSeguro({
    usuario: req.usuario as string,
    tipoAccion: "CONVERSION_REGISTRADA",
    modulo: "RESULTADOS",
    entidadTipo: "CONVERSION",
    entidadId: `${resultado.id}:${tipo}`,
    detalle: `${tipo}: ${cantidad}`,
  });

  res.status(200).json(conversion);
}

export async function cerrarDia(req: Request, res: Response) {
  const resultado = await cargarResultadoPropioAbierto(req, res);
  if (!resultado) return;

  const { observacionCierre, avisoAdministracion, motivoAviso } = req.body ?? {};
  if (avisoAdministracion !== undefined && typeof avisoAdministracion !== "boolean") {
    return res.status(400).json({ message: "avisoAdministracion debe ser true o false" });
  }
  const requiereAviso = avisoAdministracion === true;
  if (requiereAviso && (typeof motivoAviso !== "string" || motivoAviso.trim().length === 0)) {
    return res
      .status(400)
      .json({ message: "motivoAviso es requerido cuando se marca aviso a administración" });
  }

  const cerrado = await resultadoDiaRepository.cerrar(resultado.id, {
    observacionCierre: observacionCierre ? String(observacionCierre).trim() || null : null,
    avisoAdministracion: requiereAviso,
    motivoAviso: requiereAviso ? String(motivoAviso).trim() : null,
  });

  await eventoOperativoRepository.registrarSeguro({
    usuario: req.usuario as string,
    tipoAccion: "DIA_CERRADO",
    modulo: "RESULTADOS",
    entidadTipo: "RESULTADO_DIA",
    entidadId: String(cerrado.id),
    detalle: requiereAviso ? `Con aviso a administración: ${motivoAviso}` : "Sin aviso a administración",
  });

  res.status(200).json(cerrado);
}

// Detalle completo de un dia historico (apertura, acciones, conversiones,
// cierre, aviso) — sin restriccion de propietario a proposito: el historico
// (listHistorico) ya lista dias de todos los usuarios para revision de
// equipo/administracion, este detalle es la contraparte de lectura de esa
// misma vista, no una escritura.
export async function getResultadoDetalle(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "id inválido" });
  }
  const resultado = await resultadoDiaRepository.findById(id);
  if (!resultado) {
    return res.status(404).json({ message: "Registro no encontrado" });
  }
  res.status(200).json(resultado);
}

export async function listHistorico(req: Request, res: Response) {
  const usuario = req.query.usuario ? String(req.query.usuario) : undefined;
  const desde = req.query.desde ? String(req.query.desde) : undefined;
  const hasta = req.query.hasta ? String(req.query.hasta) : undefined;
  const historico = await resultadoDiaRepository.listHistorico({ usuario, desde, hasta });
  res.status(200).json({ data: historico });
}
