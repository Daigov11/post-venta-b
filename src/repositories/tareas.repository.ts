import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoTarea, OrigenTarea, PrioridadTarea, Tarea, TipoTarea } from "../types/postventa.js";

interface TareaRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  tipo: TipoTarea;
  origen: OrigenTarea;
  origen_entidad_tipo: string | null;
  origen_entidad_id: string | null;
  periodo_reparto: string | null;
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
    tipo: row.tipo,
    origen: row.origen,
    origenEntidadTipo: row.origen_entidad_tipo,
    origenEntidadId: row.origen_entidad_id,
    periodoReparto: row.periodo_reparto,
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
  tipo?: TipoTarea;
  origen?: OrigenTarea;
  periodoReparto?: string;
  prioridad?: PrioridadTarea;
  fechaDesde?: string;
  fechaHasta?: string;
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
  if (filter.tipo) {
    conditions.push("tipo = ?");
    params.push(filter.tipo);
  }
  if (filter.origen) {
    conditions.push("origen = ?");
    params.push(filter.origen);
  }
  if (filter.periodoReparto) {
    conditions.push("periodo_reparto = ?");
    params.push(filter.periodoReparto);
  }
  if (filter.prioridad) {
    conditions.push("prioridad = ?");
    params.push(filter.prioridad);
  }
  if (filter.fechaDesde) {
    conditions.push("fecha_vencimiento >= ?");
    params.push(filter.fechaDesde);
  }
  if (filter.fechaHasta) {
    conditions.push("fecha_vencimiento <= ?");
    params.push(filter.fechaHasta);
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

// Clientes que ya tienen una tarea RENOVACION sin cerrar — para no duplicar
// la tarea automatica mientras la anterior siga abierta (ver
// sincronizarTareasRenovacion en services/postventa/renovacionContacto.ts).
export async function clientesConRenovacionAbierta(
  numerosDocumentoCliente: string[]
): Promise<Set<string>> {
  if (numerosDocumentoCliente.length === 0) return new Set();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT numero_documento_cliente
     FROM postventa_tareas
     WHERE tipo = 'RENOVACION'
       AND estado NOT IN ('COMPLETADA', 'CANCELADA')
       AND numero_documento_cliente IN (?)`,
    [numerosDocumentoCliente]
  );
  return new Set(rows.map((r) => r.numero_documento_cliente as string));
}

// Clientes que ya tienen una tarea de REPARTO_MENSUAL para este periodo
// (YYYY-MM) — se mira periodo_reparto, NO fecha_vencimiento: esta ultima
// puede moverse por una redistribucion (ver redistribuirPendientesDelPeriodo
// en repartoMensualContacto.ts) sin que eso dispare una tarea duplicada. Un
// cliente ya asignado este periodo no recibe otra aunque la tarea ya este
// COMPLETADA — el proximo mes es un periodo distinto y vuelve a generarse.
export async function clientesConRepartoDelPeriodo(
  numerosDocumentoCliente: string[],
  periodo: string
): Promise<Set<string>> {
  if (numerosDocumentoCliente.length === 0) return new Set();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT numero_documento_cliente
     FROM postventa_tareas
     WHERE origen = 'REPARTO_MENSUAL'
       AND periodo_reparto = ?
       AND numero_documento_cliente IN (?)`,
    [periodo, numerosDocumentoCliente]
  );
  return new Set(rows.map((r) => r.numero_documento_cliente as string));
}

// Tareas de REPARTO_MENSUAL del periodo en curso que quedaron con fecha
// vencida sin contactar — candidatas a redistribuir (ver
// redistribuirPendientesDelPeriodo). Nunca incluye COMPLETADA/CANCELADA/
// EN_PROCESO: solo lo que sigue en PENDIENTE tiene sentido reprogramar.
export async function pendientesDeRedistribuir(periodo: string, hoyIso: string): Promise<Tarea[]> {
  const [rows] = await pool.query<TareaRow[]>(
    `SELECT * FROM postventa_tareas
     WHERE origen = 'REPARTO_MENSUAL'
       AND periodo_reparto = ?
       AND estado = 'PENDIENTE'
       AND fecha_vencimiento < ?
     ORDER BY numero_documento_cliente ASC`,
    [periodo, hoyIso]
  );
  return rows.map(toDomain);
}

export interface RepartoMensualNuevo {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  titulo: string;
  descripcion: string;
  responsable: string;
  prioridad: PrioridadTarea;
  fechaVencimiento: string;
  periodoReparto: string;
}

// Insercion en UNA sola sentencia multi-fila dentro de una transaccion — en
// vez de N INSERTs uno por uno (asi arrancaba el sync original, ver
// feedback del reparto: con ~1300 clientes activos eso significaba ~1300
// round-trips secuenciales bloqueando la carga de /tareas). La restriccion
// UNIQUE (numero_documento_cliente, origen, periodo_reparto) de la
// migracion 0040 es la ultima linea de defensa real contra duplicados —
// esta funcion asume que el llamador ya filtro los clientes que necesitan
// fila nueva (ver clientesConRepartoDelPeriodo), pero si de todos modos
// hubiera un choque (condicion de carrera), MySQL lo rechaza en vez de
// crear una fila repetida.
export async function bulkCreateRepartoMensual(filas: RepartoMensualNuevo[]): Promise<number> {
  if (filas.length === 0) return 0;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const values = filas.map((f) => [
      f.numeroDocumentoCliente,
      f.idOrdenServicio,
      "SEGUIMIENTO",
      "REPARTO_MENSUAL",
      "CLIENTE",
      f.numeroDocumentoCliente,
      f.periodoReparto,
      f.titulo,
      f.descripcion,
      f.responsable,
      f.prioridad,
      f.fechaVencimiento,
      "Sistema",
    ]);
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO postventa_tareas
        (numero_documento_cliente, id_orden_servicio, tipo, origen, origen_entidad_tipo, origen_entidad_id, periodo_reparto, titulo, descripcion, responsable, prioridad, fecha_vencimiento, created_by)
       VALUES ?`,
      [values]
    );
    await conn.commit();
    return result.affectedRows;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  tipo?: TipoTarea;
  origen?: OrigenTarea;
  origenEntidadTipo?: string | null;
  origenEntidadId?: string | null;
  titulo: string;
  descripcion: string | null;
  responsable: string;
  prioridad: PrioridadTarea;
  fechaVencimiento: string | null;
  createdBy: string;
}): Promise<Tarea> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_tareas
      (numero_documento_cliente, id_orden_servicio, tipo, origen, origen_entidad_tipo, origen_entidad_id, titulo, descripcion, responsable, prioridad, fecha_vencimiento, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.tipo ?? "PENDIENTE_CLASIFICACION",
      input.origen ?? "MANUAL",
      input.origenEntidadTipo ?? null,
      input.origenEntidadId ?? null,
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
