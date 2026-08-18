import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { Nota } from "../types/postventa.js";

interface NotaRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  usuario: string;
  nota: string;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: NotaRow): Nota {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    usuario: row.usuario,
    nota: row.nota,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listByCliente(numeroDocumentoCliente: string): Promise<Nota[]> {
  const [rows] = await pool.query<NotaRow[]>(
    "SELECT * FROM postventa_notas WHERE numero_documento_cliente = ? ORDER BY created_at DESC",
    [numeroDocumentoCliente]
  );
  return rows.map(toDomain);
}

export async function countByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, number>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT numero_documento_cliente, COUNT(*) as total FROM postventa_notas WHERE numero_documento_cliente IN (?) GROUP BY numero_documento_cliente",
    [numerosDocumentoCliente]
  );
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.numero_documento_cliente as string, Number(row.total));
  }
  return map;
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  usuario: string;
  nota: string;
}): Promise<Nota> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO postventa_notas (numero_documento_cliente, id_orden_servicio, usuario, nota) VALUES (?, ?, ?, ?)",
    [input.numeroDocumentoCliente, input.idOrdenServicio, input.usuario, input.nota]
  );
  const [rows] = await pool.query<NotaRow[]>("SELECT * FROM postventa_notas WHERE id = ?", [
    result.insertId,
  ]);
  return toDomain(rows[0]);
}

export async function update(id: number, nota: string): Promise<Nota | null> {
  await pool.query("UPDATE postventa_notas SET nota = ? WHERE id = ?", [nota, id]);
  const [rows] = await pool.query<NotaRow[]>("SELECT * FROM postventa_notas WHERE id = ?", [id]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM postventa_notas WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}
