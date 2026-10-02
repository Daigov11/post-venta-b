import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type {
  BolsaConversion,
  BolsaSesion,
  EstadoBolsaSesion,
  OrigenBolsaSesion,
  TipoBolsaConversion,
} from "../types/postventa.js";

interface BolsaSesionRow extends RowDataPacket {
  id: number;
  usuario: string;
  fecha: Date;
  numero_apertura: number;
  abierta_en: Date;
  cerrada_en: Date | null;
  origen_apertura: OrigenBolsaSesion;
  origen_cierre: OrigenBolsaSesion | null;
  observacion_cierre: string | null;
  estado: EstadoBolsaSesion;
  created_at: Date;
  updated_at: Date;
}

function toDomain(row: BolsaSesionRow): BolsaSesion {
  return {
    id: row.id,
    usuario: row.usuario,
    fecha: row.fecha.toISOString().slice(0, 10),
    numeroApertura: row.numero_apertura,
    abiertaEn: row.abierta_en.toISOString(),
    cerradaEn: row.cerrada_en ? row.cerrada_en.toISOString() : null,
    origenApertura: row.origen_apertura,
    origenCierre: row.origen_cierre,
    observacionCierre: row.observacion_cierre,
    estado: row.estado,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function sesionAbiertaDe(usuario: string, fecha: string): Promise<BolsaSesion | null> {
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE usuario = ? AND fecha = ? AND estado = 'ABIERTA' LIMIT 1`,
    [usuario, fecha]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Ultima sesion del dia (abierta o cerrada) — para mostrar algo aunque ya se
// haya cerrado y todavia no haya reapertura (ej. alguien entra despues de
// las 19:00, cuando el cierre automatico ya paso).
export async function ultimaSesionDe(usuario: string, fecha: string): Promise<BolsaSesion | null> {
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE usuario = ? AND fecha = ? ORDER BY numero_apertura DESC LIMIT 1`,
    [usuario, fecha]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Todas las sesiones de un usuario en una fecha dada — usado para el
// resumen del dia anterior (aperturas/cierres, ver bolsaService.ts).
export async function sesionesDe(usuario: string, fecha: string): Promise<BolsaSesion[]> {
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE usuario = ? AND fecha = ? ORDER BY numero_apertura ASC`,
    [usuario, fecha]
  );
  return rows.map(toDomain);
}

export async function crearSesion(input: {
  usuario: string;
  fecha: string;
  numeroApertura: number;
  abiertaEn: string;
  origenApertura: OrigenBolsaSesion;
}): Promise<BolsaSesion> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_bolsa_sesion (usuario, fecha, numero_apertura, abierta_en, origen_apertura)
     VALUES (?, ?, ?, ?, ?)`,
    [input.usuario, input.fecha, input.numeroApertura, input.abiertaEn, input.origenApertura]
  );
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE id = ?`,
    [result.insertId]
  );
  return toDomain(rows[0]);
}

export async function cerrarSesion(
  id: number,
  input: { cerradaEn: string; origenCierre: OrigenBolsaSesion; observacionCierre: string | null }
): Promise<BolsaSesion | null> {
  await pool.query(
    `UPDATE postventa_bolsa_sesion
     SET estado = 'CERRADA', cerrada_en = ?, origen_cierre = ?, observacion_cierre = ?
     WHERE id = ? AND estado = 'ABIERTA'`,
    [input.cerradaEn, input.origenCierre, input.observacionCierre, id]
  );
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE id = ?`,
    [id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Cierre masivo automatico a las 19:00 (ver bolsaScheduler.ts) — cierra
// TODAS las sesiones abiertas de la fecha dada, sin importar el usuario (no
// hace falta saber quien esta activo, a diferencia de la apertura perezosa).
export async function cerrarTodasLasAbiertasDe(
  fecha: string,
  cerradaEn: string
): Promise<BolsaSesion[]> {
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE fecha = ? AND estado = 'ABIERTA'`,
    [fecha]
  );
  if (rows.length === 0) return [];
  await pool.query(
    `UPDATE postventa_bolsa_sesion
     SET estado = 'CERRADA', cerrada_en = ?, origen_cierre = 'AUTOMATICA'
     WHERE fecha = ? AND estado = 'ABIERTA'`,
    [cerradaEn, fecha]
  );
  return rows.map((row) => ({ ...toDomain(row), estado: "CERRADA" as const, cerradaEn, origenCierre: "AUTOMATICA" as const }));
}

// Reconciliacion (pedido explicito): sesiones que quedaron ABIERTA mas alla
// de las 19:00 de SU PROPIA fecha — cubre tanto "hoy ya paso la 19:00 y el
// scheduler no corrio" como "quedo abierta de un dia anterior porque el
// proceso estuvo caido" (ver server.ts, esta maquina se reinicia seguido
// por memoria). Se cierran a las 19:00 de esa fecha (no a "ahora"), para que
// la duracion registrada sea la real, no un artefacto de cuando alguien
// volvio a entrar. Se llama al inicio de cada acceso a la bolsa
// (bolsaService.obtenerEstadoBolsa) ademas del scheduler normal.
export async function reconciliarSesionesVencidas(ahoraSql: string): Promise<BolsaSesion[]> {
  const [rows] = await pool.query<BolsaSesionRow[]>(
    `SELECT id FROM postventa_bolsa_sesion
     WHERE estado = 'ABIERTA' AND CONCAT(fecha, ' 19:00:00') <= ?`,
    [ahoraSql]
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  await pool.query(
    `UPDATE postventa_bolsa_sesion
     SET estado = 'CERRADA', cerrada_en = CONCAT(fecha, ' 19:00:00'), origen_cierre = 'AUTOMATICA'
     WHERE id IN (?)`,
    [ids]
  );
  // Re-leidas despues del UPDATE (en vez de armar cerradaEn a mano) para que
  // toDomain() haga la misma conversion de zona horaria que ya usa el resto
  // del repositorio — nunca construir un ISO string suponiendo UTC.
  const [actualizadas] = await pool.query<BolsaSesionRow[]>(
    `SELECT * FROM postventa_bolsa_sesion WHERE id IN (?)`,
    [ids]
  );
  return actualizadas.map(toDomain);
}

interface BolsaConversionRow extends RowDataPacket {
  id: number;
  bolsa_sesion_id: number;
  tipo: TipoBolsaConversion;
  descripcion: string | null;
  created_by: string;
  created_at: Date;
}

function conversionToDomain(row: BolsaConversionRow): BolsaConversion {
  return {
    id: row.id,
    bolsaSesionId: row.bolsa_sesion_id,
    tipo: row.tipo,
    descripcion: row.descripcion,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
  };
}

export async function crearConversion(input: {
  bolsaSesionId: number;
  tipo: TipoBolsaConversion;
  descripcion: string | null;
  createdBy: string;
}): Promise<BolsaConversion> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_bolsa_conversion (bolsa_sesion_id, tipo, descripcion, created_by)
     VALUES (?, ?, ?, ?)`,
    [input.bolsaSesionId, input.tipo, input.descripcion, input.createdBy]
  );
  const [rows] = await pool.query<BolsaConversionRow[]>(
    `SELECT * FROM postventa_bolsa_conversion WHERE id = ?`,
    [result.insertId]
  );
  return conversionToDomain(rows[0]);
}

export async function listConversionesPorSesion(bolsaSesionId: number): Promise<BolsaConversion[]> {
  const [rows] = await pool.query<BolsaConversionRow[]>(
    `SELECT * FROM postventa_bolsa_conversion WHERE bolsa_sesion_id = ? ORDER BY created_at ASC`,
    [bolsaSesionId]
  );
  return rows.map(conversionToDomain);
}

// Conversiones de TODAS las sesiones de un usuario en una fecha, agrupadas
// por categoria — usado por el resumen del dia anterior.
export async function conversionesPorCategoriaEnFecha(
  usuario: string,
  fecha: string
): Promise<{ tipo: TipoBolsaConversion; cantidad: number }[]> {
  const [rows] = await pool.query<(RowDataPacket & { tipo: TipoBolsaConversion; cantidad: number })[]>(
    `SELECT c.tipo as tipo, COUNT(*) as cantidad
     FROM postventa_bolsa_conversion c
     JOIN postventa_bolsa_sesion s ON s.id = c.bolsa_sesion_id
     WHERE s.usuario = ? AND s.fecha = ?
     GROUP BY c.tipo`,
    [usuario, fecha]
  );
  return rows.map((r) => ({ tipo: r.tipo, cantidad: Number(r.cantidad) }));
}
