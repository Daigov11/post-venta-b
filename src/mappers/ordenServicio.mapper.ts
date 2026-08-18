import type {
  OsRefNormalized,
  PagoNormalizado,
  PostVentaExtra,
  RawOrdenServicio,
  RawPago,
} from "../types/postventa.js";
import { calcularDocumentacion } from "./enrichment/documentacion.js";
import { parseDmyDate, parseUsDateTime, toIsoOrNull } from "./enrichment/dateParsing.js";

function mapPago(raw: RawPago): PagoNormalizado {
  return {
    nroComprobante: raw.nroComprobante,
    fechaEmitido: toIsoOrNull(parseDmyDate(raw.fechaEmitido)),
    total: Number(raw.total) || 0,
    deuda: Number(raw.deuda) || 0,
    origen: raw.origen ?? "",
  };
}

export function mapOrdenServicioToOsRef(
  raw: RawOrdenServicio,
  postVentaExtra: PostVentaExtra | null = null
): OsRefNormalized {
  const tieneDistribuidor = Boolean(raw.idDistribuidor || raw.nDistribuidor);

  return {
    idOrdenServicio: raw.idOrdenServicio,
    numeroOs: raw.numeroOs ?? "S/N",
    fechaOs: toIsoOrNull(parseUsDateTime(raw.fechaOs)),
    fechaSistema: toIsoOrNull(parseUsDateTime(raw.fechaSistema)),
    // numeroDocumentoCliente es la clave de agrupacion por cliente — si viene
    // null se usa un identificador sintetico por OS para no fusionar por
    // error registros de clientes distintos bajo la misma clave.
    numeroDocumentoCliente: raw.numeroDocumentoCliente ?? `SIN_DOCUMENTO_OS_${raw.idOrdenServicio}`,
    nombreCliente: raw.cliente ?? "Cliente sin nombre",
    telefono: raw.telefono ?? null,
    nUbigeo: raw.nUbigeo ?? null,
    pruebaFechaInicio: raw.pruebaFechaInicio ?? null,
    nombrePlan: raw.nombrePlan ?? "Sin plan asignado",
    nTipoPlan: raw.nTipoPlan ?? null,
    tipoOS: raw.nTipoOS ?? "",
    tipoCodigo: raw.tipo ?? "",
    idEstadoApiWorking: raw.idEstado ?? "",
    nEstadoApiWorking: raw.nEstado ?? "Sin estado",
    deuda: Number(raw.deuda) || 0,
    deudaProyectada: Number(raw.deudaProyectada) || 0,
    existeEquipo: Number(raw.existeEquipo) > 0,
    idEquipo: raw.idEquipo ?? null,
    documentacion: calcularDocumentacion(raw),
    facturas: {
      disponibles: Number(raw.existeFactura) || 0,
      equipoDisponibles: Number(raw.existeFacturaEquipo) || 0,
    },
    cantidadComprobantes: Number(raw.cantidadComprobantes) || 0,
    distribuidor: tieneDistribuidor
      ? {
          id: raw.idDistribuidor ?? null,
          nombre: raw.nDistribuidor ?? raw.principalDistribuidor ?? null,
        }
      : null,
    facturable: raw.flagFacturacion === "1",
    linkSistema: raw.linkSistema ?? null,
    ejecutivo: raw.ejecutivo ?? null,
    pagos: Array.isArray(raw.pagos) ? raw.pagos.map(mapPago) : [],
    postVentaExtra,
  };
}
