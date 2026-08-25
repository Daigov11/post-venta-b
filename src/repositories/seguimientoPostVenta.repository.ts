import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type {
  EstadoPipelineSeguimiento,
  OrigenSeguimiento,
  SeguimientoCliente,
  SeguimientoEtapa,
} from "../types/postventa.js";

interface SeguimientoClienteRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number;
  fecha_inicio: Date;
  estado_pipeline: EstadoPipelineSeguimiento;
  origen: OrigenSeguimiento;
  created_at: Date;
  updated_at: Date;
}

interface SeguimientoEtapaRow extends RowDataPacket {
  id: number;
  seguimiento_cliente_id: number;
  etapa: number;
  fecha_realizado: Date | null;
  medio_comunicacion: string | null;
  estado_seguimiento: string | null;
  resumen: string | null;
  solicitud_cliente: string | null;
  usuario: string | null;
  created_at: Date;
  updated_at: Date;
}

function clienteToDomain(row: SeguimientoClienteRow): SeguimientoCliente {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    fechaInicio: row.fecha_inicio.toISOString().slice(0, 10),
    estadoPipeline: row.estado_pipeline,
    origen: row.origen,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function etapaToDomain(row: SeguimientoEtapaRow): SeguimientoEtapa {
  return {
    id: row.id,
    seguimientoClienteId: row.seguimiento_cliente_id,
    etapa: row.etapa as 1 | 2 | 3,
    fechaRealizado: row.fecha_realizado ? row.fecha_realizado.toISOString().slice(0, 10) : null,
    medioComunicacion: row.medio_comunicacion,
    estadoSeguimiento: row.estado_seguimiento,
    resumen: row.resumen,
    solicitudCliente: row.solicitud_cliente,
    usuario: row.usuario,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listClientes(): Promise<SeguimientoCliente[]> {
  const [rows] = await pool.query<SeguimientoClienteRow[]>(
    "SELECT * FROM postventa_seguimiento_cliente ORDER BY fecha_inicio DESC"
  );
  return rows.map(clienteToDomain);
}

export async function findClienteByNumero(
  numeroDocumentoCliente: string
): Promise<SeguimientoCliente | null> {
  const [rows] = await pool.query<SeguimientoClienteRow[]>(
    "SELECT * FROM postventa_seguimiento_cliente WHERE numero_documento_cliente = ?",
    [numeroDocumentoCliente]
  );
  return rows[0] ? clienteToDomain(rows[0]) : null;
}

export async function existingNumeros(
  numerosDocumentoCliente: string[]
): Promise<Set<string>> {
  if (numerosDocumentoCliente.length === 0) return new Set();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT numero_documento_cliente FROM postventa_seguimiento_cliente WHERE numero_documento_cliente IN (?)",
    [numerosDocumentoCliente]
  );
  return new Set(rows.map((r) => r.numero_documento_cliente as string));
}

export async function insertCliente(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number;
  fechaInicio: string;
  origen: OrigenSeguimiento;
  estadoPipeline?: EstadoPipelineSeguimiento;
}): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO postventa_seguimiento_cliente
      (numero_documento_cliente, id_orden_servicio, fecha_inicio, origen, estado_pipeline)
     VALUES (?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.fechaInicio,
      input.origen,
      input.estadoPipeline ?? "EN_PROCESO",
    ]
  );
}

export async function updateEstadoPipeline(
  numeroDocumentoCliente: string,
  estadoPipeline: EstadoPipelineSeguimiento
): Promise<void> {
  await pool.query(
    "UPDATE postventa_seguimiento_cliente SET estado_pipeline = ? WHERE numero_documento_cliente = ?",
    [estadoPipeline, numeroDocumentoCliente]
  );
}

export async function findEtapasByCliente(
  seguimientoClienteId: number
): Promise<SeguimientoEtapa[]> {
  const [rows] = await pool.query<SeguimientoEtapaRow[]>(
    "SELECT * FROM postventa_seguimiento_etapa WHERE seguimiento_cliente_id = ? ORDER BY etapa ASC",
    [seguimientoClienteId]
  );
  return rows.map(etapaToDomain);
}

export async function findEtapasByClientes(
  seguimientoClienteIds: number[]
): Promise<Map<number, SeguimientoEtapa[]>> {
  const map = new Map<number, SeguimientoEtapa[]>();
  if (seguimientoClienteIds.length === 0) return map;
  const [rows] = await pool.query<SeguimientoEtapaRow[]>(
    "SELECT * FROM postventa_seguimiento_etapa WHERE seguimiento_cliente_id IN (?) ORDER BY etapa ASC",
    [seguimientoClienteIds]
  );
  for (const row of rows) {
    const etapa = etapaToDomain(row);
    const arr = map.get(etapa.seguimientoClienteId) ?? [];
    arr.push(etapa);
    map.set(etapa.seguimientoClienteId, arr);
  }
  return map;
}

export async function upsertEtapa(input: {
  seguimientoClienteId: number;
  etapa: 1 | 2 | 3;
  fechaRealizado: string | null;
  medioComunicacion: string | null;
  estadoSeguimiento: string | null;
  resumen: string | null;
  solicitudCliente: string | null;
  usuario: string | null;
}): Promise<void> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_seguimiento_etapa
      (seguimiento_cliente_id, etapa, fecha_realizado, medio_comunicacion, estado_seguimiento, resumen, solicitud_cliente, usuario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      fecha_realizado = VALUES(fecha_realizado),
      medio_comunicacion = VALUES(medio_comunicacion),
      estado_seguimiento = VALUES(estado_seguimiento),
      resumen = VALUES(resumen),
      solicitud_cliente = VALUES(solicitud_cliente),
      usuario = VALUES(usuario)`,
    [
      input.seguimientoClienteId,
      input.etapa,
      input.fechaRealizado,
      input.medioComunicacion,
      input.estadoSeguimiento,
      input.resumen,
      input.solicitudCliente,
      input.usuario,
    ]
  );
}
