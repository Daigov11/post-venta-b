import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoReunion, ModalidadReunion, Reunion } from "../types/postventa.js";

interface ReunionRow extends RowDataPacket {
  id: number;
  numero_documento_cliente: string;
  id_orden_servicio: number | null;
  ejecutivo: string;
  fecha: Date;
  hora_inicio: string;
  hora_fin: string;
  modalidad: ModalidadReunion;
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
// frontend.
function toDomain(row: ReunionRow): Reunion {
  return {
    id: row.id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    idOrdenServicio: row.id_orden_servicio,
    ejecutivo: row.ejecutivo,
    fecha: row.fecha.toISOString().slice(0, 10),
    horaInicio: row.hora_inicio.slice(0, 5),
    horaFin: row.hora_fin.slice(0, 5),
    modalidad: row.modalidad,
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
export async function listProgramadasPorEjecutivoYFecha(
  ejecutivo: string,
  fecha: string
): Promise<Reunion[]> {
  const [rows] = await pool.query<ReunionRow[]>(
    `SELECT * FROM postventa_reuniones
     WHERE ejecutivo = ? AND fecha = ? AND estado = 'PROGRAMADA'`,
    [ejecutivo, fecha]
  );
  return rows.map(toDomain);
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

export async function create(input: {
  numeroDocumentoCliente: string;
  idOrdenServicio: number | null;
  ejecutivo: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  modalidad: ModalidadReunion;
  lugarOLink: string | null;
  nota: string | null;
  createdBy: string;
}): Promise<Reunion> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_reuniones
      (numero_documento_cliente, id_orden_servicio, ejecutivo, fecha, hora_inicio, hora_fin, modalidad, lugar_o_link, nota, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.numeroDocumentoCliente,
      input.idOrdenServicio,
      input.ejecutivo,
      input.fecha,
      input.horaInicio,
      input.horaFin,
      input.modalidad,
      input.lugarOLink,
      input.nota,
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
