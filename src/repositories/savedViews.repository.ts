import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { SavedView } from "../types/postventa.js";
import { parseJsonColumn } from "./jsonColumn.js";

interface SavedViewRow extends RowDataPacket {
  id: number;
  usuario: string;
  screen: string;
  nombre: string;
  columnas: unknown;
  filtros: unknown;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: SavedViewRow): SavedView {
  return {
    id: row.id,
    usuario: row.usuario,
    screen: row.screen,
    nombre: row.nombre,
    columnas: parseJsonColumn<string[]>(row.columnas, []),
    filtros: parseJsonColumn<Record<string, unknown>>(row.filtros, {}),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listByUsuarioAndScreen(
  usuario: string,
  screen: string
): Promise<SavedView[]> {
  const [rows] = await pool.query<SavedViewRow[]>(
    "SELECT * FROM postventa_saved_views WHERE usuario = ? AND screen = ? ORDER BY nombre ASC",
    [usuario, screen]
  );
  return rows.map(toDomain);
}

export async function findById(id: number): Promise<SavedView | null> {
  const [rows] = await pool.query<SavedViewRow[]>(
    "SELECT * FROM postventa_saved_views WHERE id = ?",
    [id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function create(input: {
  usuario: string;
  screen: string;
  nombre: string;
  columnas: string[];
  filtros: Record<string, unknown>;
}): Promise<SavedView> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO postventa_saved_views (usuario, screen, nombre, columnas, filtros) VALUES (?, ?, ?, ?, ?)",
    [
      input.usuario,
      input.screen,
      input.nombre,
      JSON.stringify(input.columnas),
      JSON.stringify(input.filtros),
    ]
  );
  const created = await findById(result.insertId);
  if (!created) throw new Error("No se pudo crear la vista guardada");
  return created;
}

export async function update(
  id: number,
  patch: { nombre?: string; columnas?: string[]; filtros?: Record<string, unknown> }
): Promise<SavedView | null> {
  const existing = await findById(id);
  if (!existing) return null;

  await pool.query(
    "UPDATE postventa_saved_views SET nombre = ?, columnas = ?, filtros = ? WHERE id = ?",
    [
      patch.nombre ?? existing.nombre,
      JSON.stringify(patch.columnas ?? existing.columnas),
      JSON.stringify(patch.filtros ?? existing.filtros),
      id,
    ]
  );
  return findById(id);
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM postventa_saved_views WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}
