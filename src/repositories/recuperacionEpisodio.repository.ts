import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { EpisodioRecuperacion, EstadoRecuperacion, OrigenRecuperacion } from "../types/postventa.js";

interface EpisodioRow extends RowDataPacket {
  id: number;
  id_orden_servicio: number;
  numero_documento_cliente: string;
  nombre_cliente: string;
  origen: OrigenRecuperacion;
  numero_episodio: number;
  estado: EstadoRecuperacion;
  fecha_ingreso: Date | null;
  fecha_limite: Date | null;
  motivo: string | null;
  responsable: string | null;
  resultado: string | null;
  fecha_recuperacion: Date | null;
  fecha_perdida: Date | null;
  creado_por: string;
  creado_en: Date;
  actualizado_en: Date;
}

function toDateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toDomain(row: EpisodioRow): EpisodioRecuperacion {
  return {
    id: row.id,
    idOrdenServicio: row.id_orden_servicio,
    numeroDocumentoCliente: row.numero_documento_cliente,
    nombreCliente: row.nombre_cliente,
    origen: row.origen,
    numeroEpisodio: row.numero_episodio,
    estado: row.estado,
    fechaIngreso: toDateOnly(row.fecha_ingreso),
    fechaLimite: toDateOnly(row.fecha_limite),
    motivo: row.motivo,
    responsable: row.responsable,
    resultado: row.resultado,
    fechaRecuperacion: toDateOnly(row.fecha_recuperacion),
    fechaPerdida: toDateOnly(row.fecha_perdida),
    creadoPor: row.creado_por,
    creadoEn: row.creado_en.toISOString(),
    actualizadoEn: row.actualizado_en.toISOString(),
  };
}

const ESTADOS_ABIERTOS: EstadoRecuperacion[] = ["EN_RECUPERACION", "PENDIENTE_VALIDACION"];

export async function listAll(): Promise<EpisodioRecuperacion[]> {
  // Cola activa (EN_RECUPERACION/PENDIENTE_VALIDACION) primero, priorizada
  // por fecha limite ascendente; RECUPERADO/PERDIDO quedan al final.
  const [rows] = await pool.query<EpisodioRow[]>(
    `SELECT * FROM postventa_recuperacion_episodio
     ORDER BY (estado IN ('EN_RECUPERACION', 'PENDIENTE_VALIDACION')) DESC,
              fecha_limite IS NULL, fecha_limite ASC, creado_en DESC`
  );
  return rows.map(toDomain);
}

export async function findById(id: number): Promise<EpisodioRecuperacion | null> {
  const [rows] = await pool.query<EpisodioRow[]>(
    "SELECT * FROM postventa_recuperacion_episodio WHERE id = ?",
    [id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Un unico episodio "abierto" (EN_RECUPERACION o PENDIENTE_VALIDACION) por
// orden+origen a la vez — permite que uno ya PERDIDO/RECUPERADO conviva con
// uno nuevo si la orden vuelve a calificar despues (ver numero_episodio).
export async function findAbiertoPorOrdenOrigen(
  idOrdenServicio: number,
  origen: OrigenRecuperacion
): Promise<EpisodioRecuperacion | null> {
  const [rows] = await pool.query<EpisodioRow[]>(
    `SELECT * FROM postventa_recuperacion_episodio
     WHERE id_orden_servicio = ? AND origen = ? AND estado IN (?, ?)
     ORDER BY numero_episodio DESC LIMIT 1`,
    [idOrdenServicio, origen, ...ESTADOS_ABIERTOS]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

// Para el badge "N sistema(s) en recuperacion" de Cartera — ordenes con
// episodio abierto por RUC, para que el controller pueda restar la propia
// ordenVigente (evita contarla dos veces si algun dia ella misma calificara).
export async function listOrdenesAbiertasByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, number[]>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT numero_documento_cliente, id_orden_servicio FROM postventa_recuperacion_episodio
     WHERE numero_documento_cliente IN (?) AND estado IN (?, ?)`,
    [numerosDocumentoCliente, ...ESTADOS_ABIERTOS]
  );
  const map = new Map<string, number[]>();
  for (const row of rows) {
    const lista = map.get(row.numero_documento_cliente) ?? [];
    // id_orden_servicio es VARCHAR en esta tabla (motivos historicos) pero
    // numero en el dataset en vivo (osRefs/ordenVigente) — normalizar aca a
    // Number es indispensable para que el controller pueda comparar y
    // excluir la propia ordenVigente con !==, si no NUNCA calza (string vs
    // number) y el badge sobre-cuenta la orden vigente como si fuera "otra".
    lista.push(Number(row.id_orden_servicio));
    map.set(row.numero_documento_cliente, lista);
  }
  return map;
}

// Ultimo episodio (cualquier estado) para esta orden+origen — se usa para
// no reabrir automaticamente un episodio que una persona ya marco
// RECUPERADO a mano si la evidencia (motivo) no cambio desde entonces: una
// accion manual trazable es una de las 3 formas validas de "Recuperado" del
// pedido, y el sync-on-read no debe deshacerla solo porque el calculo
// automatico (ej. vencidoDesde) sigue viendo la misma condicion previa. Si
// el motivo SI cambio (ej. vencio un ciclo nuevo, mas reciente), se entiende
// como un caso realmente nuevo y se permite crear otro episodio.
export async function findUltimoEpisodio(
  idOrdenServicio: number,
  origen: OrigenRecuperacion
): Promise<EpisodioRecuperacion | null> {
  const [rows] = await pool.query<EpisodioRow[]>(
    `SELECT * FROM postventa_recuperacion_episodio
     WHERE id_orden_servicio = ? AND origen = ?
     ORDER BY numero_episodio DESC LIMIT 1`,
    [idOrdenServicio, origen]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function listAbiertos(): Promise<EpisodioRecuperacion[]> {
  const [rows] = await pool.query<EpisodioRow[]>(
    "SELECT * FROM postventa_recuperacion_episodio WHERE estado IN (?, ?)",
    ESTADOS_ABIERTOS
  );
  return rows.map(toDomain);
}

// Siguiente numero_episodio disponible para esta orden+origen — 1 si nunca
// hubo un episodio, o el ultimo + 1 si ya hubo uno (PERDIDO/RECUPERADO) y se
// esta por abrir uno nuevo.
async function siguienteNumeroEpisodio(idOrdenServicio: number, origen: OrigenRecuperacion): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT MAX(numero_episodio) AS maximo FROM postventa_recuperacion_episodio WHERE id_orden_servicio = ? AND origen = ?",
    [idOrdenServicio, origen]
  );
  const maximo = rows[0]?.maximo as number | null;
  return (maximo ?? 0) + 1;
}

export async function create(input: {
  idOrdenServicio: number;
  numeroDocumentoCliente: string;
  nombreCliente: string;
  origen: OrigenRecuperacion;
  estado: EstadoRecuperacion;
  fechaIngreso: string | null;
  fechaLimite: string | null;
  motivo: string | null;
  creadoPor: string;
}): Promise<EpisodioRecuperacion> {
  const numeroEpisodio = await siguienteNumeroEpisodio(input.idOrdenServicio, input.origen);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_recuperacion_episodio
      (id_orden_servicio, numero_documento_cliente, nombre_cliente, origen, numero_episodio,
       estado, fecha_ingreso, fecha_limite, motivo, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.idOrdenServicio,
      input.numeroDocumentoCliente,
      input.nombreCliente,
      input.origen,
      numeroEpisodio,
      input.estado,
      input.fechaIngreso,
      input.fechaLimite,
      input.motivo,
      input.creadoPor,
    ]
  );
  return (await findById(result.insertId))!;
}

export async function update(
  id: number,
  patch: Partial<{
    estado: EstadoRecuperacion;
    fechaIngreso: string | null;
    fechaLimite: string | null;
    motivo: string;
    responsable: string;
    resultado: string;
    fechaRecuperacion: string;
    fechaPerdida: string;
  }>
): Promise<EpisodioRecuperacion | null> {
  const campoPorClave: Record<string, string> = {
    estado: "estado",
    fechaIngreso: "fecha_ingreso",
    fechaLimite: "fecha_limite",
    motivo: "motivo",
    responsable: "responsable",
    resultado: "resultado",
    fechaRecuperacion: "fecha_recuperacion",
    fechaPerdida: "fecha_perdida",
  };
  const campos: string[] = [];
  const valores: unknown[] = [];
  for (const [clave, columna] of Object.entries(campoPorClave)) {
    const valor = (patch as Record<string, unknown>)[clave];
    if (valor !== undefined) {
      campos.push(`${columna} = ?`);
      valores.push(valor);
    }
  }
  if (campos.length === 0) return findById(id);

  await pool.query(`UPDATE postventa_recuperacion_episodio SET ${campos.join(", ")} WHERE id = ?`, [
    ...valores,
    id,
  ]);
  return findById(id);
}
