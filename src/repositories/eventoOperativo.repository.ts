import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type {
  EventoOperativo,
  ModuloOperativo,
  ResumenEventosOperativos,
  TipoAccionOperativa,
} from "../types/postventa.js";

interface EventoRow extends RowDataPacket {
  id: number;
  usuario: string;
  tipo_accion: TipoAccionOperativa;
  modulo: ModuloOperativo;
  numero_documento_cliente: string | null;
  entidad_tipo: string | null;
  entidad_id: string | null;
  resultado: string;
  detalle: string | null;
  created_at: Date;
}

function toDomain(row: EventoRow): EventoOperativo {
  return {
    id: row.id,
    usuario: row.usuario,
    tipoAccion: row.tipo_accion,
    modulo: row.modulo,
    numeroDocumentoCliente: row.numero_documento_cliente,
    entidadTipo: row.entidad_tipo,
    entidadId: row.entidad_id,
    resultado: row.resultado,
    detalle: row.detalle,
    createdAt: row.created_at.toISOString(),
  };
}

export interface RegistrarEventoInput {
  usuario: string;
  tipoAccion: TipoAccionOperativa;
  modulo: ModuloOperativo;
  numeroDocumentoCliente?: string | null;
  entidadTipo?: string | null;
  entidadId?: string | null;
  resultado?: string;
  detalle?: string | null;
}

// Ventana anti-doble-registro: mismo usuario + tipo de accion + misma
// entidad en los ultimos 5s se considera el mismo click/reintento, no una
// segunda accion real — se devuelve el evento ya existente en vez de
// duplicarlo. `<=>` es el operador NULL-safe de MySQL (a diferencia de "=",
// compara NULL con NULL como iguales) — necesario porque entidad_tipo/
// entidad_id son nulos para algunos tipos (ej. contacto).
const VENTANA_DEDUP_SEGUNDOS = 5;

export async function registrar(input: RegistrarEventoInput): Promise<EventoOperativo> {
  const entidadTipo = input.entidadTipo ?? null;
  const entidadId = input.entidadId ?? null;

  const [dupRows] = await pool.query<EventoRow[]>(
    `SELECT * FROM postventa_evento_operativo
     WHERE usuario = ? AND tipo_accion = ?
       AND entidad_tipo <=> ? AND entidad_id <=> ?
       AND created_at >= (NOW() - INTERVAL ? SECOND)
     ORDER BY created_at DESC LIMIT 1`,
    [input.usuario, input.tipoAccion, entidadTipo, entidadId, VENTANA_DEDUP_SEGUNDOS]
  );
  if (dupRows.length > 0) return toDomain(dupRows[0]);

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_evento_operativo
      (usuario, tipo_accion, modulo, numero_documento_cliente, entidad_tipo, entidad_id, resultado, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.usuario,
      input.tipoAccion,
      input.modulo,
      input.numeroDocumentoCliente ?? null,
      entidadTipo,
      entidadId,
      input.resultado ?? "OK",
      input.detalle ?? null,
    ]
  );
  const [rows] = await pool.query<EventoRow[]>(
    "SELECT * FROM postventa_evento_operativo WHERE id = ?",
    [result.insertId]
  );
  return toDomain(rows[0]);
}

// Best-effort a proposito: registrar el evento nunca debe romper la accion
// real que lo origina (crear tarea, resolver alerta, etc.) — si falla, se
// loguea a consola y se sigue, en vez de propagar el error al controller.
export async function registrarSeguro(input: RegistrarEventoInput): Promise<void> {
  try {
    await registrar(input);
  } catch (error) {
    console.error("No se pudo registrar el evento operativo:", input.tipoAccion, error);
  }
}

export interface EventosFiltro {
  usuario?: string;
  numeroDocumentoCliente?: string;
  entidadTipo?: string;
  entidadId?: string;
  tipoAccion?: TipoAccionOperativa;
  desde?: string;
  hasta?: string;
  limit?: number;
}

export async function listPorFiltro(filtro: EventosFiltro): Promise<EventoOperativo[]> {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.usuario) {
    condiciones.push("usuario = ?");
    params.push(filtro.usuario);
  }
  if (filtro.numeroDocumentoCliente) {
    condiciones.push("numero_documento_cliente = ?");
    params.push(filtro.numeroDocumentoCliente);
  }
  if (filtro.entidadTipo) {
    condiciones.push("entidad_tipo = ?");
    params.push(filtro.entidadTipo);
  }
  if (filtro.entidadId) {
    condiciones.push("entidad_id = ?");
    params.push(filtro.entidadId);
  }
  if (filtro.tipoAccion) {
    condiciones.push("tipo_accion = ?");
    params.push(filtro.tipoAccion);
  }
  if (filtro.desde) {
    condiciones.push("created_at >= ?");
    params.push(`${filtro.desde} 00:00:00`);
  }
  if (filtro.hasta) {
    condiciones.push("created_at <= ?");
    params.push(`${filtro.hasta} 23:59:59`);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const limit = Math.min(Math.max(filtro.limit ?? 50, 1), 200);

  const [rows] = await pool.query<EventoRow[]>(
    `SELECT * FROM postventa_evento_operativo ${where} ORDER BY created_at DESC LIMIT ${limit}`,
    params
  );
  return rows.map(toDomain);
}

// Agrupado por usuario+fecha (fecha calendario, no datetime) — misma
// granularidad que postventa_resultado_dia, para poder mostrarse al lado del
// conteo manual sin mezclarlos.
export async function resumenPorUsuarioYRango(filtro: {
  usuario?: string;
  desde?: string;
  hasta?: string;
}): Promise<ResumenEventosOperativos[]> {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  if (filtro.usuario) {
    condiciones.push("usuario = ?");
    params.push(filtro.usuario);
  }
  if (filtro.desde) {
    condiciones.push("created_at >= ?");
    params.push(`${filtro.desde} 00:00:00`);
  }
  if (filtro.hasta) {
    condiciones.push("created_at <= ?");
    params.push(`${filtro.hasta} 23:59:59`);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [rows] = await pool.query<
    (RowDataPacket & {
      usuario: string;
      fecha: Date;
      tipo_accion: TipoAccionOperativa;
      cantidad: number;
    })[]
  >(
    `SELECT usuario, DATE(created_at) AS fecha, tipo_accion, COUNT(*) AS cantidad
     FROM postventa_evento_operativo
     ${where}
     GROUP BY usuario, DATE(created_at), tipo_accion
     ORDER BY fecha DESC, usuario ASC`,
    params
  );

  const porClave = new Map<string, ResumenEventosOperativos>();
  for (const row of rows) {
    const fecha = row.fecha.toISOString().slice(0, 10);
    const clave = `${row.usuario}:${fecha}`;
    let resumen = porClave.get(clave);
    if (!resumen) {
      resumen = { usuario: row.usuario, fecha, total: 0, porTipo: {} };
      porClave.set(clave, resumen);
    }
    resumen.porTipo[row.tipo_accion] = Number(row.cantidad);
    resumen.total += Number(row.cantidad);
  }
  return [...porClave.values()];
}

// Conteo por tipo de accion en una ventana de DATETIME exacta (no dia
// calendario) — a diferencia de resumenPorUsuarioYRango/listPorFiltro (que
// truncan a 00:00:00/23:59:59), esto lo necesita "La Bolsa" para sesiones
// que pueden abrir/cerrar varias veces el mismo dia (ver
// services/postventa/bolsaResumen.ts). COUNT(*) puro, sin el limite de 200
// filas que tiene listPorFiltro.
export async function contarPorTipoEnRango(
  usuario: string,
  tipos: TipoAccionOperativa[],
  desde: string,
  hasta: string
): Promise<Map<TipoAccionOperativa, number>> {
  if (tipos.length === 0) return new Map();
  const [rows] = await pool.query<(RowDataPacket & { tipo_accion: TipoAccionOperativa; cantidad: number })[]>(
    `SELECT tipo_accion, COUNT(*) as cantidad
     FROM postventa_evento_operativo
     WHERE usuario = ? AND tipo_accion IN (?) AND created_at BETWEEN ? AND ?
     GROUP BY tipo_accion`,
    [usuario, tipos, desde, hasta]
  );
  return new Map(rows.map((r) => [r.tipo_accion, Number(r.cantidad)]));
}

// Clientes UNICOS contactados en una ventana — a diferencia de
// contarPorTipoEnRango (que cuenta eventos, y un mismo cliente puede tener
// varias llamadas/whatsapps el mismo dia), esto cuenta personas distintas.
// Usado por el resumen del dia anterior de "La Bolsa" (pedido explicito:
// "clientes contactados unicos").
export async function clientesUnicosPorTipoEnRango(
  usuario: string,
  tipos: TipoAccionOperativa[],
  desde: string,
  hasta: string
): Promise<number> {
  if (tipos.length === 0) return 0;
  const [rows] = await pool.query<(RowDataPacket & { cantidad: number })[]>(
    `SELECT COUNT(DISTINCT numero_documento_cliente) as cantidad
     FROM postventa_evento_operativo
     WHERE usuario = ? AND tipo_accion IN (?) AND created_at BETWEEN ? AND ?
       AND numero_documento_cliente IS NOT NULL`,
    [usuario, tipos, desde, hasta]
  );
  return Number(rows[0]?.cantidad ?? 0);
}
