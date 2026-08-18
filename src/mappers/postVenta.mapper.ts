import { parseDmyDate, parseDmyDateTime, toIsoOrNull } from "./enrichment/dateParsing.js";
import type { PostVentaExtra, RawPostVenta } from "../types/postventa.js";

// "S/ 4,940.00" -> 4940. null si no viene o no se puede parsear (nunca se
// inventa un monto).
function parseMontoSoles(raw: string | null): number | null {
  if (!raw) return null;
  const limpio = raw.replace(/[^\d.]/g, "");
  if (!limpio) return null;
  const monto = Number(limpio);
  return Number.isFinite(monto) ? monto : null;
}

export function mapPostVentaToExtra(raw: RawPostVenta): PostVentaExtra {
  return {
    idSistema: raw.id_sistema ?? null,
    nSistema: raw.nsistema ?? null,
    nombreComercial: raw.nombre_comercial ?? null,
    fechaActivacion: toIsoOrNull(parseDmyDate(raw.fecha_activacion)),
    nCicloFacturacion: raw.nCicloFacturacion ?? null,
    nEstadoSistema: raw.nEstadoSistema ?? null,
    nEstadoSunat: raw.nEstadoSunat ?? null,
    nEstadoCapacitado: raw.nEstadoCapacitado ?? null,
    nAfiliadoSunat: raw.nAfiliadoSunat ?? null,
    nModo: raw.nModo ?? null,
    visualizarSunat: Number(raw.visualizar_sunat) > 0,
    suspendido: raw.suspendido === "1",
    acargo: raw.acargo ?? null,
    fechaVencimientoCertificado: toIsoOrNull(
      parseDmyDate(raw.fecha_vencimiento_certificado_formato)
    ),
    fechaInactivo: toIsoOrNull(parseDmyDateTime(raw.fecha_inactivo_formato)),
    cantidadComprobantesMensual: Number(raw.cantidadComprobantesMensual) || 0,
    comprobantesMensualDesglose: {
      bv: Number(raw.cantidadMensualBV) || 0,
      fv: Number(raw.cantidadMensualFV) || 0,
      nv: Number(raw.cantidadMensualNV) || 0,
      otros: Number(raw.cantidadMensualOtros) || 0,
    },
    ingresosClienteMensual: parseMontoSoles(raw.ingresosClienteMensual),
    instalado: raw.instalado === "1",
    meses: raw.meses != null && Number.isFinite(Number(raw.meses)) ? Number(raw.meses) : null,
    fechaInstalacion: toIsoOrNull(parseDmyDate(raw.fecha_instalacion)),
  };
}

// Mapa idOrdenServicio -> PostVentaExtra para cruzar con orden-servicio en
// O(1). Si el mismo idOrdenServicio aparece mas de una vez (no deberia), se
// queda con la ultima fila vista.
export function indexarPostVentaPorOrdenServicio(
  rows: RawPostVenta[]
): Map<number, PostVentaExtra> {
  const map = new Map<number, PostVentaExtra>();
  for (const row of rows) {
    map.set(row.id_ordenservicio, mapPostVentaToExtra(row));
  }
  return map;
}
