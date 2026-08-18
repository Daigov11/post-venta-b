import type { RowDataPacket } from "mysql2";
import { pool } from "../config/db.js";

export interface ConfigRow {
  key: string;
  value: string;
  valueType: "NUMBER" | "STRING" | "BOOLEAN";
  descripcion: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

interface RawConfigRow extends RowDataPacket {
  config_key: string;
  config_value: string;
  value_type: "NUMBER" | "STRING" | "BOOLEAN";
  descripcion: string | null;
  updated_by: string | null;
  updated_at: Date;
}

export async function findAll(): Promise<ConfigRow[]> {
  const [rows] = await pool.query<RawConfigRow[]>(
    "SELECT * FROM postventa_config ORDER BY config_key ASC"
  );
  return rows.map((row) => ({
    key: row.config_key,
    value: row.config_value,
    valueType: row.value_type,
    descripcion: row.descripcion,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function upsertMany(
  patch: Record<string, string>,
  usuario: string
): Promise<void> {
  const entries = Object.entries(patch);
  for (const [key, value] of entries) {
    await pool.query(
      "UPDATE postventa_config SET config_value = ?, updated_by = ? WHERE config_key = ?",
      [value, usuario, key]
    );
  }
}
