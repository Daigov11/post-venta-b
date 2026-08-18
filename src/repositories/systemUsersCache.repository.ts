import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";
import type { SystemUsersCache } from "../types/postventa.js";
import { parseJsonColumn } from "./jsonColumn.js";

interface SystemUsersCacheRow extends RowDataPacket {
  numero_documento_cliente: string;
  cantidad_trabajadores: number;
  base_datos: string | null;
  usuarios: unknown;
  link_sistema_usado: string | null;
  updated_at: Date;
}

function toDomain(row: SystemUsersCacheRow): SystemUsersCache {
  return {
    numeroDocumentoCliente: row.numero_documento_cliente,
    cantidadTrabajadores: row.cantidad_trabajadores,
    baseDatos: row.base_datos,
    usuarios: parseJsonColumn<string[]>(row.usuarios, []),
    linkSistemaUsado: row.link_sistema_usado,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function findAllByClientes(
  numerosDocumentoCliente: string[]
): Promise<Map<string, SystemUsersCache>> {
  if (numerosDocumentoCliente.length === 0) return new Map();
  const [rows] = await pool.query<SystemUsersCacheRow[]>(
    "SELECT * FROM postventa_system_users_cache WHERE numero_documento_cliente IN (?)",
    [numerosDocumentoCliente]
  );
  const map = new Map<string, SystemUsersCache>();
  for (const row of rows) {
    const domain = toDomain(row);
    map.set(domain.numeroDocumentoCliente, domain);
  }
  return map;
}

export async function findOne(
  numeroDocumentoCliente: string
): Promise<SystemUsersCache | null> {
  const [rows] = await pool.query<SystemUsersCacheRow[]>(
    "SELECT * FROM postventa_system_users_cache WHERE numero_documento_cliente = ?",
    [numeroDocumentoCliente]
  );
  return rows[0] ? toDomain(rows[0]) : null;
}

export async function upsert(input: {
  numeroDocumentoCliente: string;
  cantidadTrabajadores: number;
  baseDatos: string | null;
  usuarios: string[];
  linkSistemaUsado: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO postventa_system_users_cache
      (numero_documento_cliente, cantidad_trabajadores, base_datos, usuarios, link_sistema_usado)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      cantidad_trabajadores = VALUES(cantidad_trabajadores),
      base_datos = VALUES(base_datos),
      usuarios = VALUES(usuarios),
      link_sistema_usado = VALUES(link_sistema_usado)`,
    [
      input.numeroDocumentoCliente,
      input.cantidadTrabajadores,
      input.baseDatos,
      JSON.stringify(input.usuarios),
      input.linkSistemaUsado,
    ]
  );
}
