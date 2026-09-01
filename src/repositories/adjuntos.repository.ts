import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { Adjunto, EntidadAdjunto } from "../types/postventa.js";

interface AdjuntoRow extends RowDataPacket {
  id: number;
  entidad_tipo: EntidadAdjunto;
  entidad_id: number;
  archivo: string;
  nombre_original: string;
  mime_type: string;
  tamano_bytes: number;
  usuario: string;
  created_at: Date;
}

function toDomain(row: AdjuntoRow): Adjunto {
  return {
    id: row.id,
    entidadTipo: row.entidad_tipo,
    entidadId: row.entidad_id,
    url: `/uploads/adjuntos/${row.archivo}`,
    nombreOriginal: row.nombre_original,
    mimeType: row.mime_type,
    tamanoBytes: row.tamano_bytes,
    usuario: row.usuario,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listByEntidad(
  entidadTipo: EntidadAdjunto,
  entidadId: number
): Promise<Adjunto[]> {
  const [rows] = await pool.query<AdjuntoRow[]>(
    "SELECT * FROM postventa_adjuntos WHERE entidad_tipo = ? AND entidad_id = ? ORDER BY created_at ASC",
    [entidadTipo, entidadId]
  );
  return rows.map(toDomain);
}

// Version bulk para listas (notas de un cliente, seguimientos de una tarea,
// etc.) — evita N+1 requests, una sola query trae los adjuntos de todos los
// items visibles a la vez.
export async function listByEntidades(
  entidadTipo: EntidadAdjunto,
  entidadIds: number[]
): Promise<Map<number, Adjunto[]>> {
  const map = new Map<number, Adjunto[]>();
  if (entidadIds.length === 0) return map;
  const [rows] = await pool.query<AdjuntoRow[]>(
    "SELECT * FROM postventa_adjuntos WHERE entidad_tipo = ? AND entidad_id IN (?) ORDER BY created_at ASC",
    [entidadTipo, entidadIds]
  );
  for (const row of rows) {
    const adjunto = toDomain(row);
    const lista = map.get(adjunto.entidadId);
    if (lista) lista.push(adjunto);
    else map.set(adjunto.entidadId, [adjunto]);
  }
  return map;
}

export async function create(input: {
  entidadTipo: EntidadAdjunto;
  entidadId: number;
  archivo: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
  usuario: string;
}): Promise<Adjunto> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_adjuntos
      (entidad_tipo, entidad_id, archivo, nombre_original, mime_type, tamano_bytes, usuario)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.entidadTipo,
      input.entidadId,
      input.archivo,
      input.nombreOriginal,
      input.mimeType,
      input.tamanoBytes,
      input.usuario,
    ]
  );
  const [rows] = await pool.query<AdjuntoRow[]>("SELECT * FROM postventa_adjuntos WHERE id = ?", [
    result.insertId,
  ]);
  return toDomain(rows[0]);
}

export async function findById(id: number): Promise<Adjunto | null> {
  const [rows] = await pool.query<AdjuntoRow[]>("SELECT * FROM postventa_adjuntos WHERE id = ?", [
    id,
  ]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function findArchivoById(id: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT archivo FROM postventa_adjuntos WHERE id = ?",
    [id]
  );
  return rows[0] ? (rows[0].archivo as string) : null;
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM postventa_adjuntos WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}
