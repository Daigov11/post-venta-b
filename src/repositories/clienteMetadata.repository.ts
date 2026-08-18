import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { ClienteMetadata, EstadoPostVenta } from "../types/postventa.js";
import { parseJsonColumn } from "./jsonColumn.js";

interface ClienteMetadataRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  segmento_manual: string | null;
  estado_postventa_manual: EstadoPostVenta | null;
  etiquetas: unknown;
  observacion_general: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: ClienteMetadataRow): ClienteMetadata {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    segmentoManual: row.segmento_manual,
    estadoPostVentaManual: row.estado_postventa_manual,
    etiquetas: parseJsonColumn<string[]>(row.etiquetas, []),
    observacionGeneral: row.observacion_general,
    updatedBy: row.updated_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findByCliente(
  numeroDocumentoCliente: string
): Promise<ClienteMetadata | null> {
  const [rows] = await pool.query<ClienteMetadataRow[]>(
    "SELECT * FROM postventa_cliente_metadata WHERE numero_documento_cliente = ? AND id_orden_servicio IS NULL LIMIT 1",
    [numeroDocumentoCliente]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function findAllByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, ClienteMetadata>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<ClienteMetadataRow[]>(
    "SELECT * FROM postventa_cliente_metadata WHERE numero_documento_cliente IN (?) AND id_orden_servicio IS NULL",
    [numerosDocumentoCliente]
  );
  const map = new Map<string, ClienteMetadata>();
  for (const row of rows) {
    const domain = toDomain(row);
    map.set(domain.numeroDocumentoCliente, domain);
  }
  return map;
}

export interface ClienteMetadataPatch {
  segmentoManual?: string | null;
  estadoPostVentaManual?: EstadoPostVenta | null;
  etiquetas?: string[];
  observacionGeneral?: string | null;
}

export async function upsert(
  numeroDocumentoCliente: string,
  patch: ClienteMetadataPatch,
  usuario: string
): Promise<ClienteMetadata> {
  const existing = await findByCliente(numeroDocumentoCliente);

  if (!existing) {
    await pool.query(
      `INSERT INTO postventa_cliente_metadata
        (numero_documento_cliente, segmento_manual, estado_postventa_manual, etiquetas, observacion_general, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        numeroDocumentoCliente,
        patch.segmentoManual ?? null,
        patch.estadoPostVentaManual ?? null,
        JSON.stringify(patch.etiquetas ?? []),
        patch.observacionGeneral ?? null,
        usuario,
      ]
    );
  } else {
    await pool.query(
      `UPDATE postventa_cliente_metadata SET
        segmento_manual = ?, estado_postventa_manual = ?, etiquetas = ?, observacion_general = ?, updated_by = ?
       WHERE id = ?`,
      [
        patch.segmentoManual !== undefined ? patch.segmentoManual : existing.segmentoManual,
        patch.estadoPostVentaManual !== undefined
          ? patch.estadoPostVentaManual
          : existing.estadoPostVentaManual,
        JSON.stringify(patch.etiquetas ?? existing.etiquetas),
        patch.observacionGeneral !== undefined
          ? patch.observacionGeneral
          : existing.observacionGeneral,
        usuario,
        existing.id,
      ]
    );
  }

  const result = await findByCliente(numeroDocumentoCliente);
  if (!result) {
    throw new Error("No se pudo guardar la metadata del cliente");
  }
  return result;
}
