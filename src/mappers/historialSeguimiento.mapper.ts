import type { HistorialSeguimientoEvento } from "../types/postventa.js";

export interface RawHistorialSeguimientoItem {
  total?: number;
  id_ordenservicio?: number;
  item?: number;
  npersona?: string;
  fecha_creacion?: string;
  observacion?: string;
  nestado?: string;
  id_estado?: number;
}

// observacion a veces trae HTML suelto (de un editor de texto enriquecido
// usado internamente en APIWorking, ej. "<p>pago</p>") — se limpia a texto
// plano para no renderizar HTML crudo en la UI.
function limpiarObservacion(raw: string | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

// fecha_creacion viene "YYYY-MM-DDTHH:mm:ss" sin offset — se asume hora local
// de Peru (mismo supuesto que el resto del pipeline, servidor fijado a
// America/Lima) y se normaliza a ISO con new Date() nativo.
function parseFechaCreacion(raw: string | undefined): string | null {
  if (!raw) return null;
  const fecha = new Date(raw);
  return Number.isNaN(fecha.getTime()) ? null : fecha.toISOString();
}

export function mapHistorialSeguimientoItem(
  raw: RawHistorialSeguimientoItem
): HistorialSeguimientoEvento {
  return {
    fecha: parseFechaCreacion(raw.fecha_creacion),
    idEstado: raw.id_estado ?? 0,
    estado: raw.nestado ?? "",
    persona: raw.npersona ?? "",
    observacion: limpiarObservacion(raw.observacion),
  };
}
