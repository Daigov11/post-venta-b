import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoReunion, ModalidadReunion, Reunion } from "../types/postventa.js";

interface ReunionRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  ejecutivo: string;
  fecha: Date | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  modalidad: ModalidadReunion;
  tipo_reunion: string | null;
  lugar_o_link: string | null;
  nota: string | null;
  estado: EstadoReunion;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

// mysql2 devuelve columnas DATE como objeto Date (no string) pero TIME como
// string "HH:mm:ss" — mismo comportamiento que fecha_vencimiento en
// tareas.repository.ts. Se recorta TIME a "HH:mm" para el contrato del
// frontend. fecha/hora_inicio/hora_fin son NULL solo en reuniones EN_ESPERA.
function toDomain(row: ReunionRow): Reunion {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    ejecutivo: row.ejecutivo,
    fecha: row.fecha ? row.fecha.toISOString().slice(0, 10) : null,
    horaInicio: row.hora_inicio ? row.hora_inicio.slice(0, 5) : null,
    horaFin: row.hora_fin ? row.hora_fin.slice(0, 5) : null,
    modalidad: row.modalidad,
    tipoReunion: row.tipo_reunion,
    lugarOLink: row.lugar_o_link,
    nota: row.nota,
    estado: row.estado,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findById(id: number): Promise<Reunion | null> {
  const [rows] = await pool.query<ReunionRow[]>("SELECT * FROM postventa_reuniones WHERE id = ?", [
    id,
  ]);
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function listByCliente(numeroDocumentoCliente: string): Promise<Reunion[]> {
  const [rows] = await pool.query<ReunionRow[]>(
    "SELECT * FROM postventa_reuniones WHERE numero_documento_cliente = ? ORDER BY fecha DESC, hora_inicio DESC",
    [numeroDocumentoCliente]
  );
  return rows.map(toDomain);
}

// Para calcular disponibilidad y validar choques: reuniones PROGRAMADA de un
// asesor en una fecha puntual (COMPLETADA/CANCELADA no bloquean el horario).
// PROGRAMADA siempre tiene horaInicio/horaFin reales (nunca EN_ESPERA, que
// ademas no tiene fecha con la que matchear el WHERE).
export async function listProgramadasPorEjecutivoYFecha(
  ejecutivo: string,
  fecha: string
): Promise<{ horaInicio: string; horaFin: string }[]> {
  const [rows] = await pool.query<ReunionRow[]>(
    `SELECT * FROM postventa_reuniones
     WHERE ejecutivo = ? AND fecha = ? AND estado = 'PROGRAMADA'`,
    [ejecutivo, fecha]
  );
  return rows.map((row) => ({
    horaInicio: row.hora_inicio!.slice(0, 5),
    horaFin: row.hora_fin!.slice(0, 5),
  }));
}

// Para la alerta de recordatorio: reuniones PROGRAMADA entre hoy y manana
// (24h de anticipacion), sin importar el asesor.
export async function listProximas(fechaDesde: string, fechaHasta: string): Promise<Reunion[]> {
  const [rows] = await pool.query<ReunionRow[]>(
    `SELECT * FROM postventa_reuniones
     WHERE estado = 'PROGRAMADA' AND fecha BETWEEN ? AND ?
     ORDER BY fecha, hora_inicio`,
    [fechaDesde, fechaHasta]
  );
  return rows.map(toDomain);
}

export interface ReunionesFilter {
  estado?: EstadoReunion;
  tipoReunion?: string;
}

// Para la pantalla que lista TODAS las reuniones de la cartera (no solo las
// de un cliente puntual) — ver ReunionConCliente en el controller, que
// cruza esto con el snapshot en vivo de cada cliente.
export async function listAll(filter: ReunionesFilter): Promise<Reunion[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.estado) {
    conditions.push("estado = ?");
    params.push(filter.estado);
  }
  if (filter.tipoReunion) {
    conditions.push("tipo_reunion = ?");
    params.push(filter.tipoReunion);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const [rows] = await pool.query<ReunionRow[]>(
    `SELECT * FROM postventa_reuniones ${where} ORDER BY created_at DESC`,
    params
  );
  return rows.map(toDomain);
}

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  ejecutivo: string;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  modalidad: ModalidadReunion;
  tipoReunion: string | null;
  lugarOLink: string | null;
  nota: string | null;
  estado: EstadoReunion;
  createdBy: string;
}): Promise<Reunion> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_reuniones
      (numero_documento_cliente, id_orden_servicio, ejecutivo, fecha, hora_inicio, hora_fin, modalidad, tipo_reunion, lugar_o_link, nota, estado, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.ejecutivo,
      input.fecha,
      input.horaInicio,
      input.horaFin,
      input.modalidad,
      input.tipoReunion,
      input.lugarOLink,
      input.nota,
      input.estado,
      input.createdBy,
    ]
  );
  const created = await findById(result.insertId);
  if (!created) throw new Error("No se pudo crear la reunión");
  return created;
}

export async function updateEstado(id: number, estado: EstadoReunion): Promise<Reunion | null> {
  await pool.query("UPDATE postventa_reuniones SET estado = ? WHERE id = ?", [estado, id]);
  return findById(id);
}

// Le asigna horario real a una reunion EN_ESPERA (o reprograma una ya
// PROGRAMADA) y la deja PROGRAMADA.
export async function updateHorario(
  id: number,
  input: { fecha: string; horaInicio: string; horaFin: string }
): Promise<Reunion | null> {
  await pool.query(
    "UPDATE postventa_reuniones SET fecha = ?, hora_inicio = ?, hora_fin = ?, estado = 'PROGRAMADA' WHERE id = ?",
    [input.fecha, input.horaInicio, input.horaFin, id]
  );
  return findById(id);
}
