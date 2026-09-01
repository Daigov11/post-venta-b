import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { IncidenciaManual } from "../types/postventa.js";

interface IncidenciaManualRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  caso: string;
  tipo: string | null;
  descripcion: string | null;
  created_by: string;
  created_at: Date;
}

function toDomain(row: IncidenciaManualRow): IncidenciaManual {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    caso: row.caso,
    tipo: row.tipo,
    descripcion: row.descripcion,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByCliente(numeroDocumentoCliente: string): Promise<IncidenciaManual[]> {
  const [rows] = await pool.query<IncidenciaManualRow[]>(
    "SELECT * FROM postventa_incidencias_manuales WHERE numero_documento_cliente = ? ORDER BY created_at DESC",
    [numeroDocumentoCliente]
  );
  return rows.map(toDomain);
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  caso: string;
  tipo: string | null;
  descripcion: string | null;
  createdBy: string;
}): Promise<IncidenciaManual> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_incidencias_manuales
      (numero_documento_cliente, id_orden_servicio, caso, tipo, descripcion, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.caso,
      input.tipo,
      input.descripcion,
      input.createdBy,
    ]
  );
  const [rows] = await pool.query<IncidenciaManualRow[]>(
    "SELECT * FROM postventa_incidencias_manuales WHERE id = ?",
    [result.insertId]
  );
  return toDomain(rows[0]);
}
