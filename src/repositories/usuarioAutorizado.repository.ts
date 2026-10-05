import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { RolUsuario, UsuarioAutorizado } from "../types/usuarioAutorizado.js";

interface UsuarioAutorizadoRow extends RowDataPacket {
  id: number;
  id_usuario_apiworking: string | null;
  usuario_externo: string;
  nombre_visible: string;
  rol: RolUsuario;
  activo: number;
  recibe_reparto: number;
  ultimo_acceso_en: Date | null;
  creado_en: Date;
  actualizado_en: Date;
  creado_por: string;
  actualizado_por: string | null;
}

function toDomain(row: UsuarioAutorizadoRow): UsuarioAutorizado {
  return {
    id: row.id,
    idUsuarioApiworking: row.id_usuario_apiworking,
    usuarioExterno: row.usuario_externo,
    nombreVisible: row.nombre_visible,
    rol: row.rol,
    activo: !!row.activo,
    recibeReparto: !!row.recibe_reparto,
    ultimoAccesoEn: row.ultimo_acceso_en ? row.ultimo_acceso_en.toISOString() : null,
    creadoEn: row.creado_en.toISOString(),
    actualizadoEn: row.actualizado_en.toISOString(),
    creadoPor: row.creado_por,
    actualizadoPor: row.actualizado_por,
  };
}

export async function findByUsuarioExterno(
  usuarioExterno: string
): Promise<UsuarioAutorizado | null> {
  const [rows] = await pool.query<UsuarioAutorizadoRow[]>(
    "SELECT * FROM postventa_usuarios_autorizados WHERE LOWER(usuario_externo) = LOWER(?)",
    [usuarioExterno]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function findById(id: number): Promise<UsuarioAutorizado | null> {
  const [rows] = await pool.query<UsuarioAutorizadoRow[]>(
    "SELECT * FROM postventa_usuarios_autorizados WHERE id = ?",
    [id]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function listAll(): Promise<UsuarioAutorizado[]> {
  const [rows] = await pool.query<UsuarioAutorizadoRow[]>(
    "SELECT * FROM postventa_usuarios_autorizados ORDER BY creado_en DESC"
  );
  return rows.map(toDomain);
}

export async function create(input: {
  idUsuarioApiworking: string | null;
  usuarioExterno: string;
  nombreVisible: string;
  rol: RolUsuario;
  activo: boolean;
  creadoPor: string;
}): Promise<UsuarioAutorizado> {
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO postventa_usuarios_autorizados
      (id_usuario_apiworking, usuario_externo, nombre_visible, rol, activo, creado_por)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.idUsuarioApiworking,
      input.usuarioExterno,
      input.nombreVisible,
      input.rol,
      input.activo ? 1 : 0,
      input.creadoPor,
    ]
  );
  return (await findById(result.insertId))!;
}

export async function update(
  id: number,
  patch: {
    nombreVisible?: string;
    rol?: RolUsuario;
    activo?: boolean;
    recibeReparto?: boolean;
    idUsuarioApiworking?: string | null;
    actualizadoPor: string;
  }
): Promise<UsuarioAutorizado | null> {
  const campos: string[] = [];
  const valores: unknown[] = [];
  if (patch.nombreVisible !== undefined) {
    campos.push("nombre_visible = ?");
    valores.push(patch.nombreVisible);
  }
  if (patch.rol !== undefined) {
    campos.push("rol = ?");
    valores.push(patch.rol);
  }
  if (patch.activo !== undefined) {
    campos.push("activo = ?");
    valores.push(patch.activo ? 1 : 0);
  }
  if (patch.recibeReparto !== undefined) {
    campos.push("recibe_reparto = ?");
    valores.push(patch.recibeReparto ? 1 : 0);
  }
  if (patch.idUsuarioApiworking !== undefined) {
    campos.push("id_usuario_apiworking = ?");
    valores.push(patch.idUsuarioApiworking);
  }
  campos.push("actualizado_por = ?");
  valores.push(patch.actualizadoPor);

  await pool.query(
    `UPDATE postventa_usuarios_autorizados SET ${campos.join(", ")} WHERE id = ?`,
    [...valores, id]
  );
  return findById(id);
}

// Usuarios activos que reciben el reparto diario, en orden estable (por
// usuario_externo, sin distinguir mayusculas) para que el reparto sea
// determinista. El valor devuelto es usuario_externo, que es lo que se guarda
// en postventa_tareas.responsable.
export async function listReceptoresReparto(): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT usuario_externo FROM postventa_usuarios_autorizados WHERE activo = 1 AND recibe_reparto = 1 ORDER BY LOWER(usuario_externo)"
  );
  return rows.map((r) => r.usuario_externo as string);
}

// Salvaguarda de "ultimo admin activo": cuenta ADMIN activos, opcionalmente
// excluyendo un id (el que se esta por editar), para decidir si una
// operacion dejaria la plataforma sin ningun ADMIN.
export async function countActiveAdmins(excludingId?: number): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    excludingId
      ? "SELECT COUNT(*) AS total FROM postventa_usuarios_autorizados WHERE rol = 'ADMIN' AND activo = 1 AND id != ?"
      : "SELECT COUNT(*) AS total FROM postventa_usuarios_autorizados WHERE rol = 'ADMIN' AND activo = 1",
    excludingId ? [excludingId] : []
  );
  return Number(rows[0]?.total ?? 0);
}

export async function touchUltimoAcceso(usuarioExterno: string): Promise<void> {
  await pool.query(
    "UPDATE postventa_usuarios_autorizados SET ultimo_acceso_en = NOW() WHERE LOWER(usuario_externo) = LOWER(?)",
    [usuarioExterno]
  );
}
