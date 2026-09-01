import type { Incidencia } from "../types/postventa.js";

export interface RawIncidenciaItem {
  total?: number;
  id_incidencia?: number;
  id_ordenservicio?: number;
  // Usado solo por el pull masivo (fetchAllIncidencias) para indexar por
  // cliente — el endpoint por cliente lo trae tambien pero no lo necesita,
  // ya se sabe de antemano.
  numerodocumento_cliente?: string;
  numero_os?: string;
  fecha_creacion?: string;
  caso?: string;
  ntipoincidencia?: string;
  nestado?: string;
  condicion?: string;
  asignadopor?: string;
  asignadoa?: string;
  acargo?: string;
  telefono?: string;
  descripcion?: string;
  enviadoporcliente?: string;
  automatico?: string;
}

// descripcion viene con HTML suelto de un editor enriquecido interno de
// APIWorking (mismo patron que observacion en historial-seguimiento.mapper).
function limpiarDescripcion(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// fecha_creacion viene "YYYY-MM-DDTHH:mm:ss" sin offset — mismo supuesto de
// hora local de Peru que el resto del pipeline (servidor fijado a America/Lima).
function parseFechaCreacion(raw: string | undefined): string | null {
  if (!raw) return null;
  const fecha = new Date(raw);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function mapIncidenciaItem(raw: RawIncidenciaItem): Incidencia {
  return {
    idIncidencia: raw.id_incidencia ?? 0,
    idOrdenServicio: raw.id_ordenservicio ?? 0,
    numeroOs: raw.numero_os ?? "",
    fecha: parseFechaCreacion(raw.fecha_creacion),
    caso: raw.caso ?? "",
    tipo: raw.ntipoincidencia ?? "",
    estado: raw.nestado ?? "",
    // "C" = cerrada/resuelta, "A" = abierta — confirmado contra datos reales
    // (nestado va de la mano: "RESUELTO" cuando condicion es "C").
    resuelta: raw.condicion === "C",
    asignadoPor: raw.asignadopor ?? "",
    asignadoA: raw.asignadoa ?? "",
    aCargo: raw.acargo ?? "",
    telefono: raw.telefono || null,
    descripcion: limpiarDescripcion(raw.descripcion),
    reportadoPorCliente: raw.enviadoporcliente === "1",
    automatico: raw.automatico === "1",
  };
}

// Señales derivadas de tipos de incidencia especificos, sin resolver — cada
// una alimenta su propia alerta (ALTA_PENDIENTE, CERTIFICADO_POR_VENCER,
// CERTIFICADO_VENCE_HOY, ver alertas.engine.ts). Calculadas una sola vez por
// el sync diario (fetchAllIncidencias) sobre las 36k+ incidencias historicas,
// nunca por request de usuario.
const TIPO_ALTA = "DAR DE ALTA AL CLIENTE";
const TIPO_CERT_POR_VENCER = "CERTIFICADO DIGITAL POR VENCER";
const TIPO_CERT_VENCE_HOY = "CERTIFICADO DIGITAL SE VENCE HOY";

export interface SenalesIncidenciasCliente {
  altaPendiente: boolean;
  certificadoPorVencer: boolean;
  certificadoVenceHoy: boolean;
}

export function indexarSenalesIncidenciasPorCliente(
  rows: RawIncidenciaItem[]
): Map<string, SenalesIncidenciasCliente> {
  const map = new Map<string, SenalesIncidenciasCliente>();
  function marcar(numeroDocumento: string, campo: keyof SenalesIncidenciasCliente) {
    let entry = map.get(numeroDocumento);
    if (!entry) {
      entry = { altaPendiente: false, certificadoPorVencer: false, certificadoVenceHoy: false };
      map.set(numeroDocumento, entry);
    }
    entry[campo] = true;
  }
  for (const row of rows) {
    const numeroDocumento = row.numerodocumento_cliente?.trim();
    if (!numeroDocumento) continue;
    if (row.condicion === "C") continue; // solo interesan las que siguen abiertas
    const tipo = (row.ntipoincidencia ?? "").trim().toUpperCase();
    if (tipo === TIPO_ALTA) marcar(numeroDocumento, "altaPendiente");
    else if (tipo === TIPO_CERT_VENCE_HOY) marcar(numeroDocumento, "certificadoVenceHoy");
    else if (tipo === TIPO_CERT_POR_VENCER) marcar(numeroDocumento, "certificadoPorVencer");
  }
  return map;
}
