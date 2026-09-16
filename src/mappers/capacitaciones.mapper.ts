import type { Capacitacion } from "../types/postventa.js";

export interface RawCapacitacionItem {
  idx?: number;
  titulo?: string;
  id_capacitacion?: number;
  fecha?: string;
  hora?: string;
  fecha_final?: string;
  hora_final?: string;
  deuda_hace_7_dias?: string;
  tipo?: string;
}

// Todo el dato util viene mezclado en un solo bloque de HTML libre dentro de
// "titulo" (nombre del capacitador, RUC, direccion, modalidad, etc.) — no
// hay campos separados en la respuesta real. Se extrae por regex, con
// fallback a null si no matchea; nunca se inventa un valor.
function extraerCampo(titulo: string, etiqueta: string): string | null {
  const match = titulo.match(new RegExp(`${etiqueta}:\\s*([^<]+?)\\s*(?:<br|$)`, "i"));
  return match ? match[1].trim() : null;
}

// "1/20/2020 12:00:00 AM" (siempre medianoche, la hora real viene aparte en
// hora/hora_final) + "13:00:00" -> datetime real combinado.
function combinarFechaHora(fecha: string | undefined, hora: string | undefined): string | null {
  if (!fecha) return null;
  const soloFecha = new Date(fecha);
  if (Number.isNaN(soloFecha.getTime())) return null;
  const fechaIso = soloFecha.toISOString().slice(0, 10);
  const combinado = new Date(`${fechaIso}T${hora ?? "00:00:00"}`);
  return Number.isNaN(combinado.getTime()) ? soloFecha.toISOString() : combinado.toISOString();
}

export function mapCapacitacionItem(raw: RawCapacitacionItem): Capacitacion {
  const titulo = raw.titulo ?? "";
  // Cancelada = todo el bloque viene envuelto en <del>...</del> — visto en
  // datos reales, no documentado. Tiene prioridad sobre "CAPACITADO" porque
  // ese texto puede seguir apareciendo dentro del tachado.
  const cancelada = /<del>/i.test(titulo);
  const estado: Capacitacion["estado"] = cancelada
    ? "CANCELADA"
    : /CAPACITADO/i.test(titulo)
      ? "CAPACITADO"
      : "PENDIENTE";
  const tipoMatch = titulo.match(/<b>(CAPACITACION|REFORZAMIENTO)<\/b>/i);
  const rucMatch = titulo.match(/RUC:\s*(\d{8,11})/);
  const osMatch = titulo.match(/\b(OS-\d+)\b/);

  return {
    idCapacitacion: raw.id_capacitacion ?? 0,
    tipo: tipoMatch ? tipoMatch[1].toUpperCase() : "",
    estado,
    numeroDocumentoCliente: rucMatch ? rucMatch[1] : null,
    numeroOs: osMatch ? osMatch[1] : null,
    fecha: combinarFechaHora(raw.fecha, raw.hora),
    fechaFinal: combinarFechaHora(raw.fecha_final, raw.hora_final),
    capacitador: extraerCampo(titulo, "Capacitador"),
    agendador: extraerCampo(titulo, "Agendador"),
    vendedor: extraerCampo(titulo, "Vendedor"),
    modalidad: extraerCampo(titulo, "Modalidad"),
  };
}

// Indexado por RUC para lookup O(1) desde el controller — un cliente puede
// tener varias capacitaciones (inicial + reforzamientos). Las que no traen
// RUC parseable (~2.5% del total, solicitudes sueltas sin cliente formal
// asociado) quedan fuera del indice, no se pueden asociar a nadie.
export function indexarCapacitacionesPorCliente(
  rows: RawCapacitacionItem[]
): Map<string, Capacitacion[]> {
  const map = new Map<string, Capacitacion[]>();
  for (const row of rows) {
    const capacitacion = mapCapacitacionItem(row);
    if (!capacitacion.numeroDocumentoCliente) continue;
    const lista = map.get(capacitacion.numeroDocumentoCliente);
    if (lista) lista.push(capacitacion);
    else map.set(capacitacion.numeroDocumentoCliente, [capacitacion]);
  }
  return map;
}
