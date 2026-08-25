import type { Incidencia } from "../types/postventa.js";

export interface RawIncidenciaItem {
  total?: number;
  id_incidencia?: number;
  id_ordenservicio?: number;
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
