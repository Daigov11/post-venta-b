import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

// Referencia historica importada de clientes_de_baja.xlsx — seguimiento que
// ya se le hizo a un cliente suspendido/dado de baja ANTES de que existiera
// esta plataforma. Es solo lectura/contexto, no un pipeline activo (ver
// decision del negocio: "solo importar como referencia historica").
export interface BajaHistorico {
  numeroDocumentoCliente: string;
  idOrdenServicio: number;
  fechaBajaSuspension: string | null;
  fechaSeguimiento: string | null;
  medioComunicacion: string | null;
  resumenSeguimiento: string | null;
  estadoSeguimiento: string | null;
  estadoActual: string | null;
  observacionEncargado: string | null;
  fechaObservacionEncargado: string | null;
  resumenSeguimientoEncargado: string | null;
  fechaSeguimientoEncargado: string | null;
  estadoSeguimientoEncargado: string | null;
  medioComunicacionEncargado: string | null;
}

interface BajaHistoricoRow extends RowDataPacket {
  numero_documento_cliente: string;
  id_orden_servicio: number;
  fecha_baja_suspension: Date | null;
  fecha_seguimiento: Date | null;
  medio_comunicacion: string | null;
  resumen_seguimiento: string | null;
  estado_seguimiento: string | null;
  estado_actual: string | null;
  observacion_encargado: string | null;
  fecha_observacion_encargado: Date | null;
  resumen_seguimiento_encargado: string | null;
  fecha_seguimiento_encargado: Date | null;
  estado_seguimiento_encargado: string | null;
  medio_comunicacion_encargado: string | null;
}

function toIso(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDomain(row: BajaHistoricoRow): BajaHistorico {
  return {
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    fechaBajaSuspension: toIso(row.fecha_baja_suspension),
    fechaSeguimiento: toIso(row.fecha_seguimiento),
    medioComunicacion: row.medio_comunicacion,
    resumenSeguimiento: row.resumen_seguimiento,
    estadoSeguimiento: row.estado_seguimiento,
    estadoActual: row.estado_actual,
    observacionEncargado: row.observacion_encargado,
    fechaObservacionEncargado: toIso(row.fecha_observacion_encargado),
    resumenSeguimientoEncargado: row.resumen_seguimiento_encargado,
    fechaSeguimientoEncargado: toIso(row.fecha_seguimiento_encargado),
    estadoSeguimientoEncargado: row.estado_seguimiento_encargado,
    medioComunicacionEncargado: row.medio_comunicacion_encargado,
  };
}

export async function findAllByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, BajaHistorico>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<BajaHistoricoRow[]>(
    "SELECT * FROM postventa_baja_historico WHERE numero_documento_cliente IN (?)",
    [numerosDocumentoCliente]
  );
  const map = new Map<string, BajaHistorico>();
  for (const row of rows) {
    const domain = toDomain(row);
    map.set(domain.numeroDocumentoCliente, domain);
  }
  return map;
}
