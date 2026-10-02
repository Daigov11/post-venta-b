import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EstadoOportunidad, OportunidadEstado } from "../types/postventa.js";

interface OportunidadEstadoRow extends RowDataPacket {
  oportunidad_id: string;
  numero_documento_cliente: string;
  estado: EstadoOportunidad;
  responsable: string | null;
  siguiente_accion: string | null;
  resultado: string | null;
  usuario: string;
  tipo: string | null;
  monto_declarado: string | null;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: OportunidadEstadoRow): OportunidadEstado {
  return {
    oportunidadId: row.oportunidad_id,
    numeroDocumentoCliente: row.numero_documento_cliente,
    estado: row.estado,
    responsable: row.responsable,
    siguienteAccion: row.siguiente_accion,
    resultado: row.resultado,
    usuario: row.usuario,
    tipo: row.tipo,
    montoDeclarado: row.monto_declarado !== null ? Number(row.monto_declarado) : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listByIds(oportunidadIds: string[]): Promise<Map<string, OportunidadEstado>> {
  if (oportunidadIds.length === 0) return new Map();
  const [rows] = await pool.query<OportunidadEstadoRow[]>(
    "SELECT * FROM postventa_oportunidades_estado WHERE oportunidad_id IN (?)",
    [oportunidadIds]
  );
  return new Map(rows.map((row) => [row.oportunidad_id, toDomain(row)]));
}

export async function upsert(input: {
  oportunidadId: string;
  numeroDocumentoCliente: string;
  estado: EstadoOportunidad;
  responsable: string | null;
  siguienteAccion: string | null;
  resultado: string | null;
  usuario: string;
  // Solo tienen sentido cuando estado='GANADA' (ver migracion 0041/0042 y
  // "La Bolsa") — en cualquier otro estado se guardan como null.
  // montoDeclarado (antes "montoReal") nunca es una cifra verificada contra
  // caja real, ver comentario en types/postventa.ts.
  tipo?: string | null;
  montoDeclarado?: number | null;
}): Promise<OportunidadEstado> {
  const tipo = input.estado === "GANADA" ? (input.tipo ?? null) : null;
  const montoDeclarado = input.estado === "GANADA" ? (input.montoDeclarado ?? null) : null;
  await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_oportunidades_estado
      (oportunidad_id, numero_documento_cliente, estado, responsable, siguiente_accion, resultado, usuario, tipo, monto_declarado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       estado = VALUES(estado),
       responsable = VALUES(responsable),
       siguiente_accion = VALUES(siguiente_accion),
       resultado = VALUES(resultado),
       usuario = VALUES(usuario),
       tipo = VALUES(tipo),
       monto_declarado = VALUES(monto_declarado)`,
    [
      input.oportunidadId,
      input.numeroDocumentoCliente,
      input.estado,
      input.responsable,
      input.siguienteAccion,
      input.resultado,
      input.usuario,
      tipo,
      montoDeclarado,
    ]
  );
  const [rows] = await pool.query<OportunidadEstadoRow[]>(
    "SELECT * FROM postventa_oportunidades_estado WHERE oportunidad_id = ?",
    [input.oportunidadId]
  );
  return toDomain(rows[0]);
}

// Oportunidades ganadas por un usuario dentro de una ventana de tiempo
// exacta (no solo el dia calendario) — usado por "La Bolsa" para sumar
// logros/soles dentro de la ventana real de una sesion (abiertaEn..cerrada
// o ahora), que puede ser una porcion del dia si hubo varias
// aperturas/cierres. Se filtra por updated_at porque es cuando quedo
// GANADA (el upsert es la unica escritura de esta tabla). montoTotal suma
// monto_declarado — nunca una cifra de caja verificada, ver
// types/postventa.ts.
export async function ganadasEnRango(
  usuario: string,
  desde: string,
  hasta: string
): Promise<{ tipo: string; cantidad: number; montoTotal: number }[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COALESCE(tipo, 'SIN_TIPO') as tipo, COUNT(*) as cantidad, COALESCE(SUM(monto_declarado), 0) as monto_total
     FROM postventa_oportunidades_estado
     WHERE usuario = ? AND estado = 'GANADA' AND updated_at BETWEEN ? AND ?
     GROUP BY COALESCE(tipo, 'SIN_TIPO')`,
    [usuario, desde, hasta]
  );
  return rows.map((r) => ({
    tipo: r.tipo as string,
    cantidad: Number(r.cantidad),
    montoTotal: Number(r.monto_total),
  }));
}
