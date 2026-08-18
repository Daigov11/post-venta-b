import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { InteresCatalogo } from "../types/postventa.js";

interface InteresRow extends RowDataPacket {
  id: number;
  icono: string | null;
  nombre: string;
  descripcion: string | null;
  etiqueta: string | null;
  orden: number;
  activo: number;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: InteresRow): InteresCatalogo {
  return {
    id: row.id,
    icono: row.icono,
    nombre: row.nombre,
    descripcion: row.descripcion,
    etiqueta: row.etiqueta,
    orden: row.orden,
    activo: row.activo === 1,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listActivos(): Promise<InteresCatalogo[]> {
  const [rows] = await pool.query<InteresRow[]>(
    "SELECT * FROM postventa_intereses_catalogo WHERE activo = 1 ORDER BY orden, id"
  );
  return rows.map(toDomain);
}

export async function findById(id: number): Promise<InteresCatalogo | null> {
  const [rows] = await pool.query<InteresRow[]>(
    "SELECT * FROM postventa_intereses_catalogo WHERE id = ?",
    [id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function create(input: {
  icono: string | null;
  nombre: string;
  descripcion: string | null;
  etiqueta: string | null;
  createdBy: string;
}): Promise<InteresCatalogo> {
  const [maxOrdenRows] = await pool.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(orden), 0) as maxOrden FROM postventa_intereses_catalogo"
  );
  const orden = Number(maxOrdenRows[0].maxOrden) + 1;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_intereses_catalogo (icono, nombre, descripcion, etiqueta, orden, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.icono, input.nombre, input.descripcion, input.etiqueta, orden, input.createdBy]
  );
  const created = await findById(result.insertId);
  if (!created) throw new Error("No se pudo crear el interés");
  return created;
}

export async function setActivo(id: number, activo: boolean): Promise<InteresCatalogo | null> {
  await pool.query("UPDATE postventa_intereses_catalogo SET activo = ? WHERE id = ?", [
    activo ? 1 : 0,
    id,
  ]);
  return findById(id);
}
