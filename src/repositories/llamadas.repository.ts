import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { Llamada } from "../types/postventa.js";

interface LlamadaRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  usuario: string;
  created_at: Date;
}

function toDomain(row: LlamadaRow): Llamada {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    usuario: row.usuario,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByCliente(numeroDocumentoCliente: string): Promise<Llamada[]> {
  const [rows] = await pool.query<LlamadaRow[]>(
    "SELECT * FROM postventa_llamadas WHERE numero_documento_cliente = ? ORDER BY created_at DESC",
    [numeroDocumentoCliente]
  );
  return rows.map(toDomain);
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  usuario: string;
}): Promise<Llamada> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO postventa_llamadas (numero_documento_cliente, id_orden_servicio, usuario) VALUES (?, ?, ?)",
    [input.numeroDocumentoCliente, input.idOrdenServicio, input.usuario]
  );
  const [rows] = await pool.query<LlamadaRow[]>("SELECT * FROM postventa_llamadas WHERE id = ?", [
    result.insertId,
  ]);
  return toDomain(rows[0]);
}
