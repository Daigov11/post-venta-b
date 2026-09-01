import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { CanalContacto, Contacto } from "../types/postventa.js";

interface ContactoRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  canal: CanalContacto;
  usuario: string;
  created_at: Date;
}

function toDomain(row: ContactoRow): Contacto {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    canal: row.canal,
    usuario: row.usuario,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByCliente(numeroDocumentoCliente: string): Promise<Contacto[]> {
  const [rows] = await pool.query<ContactoRow[]>(
    "SELECT * FROM postventa_contactos WHERE numero_documento_cliente = ? ORDER BY created_at DESC",
    [numeroDocumentoCliente]
  );
  return rows.map(toDomain);
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  canal: CanalContacto;
  usuario: string;
}): Promise<Contacto> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO postventa_contactos (numero_documento_cliente, id_orden_servicio, canal, usuario) VALUES (?, ?, ?, ?)",
    [input.numeroDocumentoCliente, input.idOrdenServicio, input.canal, input.usuario]
  );
  const [rows] = await pool.query<ContactoRow[]>(
    "SELECT * FROM postventa_contactos WHERE id = ?",
    [result.insertId]
  );
  return toDomain(rows[0]);
}
