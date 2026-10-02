import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type {
  EstadoResultadoDia,
  ResultadoAccion,
  ResultadoConversion,
  ResultadoDia,
  ResultadoDiaResumen,
  TipoConversion,
} from "../types/postventa.js";

interface ResultadoDiaRow extends RowDataPacket {
  id: number;
  usuario: string;
  fecha: Date;
  estado: EstadoResultadoDia;
  monto_apertura: string;
  hora_apertura: Date;
  hora_cierre: Date | null;
  observacion_cierre: string | null;
  aviso_administracion: number;
  motivo_aviso: string | null;
}

interface ResultadoAccionRow extends RowDataPacket {
  id: number;
  resultado_dia_id: number;
  tipo: string;
  realizadas: number;
  no_realizadas: number;
}

interface ResultadoConversionRow extends RowDataPacket {
  id: number;
  resultado_dia_id: number;
  tipo: TipoConversion;
  cantidad: number;
  detalle: string | null;
}

function fechaToIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function accionToDomain(row: ResultadoAccionRow): ResultadoAccion {
  return {
    id: row.id,
    resultadoDiaId: row.resultado_dia_id,
    tipo: row.tipo,
    realizadas: row.realizadas,
    noRealizadas: row.no_realizadas,
  };
}

function conversionToDomain(row: ResultadoConversionRow): ResultadoConversion {
  return {
    id: row.id,
    resultadoDiaId: row.resultado_dia_id,
    tipo: row.tipo,
    cantidad: row.cantidad,
    detalle: row.detalle,
  };
}

async function cargarHijos(
  resultadoDiaId: number
): Promise<{ acciones: ResultadoAccion[]; conversiones: ResultadoConversion[] }> {
  const [accionRows] = await pool.query<ResultadoAccionRow[]>(
    "SELECT * FROM postventa_resultado_accion WHERE resultado_dia_id = ? ORDER BY tipo",
    [resultadoDiaId]
  );
  const [conversionRows] = await pool.query<ResultadoConversionRow[]>(
    "SELECT * FROM postventa_resultado_conversion WHERE resultado_dia_id = ? ORDER BY tipo",
    [resultadoDiaId]
  );
  return {
    acciones: accionRows.map(accionToDomain),
    conversiones: conversionRows.map(conversionToDomain),
  };
}

async function rowToDomain(row: ResultadoDiaRow): Promise<ResultadoDia> {
  const { acciones, conversiones } = await cargarHijos(row.id);
  return {
    id: row.id,
    usuario: row.usuario,
    fecha: fechaToIso(row.fecha),
    estado: row.estado,
    montoApertura: Number(row.monto_apertura),
    horaApertura: row.hora_apertura.toISOString(),
    horaCierre: row.hora_cierre ? row.hora_cierre.toISOString() : null,
    observacionCierre: row.observacion_cierre,
    avisoAdministracion: row.aviso_administracion === 1,
    motivoAviso: row.motivo_aviso,
    acciones,
    conversiones,
  };
}

export async function findById(id: number): Promise<ResultadoDia | null> {
  const [rows] = await pool.query<ResultadoDiaRow[]>(
    "SELECT * FROM postventa_resultado_dia WHERE id = ?",
    [id]
  );
  if (rows.length === 0) return null;
  return rowToDomain(rows[0]);
}

export async function findByUsuarioFecha(
  usuario: string,
  fecha: string
): Promise<ResultadoDia | null> {
  const [rows] = await pool.query<ResultadoDiaRow[]>(
    "SELECT * FROM postventa_resultado_dia WHERE usuario = ? AND fecha = ?",
    [usuario, fecha]
  );
  if (rows.length === 0) return null;
  return rowToDomain(rows[0]);
}

export async function abrir(input: {
  usuario: string;
  fecha: string;
  montoApertura: number;
}): Promise<ResultadoDia> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_resultado_dia
      (usuario, fecha, estado, monto_apertura, hora_apertura)
     VALUES (?, ?, 'ABIERTO', ?, ?)`,
    [input.usuario, input.fecha, input.montoApertura, new Date()]
  );
  const creado = await findById(result.insertId);
  if (!creado) throw new Error("No se pudo crear el registro de apertura del día");
  return creado;
}

export async function cerrar(
  id: number,
  input: {
    observacionCierre: string | null;
    avisoAdministracion: boolean;
    motivoAviso: string | null;
  }
): Promise<ResultadoDia> {
  await pool.query<ResultSetHeader>(
    `UPDATE postventa_resultado_dia
     SET estado = 'CERRADO', hora_cierre = ?, observacion_cierre = ?,
         aviso_administracion = ?, motivo_aviso = ?
     WHERE id = ?`,
    [new Date(), input.observacionCierre, input.avisoAdministracion ? 1 : 0, input.motivoAviso, id]
  );
  const actualizado = await findById(id);
  if (!actualizado) throw new Error("Registro de resultado del día no encontrado");
  return actualizado;
}

export async function upsertAccion(
  resultadoDiaId: number,
  input: { tipo: string; realizadas: number; noRealizadas: number }
): Promise<ResultadoAccion> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_resultado_accion (resultado_dia_id, tipo, realizadas, no_realizadas)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE realizadas = VALUES(realizadas), no_realizadas = VALUES(no_realizadas)`,
    [resultadoDiaId, input.tipo, input.realizadas, input.noRealizadas]
  );
  const [rows] = await pool.query<ResultadoAccionRow[]>(
    "SELECT * FROM postventa_resultado_accion WHERE resultado_dia_id = ? AND tipo = ?",
    [resultadoDiaId, input.tipo]
  );
  return accionToDomain(rows[0]);
}

export async function eliminarAccion(resultadoDiaId: number, tipo: string): Promise<void> {
  await pool.query("DELETE FROM postventa_resultado_accion WHERE resultado_dia_id = ? AND tipo = ?", [
    resultadoDiaId,
    tipo,
  ]);
}

export async function upsertConversion(
  resultadoDiaId: number,
  input: { tipo: TipoConversion; cantidad: number; detalle: string | null }
): Promise<ResultadoConversion> {
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_resultado_conversion (resultado_dia_id, tipo, cantidad, detalle)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cantidad = VALUES(cantidad), detalle = VALUES(detalle)`,
    [resultadoDiaId, input.tipo, input.cantidad, input.detalle]
  );
  const [rows] = await pool.query<ResultadoConversionRow[]>(
    "SELECT * FROM postventa_resultado_conversion WHERE resultado_dia_id = ? AND tipo = ?",
    [resultadoDiaId, input.tipo]
  );
  return conversionToDomain(rows[0]);
}

// Historico: totales por dia via SQL agregado (suma exacta, no una formula
// de evaluacion) — evita traer todas las acciones/conversiones de cada dia
// al frontend cuando solo hace falta el resumen.
export async function listHistorico(filtro: {
  usuario?: string;
  desde?: string;
  hasta?: string;
}): Promise<ResultadoDiaResumen[]> {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.usuario) {
    condiciones.push("d.usuario = ?");
    params.push(filtro.usuario);
  }
  if (filtro.desde) {
    condiciones.push("d.fecha >= ?");
    params.push(filtro.desde);
  }
  if (filtro.hasta) {
    condiciones.push("d.fecha <= ?");
    params.push(filtro.hasta);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query<
    (RowDataPacket & {
      id: number;
      usuario: string;
      fecha: Date;
      estado: EstadoResultadoDia;
      monto_apertura: string;
      hora_apertura: Date;
      hora_cierre: Date | null;
      aviso_administracion: number;
      total_realizadas: number | null;
      total_no_realizadas: number | null;
    })[]
  >(
    `SELECT d.id, d.usuario, d.fecha, d.estado, d.monto_apertura, d.hora_apertura, d.hora_cierre,
            d.aviso_administracion,
            SUM(COALESCE(a.realizadas, 0)) AS total_realizadas,
            SUM(COALESCE(a.no_realizadas, 0)) AS total_no_realizadas
     FROM postventa_resultado_dia d
     LEFT JOIN postventa_resultado_accion a ON a.resultado_dia_id = d.id
     ${where}
     GROUP BY d.id
     ORDER BY d.fecha DESC, d.usuario ASC`,
    params
  );

  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [conversionRows] = await pool.query<ResultadoConversionRow[]>(
    `SELECT * FROM postventa_resultado_conversion WHERE resultado_dia_id IN (?)`,
    [ids]
  );
  const conversionesPorDia = new Map<number, ResultadoConversion[]>();
  for (const row of conversionRows) {
    const lista = conversionesPorDia.get(row.resultado_dia_id) ?? [];
    lista.push(conversionToDomain(row));
    conversionesPorDia.set(row.resultado_dia_id, lista);
  }

  return rows.map((row) => {
    const conversiones = conversionesPorDia.get(row.id) ?? [];
    const conversionesPorTipo: Record<TipoConversion, number> = { EQUIPO: 0, PLAN: 0, MODULO: 0 };
    let totalConversiones = 0;
    for (const c of conversiones) {
      conversionesPorTipo[c.tipo] = c.cantidad;
      totalConversiones += c.cantidad;
    }
    return {
      id: row.id,
      usuario: row.usuario,
      fecha: fechaToIso(row.fecha),
      estado: row.estado,
      montoApertura: Number(row.monto_apertura),
      horaApertura: row.hora_apertura.toISOString(),
      horaCierre: row.hora_cierre ? row.hora_cierre.toISOString() : null,
      avisoAdministracion: row.aviso_administracion === 1,
      totalRealizadas: Number(row.total_realizadas ?? 0),
      totalNoRealizadas: Number(row.total_no_realizadas ?? 0),
      totalConversiones,
      conversionesPorTipo,
    };
  });
}
