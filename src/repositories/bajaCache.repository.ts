import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

export interface BajaCache {
  numeroDocumentoCliente: string;
  idOrdenServicio: number;
  // null = ya se busco en el historial de seguimiento pero no aparece ningun
  // evento "CLIENTE DE BAJA" (nunca se inventa una fecha) — sigue siendo
  // valido como "ya revisado", no se vuelve a pedir en cada vista.
  fechaBaja: string | null;
  updatedAt: string;
}

interface BajaCacheRow extends RowDataPacket {
  numero_documento_cliente: string;
  id_orden_servicio: number;
  fecha_baja: Date | null;
  updated_at: Date;
}

function toDomain(row: BajaCacheRow): BajaCache {
  return {
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    fechaBaja: row.fecha_baja ? row.fecha_baja.toISOString() : null,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, BajaCache>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<BajaCacheRow[]>(
    "SELECT * FROM postventa_baja_cache WHERE numero_documento_cliente IN (?)",
    [numerosDocumentoCliente]
  );
  const map = new Map<string, BajaCache>();
  for (const row of rows) {
    const domain = toDomain(row);
    map.set(domain.numeroDocumentoCliente, domain);
  }
  return map;
}

export async function upsert(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number;
  fechaBaja: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO postventa_baja_cache (numero_documento_cliente, id_orden_servicio, fecha_baja)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
      id_orden_servicio = VALUES(id_orden_servicio),
      fecha_baja = VALUES(fecha_baja)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.fechaBaja ? new Date(input.fechaBaja) : null,
    ]
  );
}
