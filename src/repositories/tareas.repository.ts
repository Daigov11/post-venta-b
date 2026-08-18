import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoTarea, PrioridadTarea, Tarea } from "../types/postventa.js";

interface TareaRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  titulo: string;
  descripcion: string | null;
  responsable: string;
  prioridad: PrioridadTarea;
  estado: EstadoTarea;
  fecha_vencimiento: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: TareaRow): Tarea {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    titulo: row.titulo,
    descripcion: row.descripcion,
    responsable: row.responsable,
    prioridad: row.prioridad,
    estado: row.estado,
    fechaVencimiento: row.fecha_vencimiento
      ? row.fecha_vencimiento.toISOString().slice(0, 10)
      : null,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export interface TareasFilter {
  numeroDocumentoCliente?: string;
  estado?: EstadoTarea;
  responsable?: string;
  vencidas?: boolean;
}

export async function list(filter: TareasFilter): Promise<Tarea[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.numeroDocumentoCliente) {
    conditions.push("numero_documento_cliente = ?");
    params.push(filter.numeroDocumentoCliente);
  }
  if (filter.estado) {
    conditions.push("estado = ?");
    params.push(filter.estado);
  }
  if (filter.responsable) {
    conditions.push("responsable = ?");
    params.push(filter.responsable);
  }
  if (filter.vencidas) {
    conditions.push("fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURDATE()");
    conditions.push("estado NOT IN ('COMPLETADA', 'CANCELADA')");
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query<TareaRow[]>(
    `SELECT * FROM postventa_tareas ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.map(toDomain);
}

export async function findById(id: number): Promise<Tarea | null> {
  const [rows] = await pool.query<TareaRow[]>("SELECT * FROM postventa_tareas WHERE id = ?", [
    id,
  ]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function countAbiertasYTotalByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, { abiertas: number; total: number }>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT numero_documento_cliente,
            COUNT(*) as total,
            SUM(CASE WHEN estado NOT IN ('COMPLETADA', 'CANCELADA') THEN 1 ELSE 0 END) as abiertas
     FROM postventa_tareas
     WHERE numero_documento_cliente IN (?)
     GROUP BY numero_documento_cliente`,
    [numerosDocumentoCliente]
  );
  const map = new Map<string, { abiertas: number; total: number }>();
  for (const row of rows) {
    map.set(row.numero_documento_cliente as string, {
      abiertas: Number(row.abiertas),
      total: Number(row.total),
    });
  }
  return map;
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  titulo: string;
  descripcion: string | null;
  responsable: string;
  prioridad: PrioridadTarea;
  fechaVencimiento: string | null;
  createdBy: string;
}): Promise<Tarea> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_tareas
      (numero_documento_cliente, id_orden_servicio, titulo, descripcion, responsable, prioridad, fecha_vencimiento, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.titulo,
      input.descripcion,
      input.responsable,
      input.prioridad,
      input.fechaVencimiento,
      input.createdBy,
    ]
  );
  const created = await findById(result.insertId);
  if (!created) throw new Error("No se pudo crear la tarea");
  return created;
}

export interface TareaPatch {
  titulo?: string;
  descripcion?: string | null;
  responsable?: string;
  prioridad?: PrioridadTarea;
  estado?: EstadoTarea;
  fechaVencimiento?: string | null;
}

export async function update(id: number, patch: TareaPatch): Promise<Tarea | null> {
  const existing = await findById(id);
  if (!existing) return null;

  await pool.query(
    `UPDATE postventa_tareas SET
      titulo = ?, descripcion = ?, responsable = ?, prioridad = ?, estado = ?, fecha_vencimiento = ?
     WHERE id = ?`,
    [
      patch.titulo ?? existing.titulo,
      patch.descripcion !== undefined ? patch.descripcion : existing.descripcion,
      patch.responsable ?? existing.responsable,
      patch.prioridad ?? existing.prioridad,
      patch.estado ?? existing.estado,
      patch.fechaVencimiento !== undefined ? patch.fechaVencimiento : existing.fechaVencimiento,
      id,
    ]
  );
  return findById(id);
}

export async function remove(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM postventa_tareas WHERE id = ?",
    [id]
  );
  return result.affectedRows > 0;
}
