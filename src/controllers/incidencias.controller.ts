import type { Request, Response } from "express";
import axios from "axios";
import {
  mapIncidenciaItem,
  mapTipoIncidencia,
  type RawIncidenciaItem,
  type RawTipoIncidencia,
} from "../mappers/incidencias.mapper.js";
import {
  crearIncidencia,
  fetchIncidencias,
  fetchTipoIncidencias,
} from "../services/apiworking/externalApi.js";
import * as eventoOperativoRepository from "../repositories/eventoOperativo.repository.js";
import { getClientesExcluidos, getPostVentaDataset } from "../services/postventa/postventaCache.js";
import { decodeJwtPayload } from "../utils/jwt.js";

interface RawIncidenciasResponse {
  codResponse?: string;
  message?: string;
  data?: unknown;
}

// "No se encontraron incidencias" no es un error real — es como responde
// APIWorking cuando el filtro no matchea nada (confirmado con el cliente de
// prueba, que arranca sin incidencias). Antes esto se propagaba como error
// HTTP al frontend (mismo status/mensaje que devuelve APIWorking, un 400),
// que la ficha mostraba como "No se pudo cargar las incidencias" en vez de
// la lista vacia real.
function esSinResultados(data: unknown): boolean {
  return (
    !!data &&
    typeof data === "object" &&
    String((data as Record<string, unknown>).codResponse) === "0"
  );
}

export async function getIncidencias(req: Request, res: Response) {
  const numeroDocumentoCliente = req.query.numeroDocumentoCliente
    ? String(req.query.numeroDocumentoCliente)
    : "";
  if (!numeroDocumentoCliente) {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }

  try {
    const raw = (await fetchIncidencias(req.externalToken as string, {
      search: numeroDocumentoCliente,
    })) as RawIncidenciasResponse;

    const filas = Array.isArray(raw?.data) ? (raw.data as RawIncidenciaItem[]) : [];
    const incidencias = filas
      .map(mapIncidenciaItem)
      // Mas reciente primero, igual que historial de seguimiento.
      .sort((a, b) => (b.fecha ?? "").localeCompare(a.fecha ?? ""));

    res.status(200).json({
      data: incidencias,
      total: incidencias.length,
      abiertas: incidencias.filter((i) => !i.resuelta).length,
      resueltas: incidencias.filter((i) => i.resuelta).length,
    });
  } catch (error) {
    if (axios.isAxiosError(error) && esSinResultados(error.response?.data)) {
      return res.status(200).json({ data: [], total: 0, abiertas: 0, resueltas: 0 });
    }
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (typeof error.response?.data === "string" && error.response.data) ||
        (error.response?.data as { message?: string } | undefined)?.message ||
        "No se pudo obtener las incidencias";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al obtener incidencias:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}

export async function listTiposIncidencia(req: Request, res: Response) {
  try {
    const raw = (await fetchTipoIncidencias(req.externalToken as string)) as RawIncidenciasResponse;
    const filas = Array.isArray(raw?.data) ? (raw.data as RawTipoIncidencia[]) : [];
    const tipos = filas.map(mapTipoIncidencia).sort((a, b) => a.nombre.localeCompare(b.nombre));
    res.status(200).json({ data: tipos });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      return res.status(status).json({ message: "No se pudo obtener el catálogo de tipos de incidencia" });
    }
    console.error("Error inesperado al obtener tipos de incidencia:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}

// Asignacion automatica confirmada — ver Decisiones Fase 2. No hay catalogo
// de personas para ofrecer otra opcion todavia, asi que no es configurable.
const ASIGNADO_AUTOMATICO = 100;

export async function postIncidencia(req: Request, res: Response) {
  const { numeroDocumentoCliente, titulo, descripcion, tipo } = req.body ?? {};

  if (!numeroDocumentoCliente || typeof numeroDocumentoCliente !== "string") {
    return res.status(400).json({ message: "numeroDocumentoCliente es requerido" });
  }
  if (!titulo || typeof titulo !== "string" || !titulo.trim()) {
    return res.status(400).json({ message: "titulo es requerido" });
  }
  if (!descripcion || typeof descripcion !== "string" || !descripcion.trim()) {
    return res.status(400).json({ message: "descripcion es requerida" });
  }
  if (typeof tipo !== "number" || !Number.isInteger(tipo)) {
    return res.status(400).json({ message: "tipo debe ser el id numérico de un tipo de incidencia válido" });
  }

  // El id_usuario NUNCA viene del cliente (frontend/cookie): se lee del
  // propio JWT de sesion (req.externalToken), el mismo token que se usa para
  // llamar a APIWorking. No se verifica la firma nosotros — no hace falta:
  // si el token fuera invalido, APIWorking lo rechaza al usarlo mas abajo.
  // Auditoria de seguridad: antes esto vivia en una cookie propia
  // (pv_user_id) que, aunque HttpOnly, es editable por quien controla el
  // navegador — un dato que decide a quien se atribuye una escritura no
  // puede depender de eso.
  const claims = decodeJwtPayload<{ idusuario?: string }>(req.externalToken as string);
  const usuarioId = claims?.idusuario;
  if (!usuarioId) {
    return res.status(401).json({
      message: "No se pudo determinar el usuario autenticado desde la sesión — vuelve a iniciar sesión.",
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

  // No se envia un POST incompleto a APIWorking: si falta algo que el
  // contrato requiere, se corta aca con un error accionable en vez de
  // mandar idOrdenServicio o telefonoCliente vacios/inventados.
  if (!cliente.ordenVigente?.idOrdenServicio) {
    return res.status(422).json({
      message: "El cliente no tiene una orden de servicio vigente — no se puede crear la incidencia.",
    });
  }
  if (!cliente.telefonoEfectivo || !cliente.telefonoEfectivo.trim()) {
    return res.status(422).json({
      message:
        "El cliente no tiene un teléfono registrado — no se puede crear la incidencia hasta contar con uno.",
    });
  }

  try {
    // Se usa exclusivamente el token de la sesion autenticada — nunca
    // FALLBACK_API_TOKEN para escrituras (ver crearIncidencia en
    // externalApi.ts). Si el token no tiene permiso o expiro, el catch de
    // abajo devuelve ese error tal cual, sin reintentar con otra credencial.
    const resultado = await crearIncidencia(req.externalToken as string, {
      idOrdenServicio: String(cliente.ordenVigente.idOrdenServicio),
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      tipo,
      asignado: ASIGNADO_AUTOMATICO,
      asigna: Number(usuarioId),
      telefonoCliente: cliente.telefonoEfectivo,
      usuario: usuarioId,
    });

    if (String(resultado.codResponse) !== "1") {
      return res.status(502).json({ message: resultado.message ?? "APIWorking rechazó la incidencia" });
    }

    const numeroIncidencia = resultado.data?.numero ?? null;
    await eventoOperativoRepository.registrarSeguro({
      usuario: req.usuario as string,
      tipoAccion: "INCIDENCIA_CREADA",
      modulo: "INCIDENCIAS",
      numeroDocumentoCliente: numeroDocumentoCliente,
      entidadTipo: "INCIDENCIA",
      entidadId: numeroIncidencia ? String(numeroIncidencia) : null,
      detalle: titulo.trim(),
    });

    res.status(201).json({
      numero: numeroIncidencia,
      message: resultado.message ?? "Incidencia registrada correctamente",
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      if (status === 401 || status === 403) {
        return res.status(status).json({
          message:
            "Tu sesión no tiene permiso para crear incidencias en APIWorking, o expiró — vuelve a iniciar sesión e intenta de nuevo.",
        });
      }
      const message =
        (error.response?.data as { message?: string; title?: string } | undefined)?.message ||
        (error.response?.data as { title?: string } | undefined)?.title ||
        "No se pudo crear la incidencia en APIWorking";
      return res.status(status).json({ message });
    }
    console.error("Error inesperado al crear incidencia:", error);
    return res.status(500).json({ message: "Error inesperado" });
  }
}
