import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoTarea, Seguimiento } from "../types/postventa.js";

interface SeguimientoRow extends RowDataPacket {
  id: number;
  tarea_id: number;
  usuario: string;
  comentario: string;
  estado_en_ese_momento: EstadoTarea | null;
  created_at: Date;
}

function toDomain(row: SeguimientoRow): Seguimiento {
  return {
    id: row.id,
    tareaId: row.tarea_id,
    usuario: row.usuario,
    comentario: row.comentario,
    estadoEnEseMomento: row.estado_en_ese_momento,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByTarea(tareaId: number): Promise<Seguimiento[]> {
  const [rows] = await pool.query<SeguimientoRow[]>(
    "SELECT * FROM postventa_tarea_seguimientos WHERE tarea_id = ? ORDER BY created_at ASC",
    [tareaId]
  );
  return rows.map(toDomain);
}

export async function create(input: {
  tareaId: number;
  usuario: string;
  comentario: string;
  estadoEnEseMomento: EstadoTarea | null;
}): Promise<Seguimiento> {
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO postventa_tarea_seguimientos (tarea_id, usuario, comentario, estado_en_ese_momento) VALUES (?, ?, ?, ?)",
    [input.tareaId, input.usuario, input.comentario, input.estadoEnEseMomento]
  );
  const [rows] = await pool.query<SeguimientoRow[]>(
    "SELECT * FROM postventa_tarea_seguimientos WHERE id = ?",
    [result.insertId]
  );
  return toDomain(rows[0]);
}
