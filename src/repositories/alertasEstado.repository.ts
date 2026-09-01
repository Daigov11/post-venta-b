import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { AlertaEstado } from "../types/postventa.js";

interface AlertaEstadoRow extends RowDataPacket {
  alerta_id: string;
  numero_documento_cliente: string;
  estado: "VISTA" | "RESUELTA";
  nota: string | null;
  usuario: string;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: AlertaEstadoRow): AlertaEstado {
  return {
    alertaId: row.alerta_id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    estado: row.estado,
    nota: row.nota,
    usuario: row.usuario,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listByIds(alertaIds: string[]): Promise<Map<string, AlertaEstado>> {
  if (alertaIds.length === 0) return new Map();
  const [rows] = await pool.query<AlertaEstadoRow[]>(
    "SELECT * FROM postventa_alertas_estado WHERE alerta_id IN (?)",
    [alertaIds]
  );
  return new Map(rows.map((row) => [row.alerta_id, toDomain(row)]));
}

export async function listResueltas(): Promise<AlertaEstado[]> {
  const [rows] = await pool.query<AlertaEstadoRow[]>(
    "SELECT * FROM postventa_alertas_estado WHERE estado = 'RESUELTA'"
  );
  return rows.map(toDomain);
}

export async function upsert(input: {
  alertaId: string;
  numeroDocumentoCliente: string;
  estado: "VISTA" | "RESUELTA";
  nota: string | null;
  usuario: string;
}): Promise<AlertaEstado> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_alertas_estado
      (alerta_id, numero_documento_cliente, estado, nota, usuario)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), nota = VALUES(nota), usuario = VALUES(usuario)`,
    [input.alertaId, input.numeroDocumentoCliente, input.estado, input.nota, input.usuario]
  );
  const [rows] = await pool.query<AlertaEstadoRow[]>(
    "SELECT * FROM postventa_alertas_estado WHERE alerta_id = ?",
    [input.alertaId]
  );
  return toDomain(rows[0]);
}

export async function remove(alertaId: string): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM postventa_alertas_estado WHERE alerta_id = ?",
    [alertaId]
  );
  return result.affectedRows > 0;
}
