import type { Request, Response } from "express";
import axios from "axios";
import {
  mapHistorialSeguimientoItem,
  type RawHistorialSeguimientoItem,
} from "../mappers/historialSeguimiento.mapper.js";
import { crearSeguimiento, fetchHistorialSeguimiento } from "../services/apiworking/externalApi.js";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import * as sesionApiWorkingRepository from "../repositories/sesionApiWorking.repository.js";
import { getClientesExcluidos, getPostVentaDataset } from "../services/postventa/postventaCache.js";
import { env } from "../config/env.js";
import { hmacTokenId } from "../utils/jwt.js";

interface RawHistorialResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

export async function getHistorialSeguimiento(req: Request, res: Response) {
  const idOrdenServicio = req.query.idOrdenServicio ? String(req.query.idOrdenServicio) : "";
  if (!idOrdenServicio) {
    return res.status(400).json({ message: "idOrdenServicio es requerido" });
  }

  try {
    const raw = (await fetchHistorialSeguimiento(req.externalToken as string, {
      idOrdenServicio,
    })) as RawHistorialResponse;

    const filas = Array.isArray(raw?.data) ? (raw.data as RawHistorialSeguimientoItem[]) : [];
    const eventos = filas
      .map(mapHistorialSeguimientoItem)
      // Mas reciente primero — es un timeline de actividad, lo ultimo es lo
      // que mas le importa a quien lo esta revisando.
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    res.status(200).json({ data: eventos, total: eventos.length });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo obtener el historial de seguimiento";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al obtener historial de seguimiento:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}

export async function postSeguimiento(req: Request, res: Response) {
  const { numeroDocumentoCliente, observacion } = req.body ?? {};

  if (!numeroDocumentoCliente || typeof numeroDocumentoCliente !== "string") {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  if (!observacion || typeof observacion !== "string" || !observacion.trim()) {
    return res.status(400).json({ message: "observacion es requerida" });
  }

  // idPersona NUNCA viene del frontend — se resuelve server-side desde
  // postventa_sesion_apiworking, indexada por HMAC del JWT de la sesion
  // actual (ver auditoria de seguridad de "crear incidencia" / auth.controller.ts).
  const tokenHmac = hmacTokenId(req.externalToken as string, env.sessionHmacSecret);
  const idPersona = await sesionApiWorkingRepository.findIdPersonaVigente(tokenHmac);
  if (!idPersona) {
    return res.status(401).json({
      message:
        "No se pudo determinar la persona autenticada para esta sesión (o venció) — vuelve a iniciar sesión.",
    });
  }

  const dataset = await getPostVentaDataset();
  let cliente = dataset.clientes.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);
  if (!cliente) {
    const excluidos = await getClientesExcluidos();
    cliente = excluidos.find((c) => c.numeroDocumentoCliente === numeroDocumentoCliente);
  }
  if (!cliente) {
    return res.status(404).json({ message: "Cliente no encontrado" });
  }
  if (!cliente.ordenVigente?.idOrdenServicio) {
    return res.status(422).json({
      message: "El cliente no tiene una orden de servicio vigente — no se puede registrar el seguimiento.",
    });
  }

  const idOrdenServicio = String(cliente.ordenVigente.idOrdenServicio);

  // APIWorking rechaza estado:null con HTTP 400 "One or more validation
  // errors occurred" pese a que su propio swagger marca el campo como
  // nullable (confirmado en prueba controlada real, Fase 2 Postventa —
  // Seguimientos). No hay catalogo de estados valido para inventar uno, asi
  // que se relee el propio historial de la orden y se reenvia el id_estado
  // del evento mas reciente tal cual — nunca un valor distinto al que la
  // orden ya tiene registrado.
  let estadoVigente: number | null = null;
  try {
    const rawHistorial = (await fetchHistorialSeguimiento(req.externalToken as string, {
      idOrdenServicio,
    })) as RawHistorialResponse;
    const filas = Array.isArray(rawHistorial?.data)
      ? (rawHistorial.data as RawHistorialSeguimientoItem[])
      : [];
    const eventos = filas
      .map(mapHistorialSeguimientoItem)
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));
    estadoVigente = eventos[0]?.idEstado ?? null;
  } catch {
    estadoVigente = null;
  }

  if (estadoVigente === null) {
    return res.status(422).json({
      message:
        "No se pudo determinar el estado vigente de la orden a partir de su historial — no se puede registrar el seguimiento sin inventar un estado.",
    });
  }

  try {
    // Se usa exclusivamente el token de la sesion autenticada, nunca
    // FALLBACK_API_TOKEN para esta escritura.
    const resultado = await crearSeguimiento(req.externalToken as string, {
      idOrdenServicio,
      estado: String(estadoVigente),
      idPersona,
      observacion: observacion.trim(),
    });

    if (String(resultado.codResponse) !== "1") {
      return res.status(502).json({ message: resultado.message ?? "APIWorking rechazó el seguimiento" });
    }

    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion: "SEGUIMIENTO_REGISTRADO",
      modulo: "SEGUIMIENTOS",
      numeroDocumentoCliente,
      entidadTipo: "ORDEN_SERVICIO",
      entidadId: idOrdenServicio,
      detalle: observacion.trim(),
    });

    res.status(201).json({ message: resultado.message ?? "Seguimiento registrado correctamente" });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      if (status === 401 || status === 403) {
        return res.status(status).json({
          message:
            "Tu sesión no tiene permiso para registrar seguimientos en APIWorking, o expiró — vuelve a iniciar sesión e intenta de nuevo.",
        });
      }
      const message =
        (error.response?.data as { message?: string; title?: string } | undefined)?.message ||
        (error.response?.data as { title?: string } | undefined)?.title ||
        "No se pudo registrar el seguimiento en APIWorking";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al crear seguimiento:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}
